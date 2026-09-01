import assert from "node:assert/strict";
import test from "node:test";
import { createReturnRequestService } from "../src/modules/warranty/return-request-service.mjs";
import { ReturnRequestStatus } from "@pcx/domain";

function fixture(overrides = {}) {
  const calls = { creates: [], approves: [], receives: [], refunds: [] };
  const repository = {
    async orderItemInventoryId(id) { return id === "oi1" ? "inv-1" : null; },
    async findRefundableByOrderItem() { return null; },
    async create(record) { calls.creates.push(record); return record; },
    async approve() { return { status: "approved", record: { id: "r1", status: ReturnRequestStatus.APPROVED } }; },
    async markReceived() { return { status: "received", record: { id: "r1", status: ReturnRequestStatus.RECEIVED } }; },
    async settleRefund(id, amount, now, provider) { calls.refunds.push({ id, amount, now, provider }); return { status: "refunded", record: { id: "r1", status: ReturnRequestStatus.REFUNDED, resolutionAmount: amount, ...provider } }; },
    async findById() { return { id: "r1", status: ReturnRequestStatus.RECEIVED }; },
    async findPrimarySerialByOrderItem() { return "SN-123"; },
    async list() { return []; },
    ...overrides.repository
  };
  const service = createReturnRequestService({
    authService: { async authenticateAccess() { return { userId: "u1", status: "ACTIVE", roles: ["CUSTOMER", "FINANCE"] }; }, ...overrides.authService },
    repository,
    id: (() => { let n = 0; return () => `id-${++n}`; })(),
    clock: () => new Date("2026-08-16T12:00:00.000Z"),
    refundGateway: overrides.refundGateway ?? { async refund() { return { providerTransactionId: "sandbox-refund-r1-1000", status: "CONFIRMED" }; } }
  });
  return { service, calls };
}

test("return creation requires customer, existing order item, and blocks duplicates", async () => {
  const { service, calls } = fixture();
  const result = await service.create("access", { orderItemId: "oi1", reasonCode: "DOA" });
  assert.equal(result.status, ReturnRequestStatus.REQUESTED);
  assert.equal(calls.creates.length, 1);

  await assert.rejects(service.create("access", { orderItemId: "missing", reasonCode: "DOA" }), (error) => error.code === "invalid_reference");

  const conflict = fixture({ repository: { async orderItemInventoryId() { return "inv-1"; }, async findRefundableByOrderItem() { return { id: "existing" }; } } });
  await assert.rejects(conflict.service.create("access", { orderItemId: "oi1", reasonCode: "DOA" }), (error) => error.code === "conflict");

  const denied = fixture({ authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(denied.service.approve("access", "r1"), (error) => error.code === "forbidden");
});

test("receive enforces serial match before marking the return received", async () => {
  const { service } = fixture();
  const received = await service.receive("access", "r1", "sn-123");
  assert.equal(received.status, ReturnRequestStatus.RECEIVED);

  const mismatch = fixture({ repository: { async findById() { return { id: "r1", orderItemId: "oi1", status: ReturnRequestStatus.APPROVED }; }, async findPrimarySerialByOrderItem() { return "SN-123"; } } });
  await assert.rejects(mismatch.service.receive("access", "r1", "SN-999"), (error) => error.code === "serial_mismatch");
});

test("approve and settle require REFUND_MANAGE and correct state", async () => {
  const { service } = fixture();
  const approved = await service.approve("access", "r1");
  assert.equal(approved.status, ReturnRequestStatus.APPROVED);

  const settled = await service.settleRefund("access", "r1", 1000);
  assert.equal(settled.status, ReturnRequestStatus.REFUNDED);
  assert.equal(settled.resolutionAmount, 1000);

  const notRefundable = fixture({ repository: { async findById() { return { id: "r1", status: "REQUESTED" }; } } });
  await assert.rejects(notRefundable.service.settleRefund("access", "r1", 1000), (error) => error.code === "invalid_state");
});

test("settleRefund calls the gateway and records a server-derived provider transaction id", async () => {
  const refunded = [];
  const { service, calls } = fixture({
    refundGateway: { async refund({ reference }) { refunded.push(reference); return { providerTransactionId: `rf-${reference}`, status: "CONFIRMED" }; } }
  });
  const settled = await service.settleRefund("access", "r1", 1000);
  assert.equal(settled.status, ReturnRequestStatus.REFUNDED);
  assert.equal(refunded.length, 1);
  assert.equal(refunded[0], "refund-r1-1000");
  assert.equal(calls.refunds[0].provider.providerTransactionId, "rf-refund-r1-1000");
  assert.equal(calls.refunds[0].provider.providerStatus, "CONFIRMED");
});

test("settleRefund is replay-safe and does not call the gateway again for REFUNDED", async () => {
  let gatewayCalls = 0;
  const { service } = fixture({
    repository: { async findById() { return { id: "r1", status: ReturnRequestStatus.REFUNDED, resolutionAmount: 1000 }; } },
    refundGateway: { async refund() { gatewayCalls += 1; return { providerTransactionId: "x", status: "CONFIRMED" }; } }
  });
  const result = await service.settleRefund("access", "r1", 1000);
  assert.equal(result.status, ReturnRequestStatus.REFUNDED);
  assert.equal(gatewayCalls, 0, "replayed settle must not re-call the gateway");
});

test("settleRefund still refunds and records FAILED provider status when the gateway throws", async () => {
  const { service, calls } = fixture({
    refundGateway: { async refund() { throw new Error("gateway down"); } }
  });
  const settled = await service.settleRefund("access", "r1", 1000);
  assert.equal(settled.status, ReturnRequestStatus.REFUNDED);
  assert.equal(calls.refunds[0].provider.providerStatus, "FAILED");
  assert.equal(calls.refunds[0].provider.providerTransactionId, null);
});
