import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createShipment, createShipmentEvent, markShipped, markDelivered, markReturned } from "../../../../../packages/domain/src/logistics/shipment.mjs";
import { createSandboxCourier, hasPermission, Permission } from "../../../../../packages/domain/src/index.mjs";


export class ShipmentError extends Error {
  constructor(code) { super(code); this.name = "ShipmentError"; this.code = code; }
}

const createFields = new Set(["orderId", "courier", "packageType", "weight", "codAmount", "shippingCharge"]);
// trackingId is intentionally NOT client-authoritative: it is derived from the
// injected courier so the server owns the logistics fact.

export function createShipmentService({ authService, repository, id = randomUUID, clock = () => new Date(), courier = createSandboxCourier(), webhookSecret = null }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["create", "markShipped", "markDelivered", "markReturned", "recordEvent"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);
  if (!courier || typeof courier.createShipment !== "function") throw new TypeError("courier.createShipment is required");
  if (webhookSecret != null && typeof webhookSecret !== "string") throw new TypeError("webhookSecret must be a string");



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
    // timing-safe comparison. A provider status that maps to a terminal
    // transition advances the shipment; a repeated webhook for an already-final
    // state is a no-op (idempotent), not an error.
    async handleWebhook({ signature, shipmentId, providerStatus, occurredAt = clock() }) {
      if (!verifySecret(signature)) throw new ShipmentError("unauthorized");
      if (typeof shipmentId !== "string" || shipmentId.length === 0) throw new ShipmentError("invalid_input");
      const mapping = providerTransitions[providerStatus];
      if (!mapping) {
        // Informational provider status: record the event without a state change.
        await repository.recordEvent(createShipmentEvent({ id: id(), shipmentId, status: "SHIPPED", providerStatusRaw: providerStatus ?? null, occurredAt }));
        return { status: "recorded", shipmentId };
      }
      const result = await repository[mapping.transition](shipmentId, occurredAt instanceof Date ? occurredAt.toISOString() : occurredAt);
      if (result.status === "not_deliverable" || result.status === "not_returnable") {
        // Already in a final state: idempotent no-op.
        return { status: "noop", shipmentId };
      }
      if (result.status !== mapping.status.toLowerCase()) throw new ShipmentError("invalid_state");
      await repository.recordEvent(createShipmentEvent({ id: id(), shipmentId, status: mapping.status, providerStatusRaw: providerStatus, occurredAt }));
      return { status: "applied", shipmentId, record: result.record };
    }
  });
}

