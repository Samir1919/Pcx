import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogImportService, CatalogImportError } from "../src/modules/catalog/catalog-import-service.mjs";

const admin = { userId: "u-admin", status: "ACTIVE", roles: ["ADMIN"], permissions: ["catalog:manage", "pricing:manage"] };

function actor() {
  return async ({ accessCredential }) => {
    if (accessCredential !== "admin-token") throw new CatalogImportError("forbidden");
    return admin;
  };
}

function deps({ categories = [], brands = [] } = {}) {
  const created = { categories: [], brands: [], models: [], prices: [] };
  const categoryNames = new Map(categories.map((c) => [c.name, c.id]));
  const brandNames = new Map(brands.map((b) => [b.name, b.id]));
  const modelSlugs = new Set();
  let nextId = 1000;
  return {
    created,
    authService: { authenticateAccess: actor() },
    catalogCommandService: {
      async createCategory(_a, v) {
        if (categoryNames.has(v.name)) { const err = new Error("conflict"); err.code = "conflict"; throw err; }
        const id = `c-${nextId++}`; categoryNames.set(v.name, id); created.categories.push(v); return { id, ...v };
      },
      async createBrand(_a, v) {
        if (brandNames.has(v.name)) { const err = new Error("conflict"); err.code = "conflict"; throw err; }
        const id = `b-${nextId++}`; brandNames.set(v.name, id); created.brands.push(v); return { id, ...v };
      },
      async createProductModel(_a, v) {
        if (modelSlugs.has(v.slug)) { const err = new Error("conflict"); err.code = "conflict"; throw err; }
        const id = `m-${nextId++}`; modelSlugs.add(v.slug); created.models.push(v); return { id, ...v };
      }
    },
    catalogService: {
      async listCategories() { return { data: [...categoryNames].map(([name, id]) => ({ id, name })) }; },
      async listBrands() { return { data: [...brandNames].map(([name, id]) => ({ id, name })) }; }
    },
    indicativePriceService: {
      async set(_a, v) { created.prices.push(v); return v; }
    }
  };
}

const csv = [
  "category,brand,name,model_code,low_value,high_value",
  "Desktop PC,PCX,PCX Gaming Tower,TOWER-1,40000,120000",
  "Laptop,PCX,PCX Ultrabook 14,UBOOK-14,55000,145000"
].join("\n");

test("importCsv creates categories, brands, models, and quote ranges", async () => {
  const d = deps();
  const service = createCatalogImportService({ ...d, catalogCommandService: d.catalogCommandService, catalogService: d.catalogService, indicativePriceService: d.indicativePriceService, authService: d.authService });
  const result = await service.importCsv("admin-token", csv);
  assert.deepEqual(result, { created: 2, skipped: 0, errors: [] });
  assert.equal(d.created.categories.length, 2);
  assert.equal(d.created.brands.length, 1);
  assert.equal(d.created.models.length, 2);
  assert.equal(d.created.prices.length, 2);
});

test("importCsv is idempotent by product-model slug", async () => {
  const d = deps({ categories: [{ id: "c1", name: "Desktop PC" }, { id: "c2", name: "Laptop" }], brands: [{ id: "b1", name: "PCX" }] });
  const service = createCatalogImportService({ ...d, catalogCommandService: d.catalogCommandService, catalogService: d.catalogService, indicativePriceService: d.indicativePriceService, authService: d.authService });
  const first = await service.importCsv("admin-token", csv);
  assert.equal(first.created, 2);
  const second = await service.importCsv("admin-token", csv);
  assert.equal(second.created, 0);
  assert.equal(second.skipped, 2);
});

test("importCsv rejects a CSV missing the required headers", async () => {
  const d = deps();
  const service = createCatalogImportService({ ...d, catalogCommandService: d.catalogCommandService, catalogService: d.catalogService, indicativePriceService: d.indicativePriceService, authService: d.authService });
  await assert.rejects(() => service.importCsv("admin-token", "name,code\nFoo,F1"), CatalogImportError);
});

test("importCsv requires catalog and pricing permission", async () => {
  const d = deps();
  const service = createCatalogImportService({ ...d, catalogCommandService: d.catalogCommandService, catalogService: d.catalogService, indicativePriceService: d.indicativePriceService, authService: d.authService });
  await assert.rejects(() => service.importCsv("bad-token", csv), (e) => e.code === "forbidden");
});