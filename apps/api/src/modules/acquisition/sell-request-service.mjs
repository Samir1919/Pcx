import { randomUUID } from "node:crypto";
import { createSellRequest, createSellerDeclaration, submitSellRequest } from "../../../../../packages/domain/src/acquisition/sell-request.mjs";
import { UserStatus } from "../../../../../packages/domain/src/identity/constants.mjs";
import { hasPermission, Permission } from "../../../../../packages/domain/src/index.mjs";

export class SellRequestError extends Error {
  constructor(code) { super(code); this.name = "SellRequestError"; this.code = code; }
}

const createFields = new Set(["categoryId", "productModelId", "contactName", "contactPhone", "contactEmail", "fulfilmentPreference", "selectedSpecs", "sellEntry", "buildComponents", "ageEstimate", "warrantyRemaining", "repairDeclared", "repairNotes", "boxAvailable", "invoiceAvailable", "ownershipDeclared"]);

// PLACEHOLDER preliminary estimated ranges per launch category. This is the
// documented rule-engine interface required by the approved backlog (E3):
// "estimated-range placeholder/rule engine interface". It is intentionally a
// flat placeholder, NOT a pricing policy. Estimated ranges are never a final
// offer; the final offer is always produced only from physical inspection by an
// authorized user via the acquisition (valuation/offer) module.
const PLACEHOLDER_RANGES = Object.freeze({
  ["80000000-0000-0000-0000-000000000001"]: Object.freeze({ low: 12000, high: 180000 }), // Desktop PC
  ["80000000-0000-0000-0000-000000000002"]: Object.freeze({ low: 10000, high: 160000 }), // Laptop
  ["80000000-0000-0000-0000-000000000003"]: Object.freeze({ low: 6000, high: 60000 }),   // GPU
  ["80000000-0000-0000-0000-000000000004"]: Object.freeze({ low: 4000, high: 40000 }),   // CPU
  ["80000000-0000-0000-0000-000000000005"]: Object.freeze({ low: 2500, high: 25000 }),   // Motherboard
  ["80000000-0000-0000-0000-000000000006"]: Object.freeze({ low: 1500, high: 15000 }),   // RAM
  ["80000000-0000-0000-0000-000000000007"]: Object.freeze({ low: 1000, high: 20000 }),   // Storage
  ["80000000-0000-0000-0000-000000000008"]: Object.freeze({ low: 800, high: 12000 }),    // PSU
  ["80000000-0000-0000-0000-000000000009"]: Object.freeze({ low: 2500, high: 25000 }),   // Monitor
  ["80000000-0000-0000-0000-000000000010"]: Object.freeze({ low: 300, high: 8000 })      // Accessory
});

function estimatedRangeFor(categoryId) {
  const range = PLACEHOLDER_RANGES[categoryId];
  if (!range) return null;
  return Object.freeze({
    low: range.low,
    high: range.high,
    basis: "placeholder-rule-engine",
    disclaimer: "Estimated market range, not a final offer. The final offer is determined only after physical inspection."
  });
}

export function createSellRequestService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["create", "submit", "findByOwner", "listByOwner", "listAll"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

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
      return Object.freeze({ ...record, estimatedRange: estimatedRangeFor(fields.categoryId) });
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
    }
  });
}
