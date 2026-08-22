import { randomUUID } from "node:crypto";
import { createIndicativePrice, hasPermission, Permission, toPublicQuoteRange } from "@pcx/domain";

export class IndicativePriceError extends Error {
  constructor(code) { super(code); this.name = "IndicativePriceError"; this.code = code; }
}

const adminFields = new Set(["productModelId", "categoryId", "lowValue", "highValue"]);

export function createIndicativePriceService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["upsertActive", "findActiveByProductModel", "findActiveByCategory", "list"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.PRICING_MANAGE)) throw new IndicativePriceError("forbidden");
    return identity;
  }

  function input(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new IndicativePriceError("invalid_input");
    for (const key of Object.keys(value)) if (!adminFields.has(key)) throw new IndicativePriceError("invalid_input");
    return value;
  }

  return Object.freeze({
    // Admin: set an ACTIVE range for exactly one target; prior ACTIVE row is
    // archived (append-only). Client price is never authoritative — it is
    // validated as positive, low <= high via the domain factory.
    async set(accessCredential, fields) {
      const identity = await actor(accessCredential);
      const value = input(fields);
      let record;
      try {
        record = createIndicativePrice({
          id: id(),
          productModelId: value.productModelId,
          categoryId: value.categoryId,
          lowValue: value.lowValue,
          highValue: value.highValue,
          setBy: identity.userId,
          createdAt: clock()
        });
      } catch {
        throw new IndicativePriceError("invalid_input");
      }
      try {
        return Object.freeze(await repository.upsertActive(record));
      } catch (error) {
        if (error?.code === "23503") throw new IndicativePriceError("invalid_reference");
        if (error?.code === "23514" || error?.code === "23505") throw new IndicativePriceError("conflict");
        throw error;
      }
    },

    // Admin: read the append-only history (active + archived) for review.
    async listAdmin(accessCredential) {
      await actor(accessCredential);
      return Object.freeze({ data: Object.freeze(await repository.list()) });
    },

    // Public: resolve the active quote range with model > category precedence.
    // Returns the safe public projection (never cost or private evidence).
    async quote({ productModelId, categoryId }) {
      const products = await Promise.all([
        productModelId ? repository.findActiveByProductModel(productModelId) : Promise.resolve(null),
        categoryId ? repository.findActiveByCategory(categoryId) : Promise.resolve(null)
      ]);
      const [modelPrice, categoryPrice] = products;
      const resolved = modelPrice ?? categoryPrice ?? null;
      const range = toPublicQuoteRange(resolved);
      return Object.freeze({
        data: Object.freeze({
          range,
          productModelId: productModelId ?? null,
          categoryId: categoryId ?? null
        })
      });
    }
  });
}
