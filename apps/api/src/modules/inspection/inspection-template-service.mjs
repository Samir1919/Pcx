import { randomUUID } from "node:crypto";
import { createInspectionTemplate, createInspectionTemplateItem, assertUniqueInspectionTemplateItems } from "@pcx/domain";
import { hasPermission, Permission } from "@pcx/domain";

export class InspectionTemplateError extends Error {
  constructor(code) { super(code); this.name = "InspectionTemplateError"; this.code = code; }
}

const createFields = new Set(["categoryId", "name", "version", "items"]);
const itemFields = new Set(["code", "label", "resultType", "unit", "isMandatory", "isCritical", "sortOrder"]);

export function createInspectionTemplateService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["create", "findById", "listByCategory", "listItems"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.SYSTEM_CONFIGURE)) throw new InspectionTemplateError("forbidden");
    return identity;
  }

  function exact(input, allowed) {
    for (const key of Object.keys(input ?? {})) if (!allowed.has(key)) throw new InspectionTemplateError("invalid_input");
    return input ?? {};
  }

  return Object.freeze({
    async create(accessCredential, input) {
      await actor(accessCredential);
      const fields = exact(input, createFields);
      if (!Array.isArray(fields.items)) throw new InspectionTemplateError("invalid_input");
      const now = clock().toISOString();
      let template;
      try {
        template = createInspectionTemplate({ id: id(), categoryId: fields.categoryId, name: fields.name, version: fields.version, createdAt: now });
      } catch {
        throw new InspectionTemplateError("invalid_input");
      }
      let items;
      try {
        items = fields.items.map((value) => {
          const data = exact(value, itemFields);
          return createInspectionTemplateItem({ id: id(), templateId: template.id, code: data.code, label: data.label, resultType: data.resultType, unit: data.unit, isMandatory: data.isMandatory, isCritical: data.isCritical, sortOrder: data.sortOrder, createdAt: now });
        });
        assertUniqueInspectionTemplateItems(items);
      } catch {
        throw new InspectionTemplateError("invalid_input");
      }
      try {
        return Object.freeze(await repository.create(template, items));
      } catch (error) {
        if (error?.code === "23505") throw new InspectionTemplateError("conflict");
        if (error?.code === "23503") throw new InspectionTemplateError("invalid_reference");
        throw error;
      }
    },

    async list(accessCredential, categoryId) {
      await actor(accessCredential);
      return Object.freeze(await repository.listByCategory(categoryId));
    },

    async get(accessCredential, templateId) {
      await actor(accessCredential);
      const template = await repository.findById(templateId);
      if (!template) throw new InspectionTemplateError("not_found");
      return Object.freeze({ ...template, items: Object.freeze(await repository.listItems(templateId)) });
    }
  });
}
