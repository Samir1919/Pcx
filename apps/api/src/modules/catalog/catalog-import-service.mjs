import { randomUUID } from "node:crypto";
import { hasPermission, Permission } from "@pcx/domain";

export class CatalogImportError extends Error {
  constructor(code) { super(code); this.name = "CatalogImportError"; this.code = code; }
}

function slugify(name) {
  return String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Minimal, dependency-free CSV parse for the documented import format (simple
// columns, no embedded newlines). The CSV is authored by an operator, not free
// user text, so a line/column split is sufficient and avoids a parser dependency.
function parseCsv(text) {
  if (typeof text !== "string") throw new CatalogImportError("invalid_input");
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length < 2) throw new CatalogImportError("invalid_input");
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  for (const required of ["category", "brand", "name"]) if (!headers.includes(required)) throw new CatalogImportError("invalid_input");
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });
    return row;
  });
}

export function createCatalogImportService({ authService, catalogCommandService, catalogService, indicativePriceService, id = randomUUID }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const [name, dep, method] of [
    ["catalogCommandService", catalogCommandService, "createCategory"],
    ["catalogService", catalogService, "listCategories"],
    ["indicativePriceService", indicativePriceService, "set"]
  ]) if (!dep || typeof dep[method] !== "function") throw new TypeError(`${name}.${method} is required`);

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.CATALOG_MANAGE) || !hasPermission(identity, Permission.PRICING_MANAGE)) throw new CatalogImportError("forbidden");
    return identity;
  }

  async function resolveIdByName(accessCredential, kind, name) {
    const listFn = kind === "category" ? catalogService.listCategories : catalogService.listBrands;
    const createFn = kind === "category" ? catalogCommandService.createCategory : catalogCommandService.createBrand;
    const key = name.toLowerCase();
    const existing = (await listFn()).data.find((r) => r.name.toLowerCase() === key);
    if (existing) return existing.id;
    try {
      const created = await createFn(accessCredential, { name, slug: slugify(name) });
      return created.id;
    } catch (error) {
      if (error?.code !== "conflict") throw error;
      // Lost a race: another import created it. Re-look it up.
      const retry = (await listFn()).data.find((r) => r.name.toLowerCase() === key);
      if (retry) return retry.id;
      throw error;
    }
  }

  return Object.freeze({
    // Bulk import product models + indicative quote ranges from a CSV:
    //   category,brand,name,model_code,low_value,high_value
    // Missing categories/brands are created; existing product models (by slug)
    // are skipped, so re-running the same CSV is idempotent.
    async importCsv(accessCredential, csvText) {
      await actor(accessCredential);
      const rows = parseCsv(csvText);
      const summary = { created: 0, skipped: 0, errors: [] };

      for (const row of rows) {
        try {
          if (!row.name) throw new CatalogImportError("invalid_input");
          const categoryId = await resolveIdByName(accessCredential, "category", row.category);
          const brandId = await resolveIdByName(accessCredential, "brand", row.brand);
          const slug = slugify(row.name);
          if (!slug) throw new CatalogImportError("invalid_input");

          let modelId;
          try {
            const model = await catalogCommandService.createProductModel(accessCredential, {
              categoryId,
              brandId,
              name: row.name,
              slug,
              modelCode: row.model_code || null
            });
            modelId = model.id;
          } catch (error) {
            if (error?.code === "conflict") { summary.skipped++; continue; } // already imported
            throw error;
          }

          if (row.low_value !== "" && row.high_value !== "") {
            await indicativePriceService.set(accessCredential, {
              productModelId: modelId,
              lowValue: Number(row.low_value),
              highValue: Number(row.high_value)
            });
          }
          summary.created++;
        } catch (error) {
          summary.errors.push({ name: row?.name ?? null, message: error?.message ?? "import failed" });
        }
      }
      return Object.freeze(summary);
    }
  });
}