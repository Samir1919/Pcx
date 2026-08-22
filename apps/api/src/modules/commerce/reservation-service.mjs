import { randomUUID } from "node:crypto";
import { createReservation, convertReservation } from "../../../../../packages/domain/src/commerce/reservation.mjs";
import { Role } from "../../../../../packages/domain/src/index.mjs";

export class ReservationError extends Error {
  constructor(code) { super(code); this.name = "ReservationError"; this.code = code; }
}

// Client input may supply cart/inventory context, but never the expiry window:
// reservedUntil is always derived server-side so a customer cannot lock an item
// until an arbitrary far-future date.
const createFields = new Set(["inventoryItemId", "cartId"]);

export function createReservationService({ authService, listingRepository, reservationRepository, id = randomUUID, clock = () => new Date(), reservationWindowMs = 15 * 60 * 1000 }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["findPublishedByInventoryItem"]) if (!listingRepository || typeof listingRepository[method] !== "function") throw new TypeError(`listingRepository.${method} is required`);
  for (const method of ["create", "convert", "findById", "findActiveByItem", "expireDue"]) if (!reservationRepository || typeof reservationRepository[method] !== "function") throw new TypeError(`reservationRepository.${method} is required`);

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (identity.status !== "ACTIVE" || !Array.isArray(identity.roles) || !identity.roles.includes(Role.CUSTOMER)) throw new ReservationError("forbidden");
    return identity;
  }

  function exact(input, allowed) {
    for (const key of Object.keys(input ?? {})) if (!allowed.has(key)) throw new ReservationError("invalid_input");
    return input ?? {};
  }

  return Object.freeze({
    async create(accessCredential, input) {
      const identity = await actor(accessCredential);
      const fields = exact(input, createFields);
      // Verify the item has a PUBLISHED listing before reserving.
      const item = await listingRepository.findPublishedByInventoryItem(fields.inventoryItemId);
      if (!item) throw new ReservationError("not_found");

      const now = clock();
      const reserved = new Date(now.getTime() + reservationWindowMs);
      let record;
      try {
        record = createReservation({ id: id(), inventoryItemId: fields.inventoryItemId, cartId: fields.cartId, reservedByUserId: identity.userId, reservedUntil: reserved, createdAt: now });
      } catch {
        throw new ReservationError("invalid_input");
      }
      try {
        return Object.freeze(await reservationRepository.create(record));
      } catch (error) {
        if (error?.code === "23505") throw new ReservationError("item_unavailable");
        if (error?.code === "23503") throw new ReservationError("invalid_reference");
        throw error;
      }
    },

    async convert(accessCredential, reservationId) {
      await actor(accessCredential);
      const existing = await reservationRepository.findById(reservationId);
      if (!existing) throw new ReservationError("not_found");
      try {
        convertReservation(existing, { convertedAt: clock() });
      } catch {
        throw new ReservationError("invalid_state");
      }
      const result = await reservationRepository.convert(reservationId, clock().toISOString());
      if (result.status !== "converted") throw new ReservationError("invalid_state");
      return result.record;
    },

    async active(accessCredential, inventoryItemId) {
      await actor(accessCredential);
      const record = await reservationRepository.findActiveByItem(inventoryItemId, clock().toISOString());
      return record;
    },

    // Background job entry point: no customer identity is required because this
    // is a clock-driven, state-only transition that releases expired holds.
    async expireDue() {
      const records = await reservationRepository.expireDue(clock().toISOString());
      return Object.freeze(records.map((record) => Object.freeze(record)));
    }
  });
}
