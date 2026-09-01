import { randomUUID } from "node:crypto";
import { createReturnRequest, ReturnRequestStatus, settleRefund } from "@pcx/domain";
import { hasPermission, normalizeSerialIdentifier, Permission, createSandboxRefundGateway } from "@pcx/domain";

export class ReturnRequestError extends Error {
  constructor(code) { super(code); this.name = "ReturnRequestError"; this.code = code; }
}

const createFields = new Set(["orderItemId", "reasonCode", "customerNotes"]);

export function createReturnRequestService({ authService, repository, id = randomUUID, clock = () => new Date(), refundGateway = createSandboxRefundGateway(), refundResolver = null }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["create", "approve", "markReceived", "settleRefund", "findById", "findRefundableByOrderItem", "orderItemInventoryId", "findPrimarySerialByOrderItem", "list"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);
  if (!refundGateway || typeof refundGateway.refund !== "function") throw new TypeError("refundGateway.refund is required");

  async function customer(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (identity.status !== "ACTIVE" || !Array.isArray(identity.roles) || !identity.roles.includes("CUSTOMER")) throw new ReturnRequestError("forbidden");
    return identity;
  }

  async function refundActor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.REFUND_MANAGE)) throw new ReturnRequestError("forbidden");
    return identity;
  }

  async function reader(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.REFUND_MANAGE) && !hasPermission(identity, Permission.AUDIT_READ)) throw new ReturnRequestError("forbidden");
    return identity;
  }

  function exact(input, allowed) {
    for (const key of Object.keys(input ?? {})) if (!allowed.has(key)) throw new ReturnRequestError("invalid_input");
    return input ?? {};
  }

  // Resolve the refund through the injected resolver (bKash from active
  // credentials + payment context) or fall back to the sandbox gateway. The
  // resolver returns the server-authoritative { provider, providerTransactionId,
  // providerStatus } recorded on the return.
  async function resolveRefund({ orderId, amount, reference }) {
    if (!refundResolver) {
      const outcome = await refundGateway.refund({ amount, currency: "BDT", reference });
      return { provider: "SANDBOX", providerTransactionId: outcome.providerTransactionId, providerStatus: outcome.status };
    }
    return refundResolver({ orderId, amount, reference });
  }

  return Object.freeze({
    async create(accessCredential, input) {
      await customer(accessCredential);
      const fields = exact(input, createFields);
      // Order item must exist.
      const inventoryItemId = await repository.orderItemInventoryId(fields.orderItemId);
      if (!inventoryItemId) throw new ReturnRequestError("invalid_reference");

      const existing = await repository.findRefundableByOrderItem(fields.orderItemId);
      if (existing) throw new ReturnRequestError("conflict");

      let record;
      try {
        record = createReturnRequest({ id: id(), orderItemId: fields.orderItemId, reasonCode: fields.reasonCode, customerNotes: fields.customerNotes, requestedAt: clock() });
      } catch {
        throw new ReturnRequestError("invalid_input");
      }
      try {
        return Object.freeze(await repository.create(record));
      } catch (error) {
        if (error?.code === "23505") throw new ReturnRequestError("conflict");
        throw error;
      }
    },

    async approve(accessCredential, returnId) {
      await refundActor(accessCredential);
      const result = await repository.approve(returnId, clock().toISOString());
      if (result.status !== "approved") throw new ReturnRequestError("invalid_state");
      return result.record;
    },

    async receive(accessCredential, returnId, serial) {
      await refundActor(accessCredential);
      const existing = await repository.findById(returnId);
      if (!existing) throw new ReturnRequestError("not_found");
      // Physical identity guard: the received serial must match the sold unit's
      // primary serial. Comparison is on the normalized value (upper-cased), so
      // casing/whitespace does not defeat the match.
      const expected = await repository.findPrimarySerialByOrderItem(existing.orderItemId);
      let supplied = null;
      try { supplied = normalizeSerialIdentifier(serial); } catch { supplied = null; }
      if (!expected || supplied !== expected) throw new ReturnRequestError("serial_mismatch");
      const result = await repository.markReceived(returnId, clock().toISOString());
      if (result.status !== "received") throw new ReturnRequestError("invalid_state");
      return result.record;
    },

    async list(accessCredential) {
      await reader(accessCredential);
      if (typeof repository.list !== "function") throw new ReturnRequestError("invalid_state");
      return Object.freeze({ data: Object.freeze(await repository.list()) });
    },

    async settleRefund(accessCredential, returnId, amount) {
      await refundActor(accessCredential);
      const existing = await repository.findById(returnId);
      if (!existing) throw new ReturnRequestError("not_found");
      // Replay-safe: a repeated settle for an already-REFUNDED return returns the
      // existing record without calling the gateway a second time.
      if (existing.status === ReturnRequestStatus.REFUNDED) return existing;
      try {
        settleRefund(existing, amount, { resolvedAt: clock() });
      } catch {
        throw new ReturnRequestError("invalid_state");
      }
      // Idempotent, server-authoritative provider transaction id derived from the
      // return + amount, so a client retry reuses the same reference and the
      // gateway dedupes it instead of issuing a duplicate disbursement.
      const reference = `refund-${returnId}-${amount}`;
      const orderId = typeof repository.orderIdByOrderItem === "function" ? await repository.orderIdByOrderItem(existing.orderItemId) : null;
      let provider = { provider: "SANDBOX", providerTransactionId: null, providerStatus: "FAILED" };
      try {
        provider = await resolveRefund({ orderId, amount, reference });
      } catch {
        // Gateway failure never rolls back the REFUNDED transition: the
        // authorized financial fact persists and the FAILED provider status is
        // recorded for later reconciliation.
      }
      const result = await repository.settleRefund(returnId, amount, clock().toISOString(), provider);
      if (result.status !== "refunded") throw new ReturnRequestError("invalid_state");
      return result.record;
    }
  });
}
