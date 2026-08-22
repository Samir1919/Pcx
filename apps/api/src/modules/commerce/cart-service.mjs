import { randomUUID } from "node:crypto";
import { CartStatus, createCart, createCartItem, Role } from "@pcx/domain";

export class CartError extends Error {
  constructor(code) { super(code); this.name = "CartError"; this.code = code; }
}

const itemFields = new Set(["inventoryItemId", "listingId"]);

export function createCartService({ authService, listingRepository, cartRepository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["findPublishedByInventoryItem"]) if (!listingRepository || typeof listingRepository[method] !== "function") throw new TypeError(`listingRepository.${method} is required`);
  for (const method of ["findActiveByUser", "createCart", "addItem", "listItems", "removeItem"]) if (!cartRepository || typeof cartRepository[method] !== "function") throw new TypeError(`cartRepository.${method} is required`);

  function exact(input, allowed) {
    for (const key of Object.keys(input ?? {})) if (!allowed.has(key)) throw new CartError("invalid_input");
    return input ?? {};
  }

  async function customer(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (identity.status !== "ACTIVE" || !Array.isArray(identity.roles) || !identity.roles.includes(Role.CUSTOMER)) throw new CartError("forbidden");
    return identity;
  }

  async function activeCartFor(identity) {
    const existing = await cartRepository.findActiveByUser(identity.userId);
    if (existing) return existing;
    const now = clock().toISOString();
    return cartRepository.createCart(createCart({ id: id(), userId: identity.userId, createdAt: now }), now);
  }

  return Object.freeze({
    // Add an item to the customer's ACTIVE cart. The price snapshot is
    // server-derived from the PUBLISHED listing, never client-authoritative.
    async add(accessCredential, input) {
      const identity = await customer(accessCredential);
      const fields = exact(input, itemFields);
      const listing = await listingRepository.findPublishedByInventoryItem(fields.inventoryItemId);
      if (!listing) throw new CartError("not_found");
      const cart = await activeCartFor(identity);
      const now = clock().toISOString();
      const item = createCartItem({
        id: id(),
        cartId: cart.id,
        inventoryItemId: fields.inventoryItemId,
        listingId: fields.listingId ?? listing.id,
        priceSnapshot: listing.price ?? null,
        createdAt: now
      });
      return Object.freeze(await cartRepository.addItem(item, now));
    },

    async get(accessCredential) {
      const identity = await customer(accessCredential);
      const cart = await cartRepository.findActiveByUser(identity.userId);
      if (!cart) return Object.freeze({ cart: null, items: Object.freeze([]) });
      const items = await cartRepository.listItems(cart.id);
      return Object.freeze({ cart, items: Object.freeze(items) });
    },

    async remove(accessCredential, inventoryItemId) {
      const identity = await customer(accessCredential);
      const cart = await cartRepository.findActiveByUser(identity.userId);
      if (!cart) throw new CartError("not_found");
      const removed = await cartRepository.removeItem(cart.id, inventoryItemId);
      if (!removed) throw new CartError("not_found");
      return { removed: true };
    }
  });
}
