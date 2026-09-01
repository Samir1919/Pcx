import { randomUUID } from "node:crypto";
import { archiveWarrantyPolicy, createWarrantyPolicy, hasPermission, Permission } from "@pcx/domain";

export class WarrantyPolicyError extends Error {
  constructor(code) { super(code); this.name = "WarrantyPolicyError"; this.code = code; }
}

const createFields = new Set(["name", "durationDays", "coverageSummary", "terms"]);

export function createWarrantyPolicyService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["create", "list", "findById", "archive"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.SYSTEM_CONFIGURE)) throw new WarrantyPolicyError("forbidden");
    return identity;
  }

  function exact(input, allowed) {
    for (const key of Object.keys(input ?? {})) if (!allowed.has(key)) throw new WarrantyPolicyError("invalid_input");
    return input ?? {};
  }

  return Object.freeze({
    // Author a reusable coverage policy. SYSTEM_CONFIGURE only.
    async create(accessCredential, input) {
      await actor(accessCredential);
      const fields = exact(input, createFields);
      let record;
      try {
        record = createWarrantyPolicy({ id: id(), ...fields, createdAt: clock() });
      } catch {
        throw new WarrantyPolicyError("invalid_input");
      }
      try {
        return Object.freeze(await repository.create(record));
      } catch (error) {
        if (error?.code === "23505") throw new WarrantyPolicyError("conflict");
        throw error;
      }
    },

    async list(accessCredential) {
      await actor(accessCredential);
      return Object.freeze({ data: Object.freeze(await repository.list()) });
    },

    // Archive (never delete) a policy. Warranties already issued keep their
    // snapshot, so archiving only stops NEW warranties from referencing it.
    async archive(accessCredential, policyId) {
      await actor(accessCredential);
      const existing = await repository.findById(policyId);
      if (!existing) throw new WarrantyPolicyError("not_found");
      const archived = archiveWarrantyPolicy(existing, { archivedAt: clock() });
      const saved = await repository.archive(policyId, archived.archivedAt);
      if (!saved) throw new WarrantyPolicyError("invalid_state");
      return Object.freeze(saved);
    }
  });
}
