import { randomUUID } from "node:crypto";
import { createOrder, createOrderItemSnapshot, createPayment } from "../../../../../packages/domain/src/commerce/order-payment.mjs";
import { createBkashGateway, createSandboxPaymentGateway, PaymentProvider, Role } from "../../../../../packages/domain/src/index.mjs";

export class OrderPaymentError extends Error {
  constructor(code) { super(code); this.name = "OrderPaymentError"; this.code = code; }
}

const orderFields = new Set(["items"]);
const itemFields = new Set(["inventoryItemId", "listingId", "productModelId", "pcxItemId", "productName", "grade", "healthScore", "unitPrice", "specs"]);
// providerTransactionId is intentionally NOT client-authoritative: it is derived
// from the injected gateway so the server owns the financial fact.
const paymentFields = new Set(["orderId", "direction", "provider", "method", "amount"]);

export function createOrderPaymentService({ authService, repository, id = randomUUID, clock = () => new Date(), gateway = createSandboxPaymentGateway(), paymentProviderConfigService, provider = PaymentProvider.BKASH }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["createOrder", "createOrderItem", "createPayment", "confirmPayment"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);
  if (!gateway || typeof gateway.charge !== "function") throw new TypeError("gateway.charge is required");

  // When a payment provider config service is injected, build a real gateway
  // from the active credentials for the configured provider. This keeps the
  // provider transaction id server-authoritative while letting the admin panel
  // switch between sandbox and live credentials. Falls back to the injected
  // gateway (default sandbox) when no active credentials are configured.
  //
  // The resolved provider name is returned alongside the gateway: it records
  // WHICH provider took the money (e.g. "bkash"), which is a different fact
  // from the credential mode (SANDBOX / REAL) the gateway ran under.
  async function resolveGateway() {
    if (!paymentProviderConfigService || typeof paymentProviderConfigService.getActiveCredentials !== "function") return { gateway, provider: "SANDBOX" };
    const active = await paymentProviderConfigService.getActiveCredentials(provider);
    if (!active) return { gateway, provider: "SANDBOX" };
    return { gateway: createBkashGateway({ mode: active.mode, credentials: active.credentials }), provider };
  }

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
      const paymentId = id();
      let charge;
      let resolvedProvider = "SANDBOX";
      try {
        // The provider transaction id is server-authoritative: it is derived
        // from the resolved gateway (active provider credentials or sandbox),
        // never accepted from client input.
        const resolved = await resolveGateway();
        resolvedProvider = resolved.provider;
        charge = await resolved.gateway.charge({ amount: fields.amount, currency: "BDT", reference: paymentId });
      } catch {
        throw new OrderPaymentError("invalid_input");
      }
      let record;
      try {
        record = createPayment({
          id: paymentId,
          orderId: fields.orderId,
          direction: fields.direction,
          provider: fields.provider ?? resolvedProvider,
          providerTransactionId: charge.providerTransactionId,
          method: fields.method,
          amount: fields.amount,
          initiatedAt: clock()
        });
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
