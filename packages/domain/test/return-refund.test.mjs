import assert from "node:assert/strict";
import test from "node:test";
import { approveReturn, createReturnRequest, markReturnReceived, ReturnRequestStatus, settleRefund } from "../src/index.mjs";

test("return request is REQUESTED with server-owned lifecycle", () => {
  const request = createReturnRequest({ id: "r1", orderItemId: "oi1", reasonCode: "DOA", customerNotes: "not powering on", requestedAt: "2026-08-16T12:00:00.000Z" });
  assert.equal(request.status, ReturnRequestStatus.REQUESTED);
  assert.equal(request.reasonCode, "DOA");
  assert.equal(request.resolutionAmount, null);
});

test("return transitions REQUESTED→APPROVED→RECEIVED→REFUNDED", () => {
  const request = createReturnRequest({ id: "r1", orderItemId: "oi1", reasonCode: "DOA" });
  const approved = approveReturn(request);
  assert.equal(approved.status, ReturnRequestStatus.APPROVED);
  assert.throws(() => approveReturn(approved), /REQUESTED/);

  const received = markReturnReceived(approved, { receivedAt: "2026-08-16T14:00:00.000Z" });
  assert.equal(received.status, ReturnRequestStatus.RECEIVED);
  assert.throws(() => markReturnReceived(request), /APPROVED/);

  const settled = settleRefund(received, 1000, { resolvedAt: "2026-08-16T15:00:00.000Z" });
  assert.equal(settled.status, ReturnRequestStatus.REFUNDED);
  assert.equal(settled.resolutionAmount, 1000);
  assert.throws(() => settleRefund(received, -1), /non-negative/);
  assert.throws(() => settleRefund(settled, 1000), /RECEIVED/);
});
