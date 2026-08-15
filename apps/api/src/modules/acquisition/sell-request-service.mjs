import { randomUUID } from "node:crypto";
import { createSellRequest, createSellerDeclaration, submitSellRequest } from "../../../../../packages/domain/src/acquisition/sell-request.mjs";
import { UserStatus } from "../../../../../packages/domain/src/identity/constants.mjs";

export class SellRequestError extends Error {
  constructor(code) { super(code); this.name = "SellRequestError"; this.code = code; }
}

const createFields = new Set(["categoryId", "productModelId", "contactName", "contactPhone", "contactEmail", "fulfilmentPreference", "ageEstimate", "warrantyRemaining", "repairDeclared", "repairNotes", "boxAvailable", "invoiceAvailable", "ownershipDeclared"]);

export function createSellRequestService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["create", "submit", "findByOwner", "listByOwner"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (identity.status !== UserStatus.ACTIVE) throw new SellRequestError("forbidden");
    return identity;
  }

  function allowed(input) {
    for (const key of Object.keys(input ?? {})) if (!createFields.has(key)) throw new SellRequestError("invalid_input");
    return input ?? {};
  }

  return Object.freeze({
    async create(accessCredential, input) {
      const identity = await actor(accessCredential);
      const fields = allowed(input);
      const now = clock().toISOString();
      let request;
      try {
        request = createSellRequest({
          id: id(),
          userId: identity.userId,
          categoryId: fields.categoryId,
          productModelId: fields.productModelId,
          contactName: fields.contactName,
          contactPhone: fields.contactPhone,
          contactEmail: fields.contactEmail,
          fulfilmentPreference: fields.fulfilmentPreference,
          createdAt: now
        });
      } catch {
        throw new SellRequestError("invalid_input");
      }
      let declaration;
      try {
        declaration = createSellerDeclaration({
          id: id(),
          sellRequestId: request.id,
          ageEstimate: fields.ageEstimate,
          warrantyRemaining: fields.warrantyRemaining,
          repairDeclared: fields.repairDeclared,
          repairNotes: fields.repairNotes,
          boxAvailable: fields.boxAvailable,
          invoiceAvailable: fields.invoiceAvailable,
          ownershipDeclared: fields.ownershipDeclared,
          createdAt: now
        });
      } catch {
        throw new SellRequestError("invalid_input");
      }
      return Object.freeze(await repository.create(request, declaration, now));
    },

    async list(accessCredential) {
      const identity = await actor(accessCredential);
      return Object.freeze(await repository.listByOwner(identity.userId));
    },

    async get(accessCredential, requestId) {
      const identity = await actor(accessCredential);
      const record = await repository.findByOwner(identity.userId, requestId);
      if (!record) throw new SellRequestError("not_found");
      return record;
    },

    async submit(accessCredential, requestId) {
      const identity = await actor(accessCredential);
      const existing = await repository.findByOwner(identity.userId, requestId);
      if (!existing) throw new SellRequestError("not_found");
      try {
        submitSellRequest(existing); // enforces DRAFT-only transition
      } catch {
        throw new SellRequestError("invalid_state");
      }
      const result = await repository.submit(identity.userId, requestId, clock().toISOString());
      if (result.status !== "submitted") throw new SellRequestError("not_found");
      return result.record;
    }
  });
}
