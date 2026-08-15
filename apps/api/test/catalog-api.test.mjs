import assert from "node:assert/strict";
import test from "node:test";
import { createBrand, createCategory, createProductModel, archiveCatalogRecord } from "../../../packages/domain/src/index.mjs";
import { createCatalogService } from "../src/modules/catalog/catalog-service.mjs";
import { createRequestHandler } from "../src/server.mjs";

const createdAt = "2026-08-16T06:00:00.000Z";
const category = createCategory({ id: "gpu", name: "GPU", slug: "gpu", createdAt });
const archivedCategory = archiveCatalogRecord(createCategory({ id: "cpu", name: "CPU", slug: "cpu", createdAt }));
const brand = createBrand({ id: "msi", name: "MSI", slug: "msi", createdAt });
const model = {
  ...createProductModel({ id: "rtx-3060", categoryId: "gpu", brandId: "msi", name: "RTX 3060", slug: "rtx-3060", searchAliases: ["3060"], createdAt }),
  serialNumber: "SECRET-SERIAL",
  acquisitionCost: 22000,
  healthScore: 94,
  technicianNotes: "PRIVATE"
};

function service(overrides = {}) {
  return createCatalogService({
    repository: {
      async listCategories() { return [category, archivedCategory]; },
      async listBrands() { return { records: [brand], nextCursor: "brand-next" }; },
      async listProductModels() { return { records: [model], nextCursor: null }; },
      async findProductModelById(id) { return id === model.id ? model : null; },
      ...overrides
    }
  });
}

async function invoke(url, { method = "GET", catalogService = service(), headers = {} } = {}) {
  const result = { headers: {} };
  const response = {
    setHeader(name, value) { result.headers[name] = value; },
    writeHead(status) { result.status = status; return response; },
    end(body) { result.body = JSON.parse(body); return response; }
  };
  await createRequestHandler({ catalogService })({ url, method, headers }, response);
  return result;
}

test("catalog lists expose active safe DTOs and pagination metadata", async () => {
  const categories = await invoke("/api/v1/categories");
  const brands = await invoke("/api/v1/brands");
  const models = await invoke("/api/v1/product-models?categoryId=gpu&limit=10&sort=name_desc");
  assert.deepEqual(categories.body.data.map(({ id }) => id), ["gpu"]);
  assert.equal(brands.body.meta.nextCursor, "brand-next");
  assert.equal(models.status, 200);
  assert.equal(models.body.data[0].serialNumber, undefined);
  assert.equal(models.body.data[0].acquisitionCost, undefined);
  assert.equal(models.body.data[0].healthScore, undefined);
  assert.equal(models.body.data[0].technicianNotes, undefined);
});

test("product model detail uses safe DTO and missing records return request-aware 404", async () => {
  const found = await invoke("/api/v1/product-models/rtx-3060");
  const missing = await invoke("/api/v1/product-models/missing", { headers: { "x-request-id": "request-404" } });
  assert.deepEqual(found.body.data.searchAliases, ["3060"]);
  assert.equal(Object.hasOwn(found.body.data, "serialNumber"), false);
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.requestId, "request-404");
});

test("catalog query allow-list, method, and availability failures are predictable", async () => {
  assert.equal((await invoke("/api/v1/product-models?unknown=value")).status, 400);
  assert.equal((await invoke("/api/v1/product-models?q=a&q=b")).status, 400);
  assert.equal((await invoke(`/api/v1/product-models?q=${"x".repeat(101)}`)).status, 400);
  assert.equal((await invoke("/api/v1/product-models?limit=51")).status, 400);
  assert.equal((await invoke("/api/v1/product-models?sort=cost_desc")).status, 400);
  assert.equal((await invoke("/api/v1/categories?status=ARCHIVED")).status, 400);
  assert.equal((await invoke("/api/v1/product-models/%E0%A4%A")).status, 400);
  assert.equal((await invoke("/api/v1/brands", { method: "POST" })).status, 405);
  assert.equal((await invoke("/api/v1/categories", { catalogService: null })).status, 503);
});

test("unexpected repository errors do not leak internal messages", async () => {
  const catalogService = service({ async listBrands() { throw new Error("database password secret"); } });
  const response = await invoke("/api/v1/brands", { catalogService });
  assert.equal(response.status, 500);
  assert.equal(response.body.error.message, "Unexpected server error");
  assert.equal(JSON.stringify(response.body).includes("database password"), false);
  const invalidContract = await invoke("/api/v1/categories", { catalogService: service({ async listCategories() { return { records: null }; } }) });
  assert.equal(invalidContract.status, 500);
});
