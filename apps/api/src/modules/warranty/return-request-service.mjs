import { randomUUID } from "node:crypto";
import { createReturnRequest, settleRefund } from "../../../../../packages/domain/src/warranty/return-refund.mjs";
import { hasPermission, Permission } from "../../../../../packages/domain/src/index.mjs";

export class ReturnRequestError extends Error {
  constructor(code) { super(code); this.name = "ReturnRequestError"; this.code = code; }
}

const createFields = new Set(["orderItemId", "reasonCode", "customerNotes"]);

export function createReturnRequestService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["create", "approve", "markReceived", "settleRefund", "findById", "findRefundableByOrderItem", "orderItemInventoryId", "list"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

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

    async receive(accessCredential, returnId) {
      await refundActor(accessCredential);
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
      try {
        settleRefund(existing, amount, { resolvedAt: clock() });
      } catch {
        throw new ReturnRequestError("invalid_state");
      }
      const result = await repository.settleRefund(returnId, amount, clock().toISOString());
      if (result.status !== "refunded") throw new ReturnRequestError("invalid_state");
      return result.record;
    }
  });
}
