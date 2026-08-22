import { randomUUID } from "node:crypto";
import { createOwnAddress } from "@pcx/domain";

export class AddressError extends Error {
  constructor(code) { super(code); this.name = "AddressError"; this.code = code; }
}

const editable = new Set(["label", "recipientName", "phone", "addressLine1", "addressLine2", "area", "city", "postalCode", "isDefault"]);

export function createAddressService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["findByOwner", "listByOwner", "create", "update", "delete"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  async function identity(accessCredential) { return authService.authenticateAccess({ accessCredential }); }
  function allowed(input) {
    for (const key of Object.keys(input ?? {})) if (!editable.has(key)) throw new AddressError("invalid_input");
    return input ?? {};
  }

  return Object.freeze({
    async list(accessCredential) {
      const actor = await identity(accessCredential);
      return Object.freeze(await repository.listByOwner(actor.userId));
    },
    async create(accessCredential, input) {
      const actor = await identity(accessCredential);
      let address;
      try { address = createOwnAddress(actor, { id: id(), ...allowed(input), createdAt: clock() }); } catch { throw new AddressError("invalid_input"); }
      const result = await repository.create(address);
      if (result.status !== "created") throw new AddressError("ineligible");
      return result.address;
    },
    async update(accessCredential, addressId, input) {
      const actor = await identity(accessCredential);
      const existing = await repository.findByOwner(actor.userId, addressId);
      if (!existing) throw new AddressError("not_found");
      let address;
      try { address = createOwnAddress(actor, { ...existing, ...allowed(input), id: existing.id, createdAt: existing.createdAt }); } catch { throw new AddressError("invalid_input"); }
      const updated = await repository.update(actor.userId, addressId, address, clock().toISOString());
      if (!updated) throw new AddressError("not_found");
      return updated;
    },
    async delete(accessCredential, addressId) {
      const actor = await identity(accessCredential);
      if (!await repository.delete(actor.userId, addressId)) throw new AddressError("not_found");
    }
  });
}
