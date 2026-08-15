import { randomUUID } from "node:crypto";
import { createOrder, createOrderItemSnapshot, createPayment } from "../../../../../packages/domain/src/commerce/order-payment.mjs";
import { Role } from "../../../../../packages/domain/src/index.mjs";

export class OrderPaymentError extends Error {
  constructor(code) { super(code); this.name = "OrderPaymentError"; this.code = code; }
}

const orderFields = new Set(["items"]);
const itemFields = new Set(["inventoryItemId", "listingId", "productModelId", "pcxItemId", "productName", "grade", "healthScore", "unitPrice", "specs"]);
const paymentFields = new Set(["orderId", "direction", "provider", "providerTransactionId", "method", "amount"]);

export function createOrderPaymentService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["createOrder", "createOrderItem", "createPayment", "confirmPayment"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  async function customer(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (identity.status !== "ACTIVE" || !Array.isArray(identity.roles) || !identity.roles.includes(Role.CUSTOMER)) throw new OrderPaymentError("forbidden");
    return identity;
  }

  function exact(input, allowed) {
    for (const key of Object.keys(input ?? {})) if (!allowed.has(key)) throw new OrderPaymentError("invalid_input");
    return input ?? {};
  }

  return Object.freeze({
    async createOrder(accessCredential, input) {
      const identity = await customer(accessCredential);
      const fields = exact(input, orderFields);
      if (!Array.isArray(fields.items) || fields.items.length === 0) throw new OrderPaymentError("invalid_input");

      const orderId = id();
      const items = [];
      for (const value of fields.items) {
        const data = exact(value, itemFields);
        try {
          items.push(createOrderItemSnapshot({
            id: id(),
            orderId,
            inventoryItemId: data.inventoryItemId,
            listingId: data.listingId,
            productModelId: data.productModelId,
            pcxItemId: data.pcxItemId,
            productName: data.productName,
            grade: data.grade,
            healthScore: data.healthScore,
            unitPrice: data.unitPrice,
            specs: data.specs
          }));
        } catch {
          throw new OrderPaymentError("invalid_input");
        }
      }

      const subtotal = items.reduce((sum, item) => sum + item.unitPrice, 0);
      let order;
      try {
        order = createOrder({ id: orderId, userId: identity.userId, subtotal, placedAt: clock() });
      } catch {
        throw new OrderPaymentError("invalid_input");
      }

      try {
        const created = await repository.createOrder(order);
        const orderItems = [];
        for (const item of items) {
          orderItems.push(await repository.createOrderItem(item));
        }
        return Object.freeze({ ...created, items: Object.freeze(orderItems) });
      } catch (error) {
        if (error?.code === "23503") throw new OrderPaymentError("invalid_reference");
        throw error;
      }
    },

    async createPayment(accessCredential, input) {
      await customer(accessCredential);
      const fields = exact(input, paymentFields);
      let record;
      try {
        record = createPayment({ id: id(), ...fields, initiatedAt: clock() });
      } catch {
        throw new OrderPaymentError("invalid_input");
      }
      try {
        return Object.freeze(await repository.createPayment(record));
      } catch (error) {
        if (error?.code === "23505") throw new OrderPaymentError("conflict");
        if (error?.code === "23503") throw new OrderPaymentError("invalid_reference");
        throw error;
      }
    },

    async confirmPayment(accessCredential, providerTransactionId) {
      await customer(accessCredential);
      const result = await repository.confirmPayment(providerTransactionId, clock().toISOString());
      if (result.status !== "confirmed") throw new OrderPaymentError("invalid_state");
      return result.record;
    }
  });
}
