import { randomUUID } from "node:crypto";
import { createShipment, createShipmentEvent, markShipped, markDelivered } from "../../../../../packages/domain/src/logistics/shipment.mjs";
import { hasPermission, Permission } from "../../../../../packages/domain/src/index.mjs";

export class ShipmentError extends Error {
  constructor(code) { super(code); this.name = "ShipmentError"; this.code = code; }
}

const createFields = new Set(["orderId", "courier", "trackingId", "packageType", "weight", "codAmount", "shippingCharge"]);

export function createShipmentService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["create", "markShipped", "markDelivered", "recordEvent"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.INVENTORY_MANAGE) && !hasPermission(identity, Permission.SYSTEM_CONFIGURE)) throw new ShipmentError("forbidden");
    return identity;
  }

  function exact(input, allowed) {
    for (const key of Object.keys(input ?? {})) if (!allowed.has(key)) throw new ShipmentError("invalid_input");
    return input ?? {};
  }

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

    async ship(accessCredential, shipmentId, trackingId) {
      await actor(accessCredential);
      const result = await repository.markShipped(shipmentId, trackingId, clock().toISOString());
      if (result.status !== "shipped") throw new ShipmentError("invalid_state");
      await repository.recordEvent(createShipmentEvent({ id: id(), shipmentId, status: "SHIPPED", providerStatusRaw: null, occurredAt: clock() }));
      return result.record;
    },

    async deliver(accessCredential, shipmentId) {
      await actor(accessCredential);
      const result = await repository.markDelivered(shipmentId, clock().toISOString());
      if (result.status !== "delivered") throw new ShipmentError("invalid_state");
      await repository.recordEvent(createShipmentEvent({ id: id(), shipmentId, status: "DELIVERED", occurredAt: clock() }));
      return result.record;
    }
  });
}
