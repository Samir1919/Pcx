import { randomUUID } from "node:crypto";
import { advanceSellRequest, createSellRequest, createSellerDeclaration, submitSellRequest } from "../../../../../packages/domain/src/acquisition/sell-request.mjs";
import { UserStatus } from "../../../../../packages/domain/src/identity/constants.mjs";
import { hasPermission, Permission } from "../../../../../packages/domain/src/index.mjs";

export class SellRequestError extends Error {
  constructor(code) { super(code); this.name = "SellRequestError"; this.code = code; }
}

const createFields = new Set(["categoryId", "productModelId", "contactName", "contactPhone", "contactEmail", "fulfilmentPreference", "selectedSpecs", "sellEntry", "buildComponents", "ageEstimate", "warrantyRemaining", "repairDeclared", "repairNotes", "boxAvailable", "invoiceAvailable", "ownershipDeclared"]);

export function createSellRequestService({ authService, repository, indicativePriceService, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["create", "submit", "findByOwner", "findById", "transition", "listByOwner", "listAll"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

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
      // Contact details are reused from the authenticated identity whenever
      // present, so the sell form never re-asks for them after sign-in. The
      // form-provided values only act as a fallback for incomplete identities.
      const contactName = (identity.fullName ?? fields.contactName) || undefined;
      const contactPhone = (identity.phone ?? fields.contactPhone) || undefined;
      const contactEmail = identity.email ?? fields.contactEmail ?? undefined;
      let request;
      try {
        request = createSellRequest({
          id: id(),
          userId: identity.userId,
          categoryId: fields.categoryId,
          productModelId: fields.productModelId,
          contactName,
          contactPhone,
          contactEmail,
          fulfilmentPreference: fields.fulfilmentPreference,
          selectedSpecs: fields.selectedSpecs,
          sellEntry: fields.sellEntry,
          buildComponents: fields.buildComponents,
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
      const record = await repository.create(request, declaration, now);
      // The estimated range is resolved from the server-owned indicative price
      // service (admin-set, append-only, model > category precedence). It is a
      // read-only projection, never a final offer, and never a client value.
      let estimatedRange = null;
      if (indicativePriceService) {
        try {
          const quote = await indicativePriceService.quote({ productModelId: fields.productModelId ?? null, categoryId: fields.categoryId ?? null });
          estimatedRange = quote?.data?.range ?? null;
        } catch {
          estimatedRange = null;
        }
      }
      return Object.freeze({ ...record, estimatedRange });
    },

    async list(accessCredential) {
      const identity = await actor(accessCredential);
      return Object.freeze(await repository.listByOwner(identity.userId));
    },

    async listAdmin(accessCredential) {
      const identity = await authService.authenticateAccess({ accessCredential });
      if (!hasPermission(identity, Permission.PRICING_MANAGE) && !hasPermission(identity, Permission.ACQUISITION_PAYMENT_MANAGE)) throw new SellRequestError("forbidden");
      return Object.freeze({ data: Object.freeze(await repository.listAll()) });
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
    },

    // Admin-only, server-owned lifecycle transition along the canonical graph.
    // The target status is never client-authoritative: it is validated against
    // SellRequestTransitions, then applied atomically in the repository.
    async transition(accessCredential, requestId, toStatus) {
      const identity = await authService.authenticateAccess({ accessCredential });
      if (!hasPermission(identity, Permission.PRICING_MANAGE) && !hasPermission(identity, Permission.ACQUISITION_PAYMENT_MANAGE)) throw new SellRequestError("forbidden");
      const existing = await repository.findById(requestId);
      if (!existing) throw new SellRequestError("not_found");
      let next;
      try {
        next = advanceSellRequest(existing, toStatus, { at: clock() });
      } catch {
        throw new SellRequestError("invalid_state");
      }
      const result = await repository.transition(requestId, existing.status, next.status, next.submittedAt, next.updatedAt);
      if (result.status !== "ok") throw new SellRequestError("not_found");
      return result.record;
    }
  });
}
