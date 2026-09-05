import { randomUUID } from "node:crypto";
import { advanceSellRequest, createSellRequest, createSellerDeclaration, submitSellRequest } from "@pcx/domain";
import { UserStatus, Role } from "@pcx/domain";
import { hasPermission, Permission } from "@pcx/domain";

export class SellRequestError extends Error {
  constructor(code) { super(code); this.name = "SellRequestError"; this.code = code; }
}

const createFields = new Set(["categoryId", "productModelId", "contactName", "contactPhone", "contactEmail", "fulfilmentPreference", "selectedSpecs", "sellEntry", "buildComponents", "ageEstimate", "warrantyRemaining", "repairDeclared", "repairNotes", "boxAvailable", "invoiceAvailable", "ownershipDeclared"]);

export function createSellRequestService({ authService, repository, indicativePriceService, catalogService = null, id = randomUUID, clock = () => new Date(), notificationEmitter = null }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["create", "submit", "findByOwner", "findById", "transition", "listByOwner", "listAll"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  // Seller-scoped actor: only an active customer may create/submit/list/read
  // their own sell requests. This mirrors the media module's `customer()` check
  // so a non-customer (e.g. an admin) can't create a request they are then
  // unable to complete (media upload rejects non-customers with "forbidden").
  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (identity.status !== UserStatus.ACTIVE || !Array.isArray(identity.roles) || !identity.roles.includes(Role.CUSTOMER)) throw new SellRequestError("forbidden");
    return identity;
  }

  function allowed(input) {
    for (const key of Object.keys(input ?? {})) if (!createFields.has(key)) throw new SellRequestError("invalid_input");
    return input ?? {};
  }

  // Resolve catalog model names for the part/build selections so the admin
  // detail/queue can show a human-readable model instead of a raw UUID. This
  // goes through the catalog module's public read (never a raw cross-module
  // query) and is best-effort so a missing/inactive model degrades to the id.
  async function withModelNames(record) {
    if (!catalogService || typeof catalogService.getProductModel !== "function") return record;
    const nameFor = async (modelId) => {
      if (!modelId) return null;
      try {
        const model = await catalogService.getProductModel(modelId);
        return model?.name ?? null;
      } catch {
        return null;
      }
    };
    const productModelName = await nameFor(record.productModelId);
    const buildComponents = await Promise.all((record.buildComponents ?? []).map(async (component) => {
      const name = await nameFor(component?.productModelId);
      return Object.freeze({ ...component, productModelName: name });
    }));
    return Object.freeze({ ...record, productModelName, buildComponents: Object.freeze(buildComponents) });
  }

  // Server-derived selected specs: the seller picks a variant (a product model
  // for a part, or component models for a build), and the server snapshots that
  // model's published typed specifications as the seller-declared selected_specs.
  // This is the declaration only — never authoritative for price/grade/health —
  // and is resolved server-side (never trusted from the client) so a raw UUID
  // selection becomes human-readable, auditable variant facts.
  async function resolveSelectedSpecs(fields) {
    if (!catalogService || typeof catalogService.getProductModel !== "function") return fields.selectedSpecs ?? [];
    const modelIds = [];
    if (fields.productModelId) modelIds.push(fields.productModelId);
    for (const component of (fields.buildComponents ?? [])) {
      if (component?.productModelId) modelIds.push(component.productModelId);
    }
    if (modelIds.length === 0) return fields.selectedSpecs ?? [];
    const specs = [];
    for (const modelId of modelIds) {
      try {
        const model = await catalogService.getProductModel(modelId);
        for (const spec of (model?.specifications ?? [])) {
          if (spec.value == null) continue;
          // JSON specifications are not scalar; the seller-declared selected
          // specs contract only accepts scalar values.
          if (spec.dataType === "JSON") continue;
          specs.push({ key: spec.key, value: spec.value });
        }
      } catch {
        // best-effort: a missing model degrades to no resolved specs.
      }
    }
    return specs.length > 0 ? specs : (fields.selectedSpecs ?? []);
  }

  return Object.freeze({
    async create(accessCredential, input) {
      const identity = await actor(accessCredential);
      const fields = allowed(input);
      const now = clock().toISOString();
      const selectedSpecs = await resolveSelectedSpecs(fields);
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
          selectedSpecs,
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
      const records = await repository.listAll();
      const resolved = await Promise.all(records.map((record) => withModelNames(record)));
      return Object.freeze({ data: Object.freeze(resolved) });
    },

    async get(accessCredential, requestId) {
      const identity = await actor(accessCredential);
      const record = await repository.findByOwner(identity.userId, requestId);
      if (!record) throw new SellRequestError("not_found");
      return record;
    },

    // Admin detail read: full record for any request (non-owner-scoped), gated
    // by acquisition/pricing audit permission. Used by the admin detail view.
    async getAdmin(accessCredential, requestId) {
      const identity = await authService.authenticateAccess({ accessCredential });
      if (!hasPermission(identity, Permission.PRICING_MANAGE) && !hasPermission(identity, Permission.ACQUISITION_PAYMENT_MANAGE)) throw new SellRequestError("forbidden");
      const record = await repository.findById(requestId);
      if (!record) throw new SellRequestError("not_found");
      return withModelNames(record);
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
      if (notificationEmitter && typeof notificationEmitter.emit === "function") {
        try {
          await notificationEmitter.emit({
            notificationType: "SELL_REQUEST_SUBMITTED",
            userId: identity.userId,
            channel: "EMAIL",
            referenceType: "sell_request",
            referenceId: result.record.id,
            payloadSnapshot: { publicRequestNo: result.record.publicRequestNo }
          });
        } catch { /* best-effort; notification must never fail submission */ }
      }
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
