import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createShipment, createShipmentEvent, markShipped, markDelivered, markReturned } from "@pcx/domain";
import { createSandboxCourier, hasPermission, Permission } from "@pcx/domain";


export class ShipmentError extends Error {
  constructor(code) { super(code); this.name = "ShipmentError"; this.code = code; }
}

const createFields = new Set(["orderId", "courier", "packageType", "weight", "codAmount", "shippingCharge"]);
// trackingId is intentionally NOT client-authoritative: it is derived from the
// injected courier so the server owns the logistics fact.

export function createShipmentService({ authService, repository, id = randomUUID, clock = () => new Date(), courier = createSandboxCourier(), webhookSecret = null, maxWebhookRetries = 5 }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["create", "markShipped", "markDelivered", "markReturned", "recordEvent", "list"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);
  if (!courier || typeof courier.createShipment !== "function") throw new TypeError("courier.createShipment is required");
  if (webhookSecret != null && typeof webhookSecret !== "string") throw new TypeError("webhookSecret must be a string");
  if (!Number.isInteger(maxWebhookRetries) || maxWebhookRetries < 0) throw new TypeError("maxWebhookRetries must be a non-negative integer");




  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.INVENTORY_MANAGE) && !hasPermission(identity, Permission.SYSTEM_CONFIGURE)) throw new ShipmentError("forbidden");
    return identity;
  }

  function exact(input, allowed) {
    for (const key of Object.keys(input ?? {})) if (!allowed.has(key)) throw new ShipmentError("invalid_input");
    return input ?? {};
  }

  function verifySecret(signature) {
    if (webhookSecret == null || typeof signature !== "string") return false;
    const expected = createHash("sha256").update(webhookSecret).digest("hex");
    const provided = createHash("sha256").update(signature).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  // Maps a courier provider status to a shipment state transition. Only
  // terminal provider statuses advance the lifecycle; everything else is
  // recorded as an informational event without a state change.
  const providerTransitions = Object.freeze({
    DELIVERED: { transition: "markDelivered", status: "DELIVERED" },
    RETURNED: { transition: "markReturned", status: "RETURNED" }
  });

  return Object.freeze({

    async list(accessCredential) {
      await actor(accessCredential);
      if (typeof repository.list !== "function") throw new ShipmentError("invalid_state");
      return Object.freeze({ data: Object.freeze(await repository.list()) });
    },

    async create(accessCredential, input) {
      await actor(accessCredential);
      const fields = exact(input, createFields);
      let record;
      try {
        record = createShipment({ id: id(), ...fields, createdAt: clock() });
      } catch {
        throw new ShipmentError("invalid_input");
      }
      try {
        return Object.freeze(await repository.create(record));
      } catch (error) {
        if (error?.code === "23505") throw new ShipmentError("conflict");
        if (error?.code === "23503") throw new ShipmentError("invalid_reference");
        throw error;
      }
    },

    async ship(accessCredential, shipmentId, address) {
      await actor(accessCredential);
      let shipment;
      try {
        // The tracking id is server-authoritative: it is derived from the
        // injected courier, never accepted from client input.
        shipment = await courier.createShipment({ reference: shipmentId, address });
      } catch {
        throw new ShipmentError("invalid_input");
      }
      const result = await repository.markShipped(shipmentId, shipment.trackingId, clock().toISOString());
      if (result.status !== "shipped") throw new ShipmentError("invalid_state");
      await repository.recordEvent(createShipmentEvent({ id: id(), shipmentId, status: "SHIPPED", providerStatusRaw: shipment.status ?? null, occurredAt: clock() }));
      return result.record;
    },


    async deliver(accessCredential, shipmentId) {
      await actor(accessCredential);
      const result = await repository.markDelivered(shipmentId, clock().toISOString());
      if (result.status !== "delivered") throw new ShipmentError("invalid_state");
      await repository.recordEvent(createShipmentEvent({ id: id(), shipmentId, status: "DELIVERED", occurredAt: clock() }));
      return result.record;
    },

    // Inbound courier webhook. The signature is validated server-side with a
    // timing-safe comparison. Every webhook is durably enqueued to the outbox
    // before application so a delivery event is never lost between receipt and
    // state transition. A provider status that maps to a terminal transition
    // advances the shipment; a repeated webhook for an already-final state is a
    // no-op (idempotent), not an error.
    async handleWebhook({ signature, shipmentId, providerStatus, occurredAt = clock() }) {
      if (!verifySecret(signature)) throw new ShipmentError("unauthorized");
      if (typeof shipmentId !== "string" || shipmentId.length === 0) throw new ShipmentError("invalid_input");
      const mapping = providerTransitions[providerStatus];
      const eventId = id();
      const occurred = occurredAt instanceof Date ? occurredAt.toISOString() : occurredAt;
      // Durable enqueue: the webhook is recorded before any state transition so
      // a crash cannot lose the delivery event. The worker retries PENDING
      // events if application fails.
      await repository.enqueueWebhookEvent({ id: eventId, shipmentId, providerStatus: providerStatus ?? null, occurredAt: occurred, nextAttemptAt: null });
      if (!mapping) {
        // Informational provider status: record the event without a state change.
        await repository.recordEvent(createShipmentEvent({ id: id(), shipmentId, status: "SHIPPED", providerStatusRaw: providerStatus ?? null, occurredAt }));
        await repository.markWebhookApplied(eventId, clock().toISOString());
        return { status: "recorded", shipmentId };
      }
      const result = await repository[mapping.transition](shipmentId, occurred);
      if (result.status === "not_deliverable" || result.status === "not_returnable") {
        // Already in a final state: idempotent no-op.
        await repository.markWebhookApplied(eventId, clock().toISOString());
        return { status: "noop", shipmentId };
      }
      if (result.status !== mapping.status.toLowerCase()) throw new ShipmentError("invalid_state");
      await repository.recordEvent(createShipmentEvent({ id: id(), shipmentId, status: mapping.status, providerStatusRaw: providerStatus, occurredAt }));
      await repository.markWebhookApplied(eventId, clock().toISOString());
      return { status: "applied", shipmentId, record: result.record };
    },

    // Worker job: retries PENDING courier webhook events that were durably
    // enqueued but not yet applied (e.g. the process crashed after enqueue, or
    // a transient DB failure). Applies the transition and marks the event
    // APPLIED; on repeated failure the event is marked FAILED after the retry
    // budget is exhausted. Idempotent: an already-final shipment is a no-op.
    async dispatchDueWebhookEvents({ limit = 20 } = {}) {
      const claim = typeof repository.claimPendingWebhookEvents === "function" ? repository.claimPendingWebhookEvents : repository.listPendingWebhookEvents;
      if (typeof claim !== "function") throw new ShipmentError("invalid_state");
      // Prefer the row-locking claim to avoid duplicate processing across concurrent
      // workers; falls back to the non-locking list when only a simple reader exists.
      const pending = await claim.call(repository, limit);
      const results = [];
      for (const event of pending) {
        const mapping = providerTransitions[event.providerStatus];
        try {
          if (!mapping) {
            await repository.recordEvent(createShipmentEvent({ id: id(), shipmentId: event.shipmentId, status: "SHIPPED", providerStatusRaw: event.providerStatus ?? null, occurredAt: event.occurredAt ? new Date(event.occurredAt) : clock() }));
          } else {
            const result = await repository[mapping.transition](event.shipmentId, event.occurredAt ? new Date(event.occurredAt).toISOString() : clock().toISOString());
            if (result.status !== "not_deliverable" && result.status !== "not_returnable" && result.status !== mapping.status.toLowerCase()) throw new ShipmentError("invalid_state");
            if (result.status === mapping.status.toLowerCase()) {
              await repository.recordEvent(createShipmentEvent({ id: id(), shipmentId: event.shipmentId, status: mapping.status, providerStatusRaw: event.providerStatus, occurredAt: event.occurredAt ? new Date(event.occurredAt) : clock() }));
            }
          }
          await repository.markWebhookApplied(event.id, clock().toISOString());
          results.push({ id: event.id, status: "APPLIED" });
        } catch {
          const retryCount = event.retryCount + 1;
          const nextAttemptAt = retryCount >= maxWebhookRetries ? null : new Date(clock().getTime() + 60_000 * retryCount).toISOString();
          const failed = await repository.markWebhookFailed(event.id, retryCount, nextAttemptAt);
          results.push({ id: event.id, status: failed?.status ?? "FAILED" });
        }
      }
      return Object.freeze(results);
    }
  });
}


