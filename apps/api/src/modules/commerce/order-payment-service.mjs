import { randomUUID } from "node:crypto";
import { createOrder, createOrderItemSnapshot, createPayment } from "@pcx/domain";
import { createBkashGateway, createSandboxPaymentGateway, PaymentMethod, PaymentProvider, Role } from "@pcx/domain";

export class OrderPaymentError extends Error {
  constructor(code) { super(code); this.name = "OrderPaymentError"; this.code = code; }
}

const orderFields = new Set(["items"]);
const itemFields = new Set(["inventoryItemId", "listingId", "productModelId", "pcxItemId", "productName", "grade", "healthScore", "unitPrice", "specs"]);
// providerTransactionId AND provider are intentionally NOT client-authoritative:
// both are derived server-side so the server owns the financial fact.
const paymentFields = new Set(["orderId", "direction", "method", "amount"]);

export function createOrderPaymentService({ authService, repository, id = randomUUID, clock = () => new Date(), gateway = createSandboxPaymentGateway(), paymentProviderConfigService, notificationEmitter = null, provider = PaymentProvider.BKASH }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["createOrderWithItems", "createPayment", "confirmPayment"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);
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
  //
  // Resolved gateways are cached by activation identity (provider + mode +
  // credentials) so a single gateway instance — and therefore its per-reference
  // idempotency cache — is reused across payment calls instead of starting empty
  // on every request.
  const gatewayCache = new Map();
  async function resolveGateway() {
    if (!paymentProviderConfigService || typeof paymentProviderConfigService.getActiveCredentials !== "function") return { gateway, provider: "SANDBOX" };
    const active = await paymentProviderConfigService.getActiveCredentials(provider);
    if (!active) return { gateway, provider: "SANDBOX" };
    const cacheKey = `${provider}:${active.mode}:${JSON.stringify(active.credentials)}`;
    let resolved = gatewayCache.get(cacheKey);
    if (!resolved) {
      resolved = createBkashGateway({ mode: active.mode, credentials: active.credentials });
      gatewayCache.set(cacheKey, resolved);
    }
    return { gateway: resolved, provider };
  }

  // The charge reference is a deterministic idempotency key derived from the
  // order and amount: a client retry after a timeout reuses the same reference,
  // so the cached gateway dedupes it against the in-flight/prior charge instead
  // of initiating a brand-new charge under a fresh random id.
  function chargeReference(fields) {
    return `payment-${fields.orderId}-${fields.amount}`;
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
        const created = await repository.createOrderWithItems(order, items);
        if (notificationEmitter && typeof notificationEmitter.emit === "function") {
          try {
            await notificationEmitter.emit({
              notificationType: "ORDER_PLACED",
              userId: identity.userId,
              channel: "EMAIL",
              referenceType: "order",
              referenceId: created.order.id,
              payloadSnapshot: { orderNo: created.order.orderNo, total: created.order.totalAmount }
            });
          } catch { /* best-effort; notification must never fail the order */ }
        }
        return Object.freeze({ ...created.order, items: Object.freeze(created.items) });
      } catch (error) {
        // The repository atomically claims each sellable listing (PUBLISHED ->
        // RESERVED); item_unavailable means another transaction already owns the
        // physical item, so there is a double-sell conflict (spec §22).
        if (error?.code === "item_unavailable") throw new OrderPaymentError("item_unavailable");
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
      if (fields.method === PaymentMethod.COD) {
        // Cash on delivery has no external provider charge. The provider
        // transaction id is still server-derived and deterministic per order +
        // amount so a client retry is idempotent and dupes are deduped by the
        // unique provider transaction id constraint. The amount is recorded as
        // the collection target; actual cash collection becomes CONFIRMED via
        // confirmPayment at delivery.
        resolvedProvider = PaymentMethod.COD;
        charge = { providerTransactionId: `cod-${fields.orderId}-${fields.amount}` };
      } else {
        try {
          // The provider transaction id is server-authoritative: it is derived
          // from the resolved gateway (active provider credentials or sandbox),
          // never accepted from client input.
          const resolved = await resolveGateway();
          resolvedProvider = resolved.provider;
          charge = await resolved.gateway.charge({ amount: fields.amount, currency: "BDT", reference: chargeReference(fields) });
        } catch {
          throw new OrderPaymentError("invalid_input");
        }
      }
      let record;
      try {
        record = createPayment({
          id: paymentId,
          orderId: fields.orderId,
          direction: fields.direction,
          provider: resolvedProvider,
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
      const identity = await customer(accessCredential);
      const result = await repository.confirmPayment(providerTransactionId, identity.userId, clock().toISOString());
      if (result.status !== "confirmed") throw new OrderPaymentError("invalid_state");
      return result.record;
    }
  });
}
