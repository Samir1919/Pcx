import assert from "node:assert/strict";
import test from "node:test";
import {
  archiveCatalogRecord,
  CatalogStatus,
  createBrand,
  createCategory,
  createProductModel
} from "../src/index.mjs";

const createdAt = "2026-08-16T02:00:00.000Z";

test("category and brand records validate and own active lifecycle defaults", () => {
  const category = createCategory({ id: "category-gpu", name: " GPU ", slug: "graphics-card", sortOrder: 2, createdAt });
  const brand = createBrand({ id: "brand-msi", name: "MSI", slug: "msi", createdAt, status: CatalogStatus.ARCHIVED });

  assert.equal(category.name, "GPU");
  assert.equal(category.status, CatalogStatus.ACTIVE);
  assert.equal(category.parentId, null);
  assert.equal(brand.status, CatalogStatus.ACTIVE);
  assert.equal(Object.isFrozen(category), true);
  assert.throws(() => createCategory({ id: "x", name: "X", slug: "Not Canonical" }), /canonical/);
  assert.throws(() => createCategory({ id: "x", name: "X", slug: "x", sortOrder: -1 }), /sortOrder/);
});

test("product model contains generic catalog identity and normalized aliases", () => {
  const model = createProductModel({
    id: "model-3060",
    categoryId: "category-gpu",
    brandId: "brand-msi",
    name: "RTX 3060 Gaming X 12GB",
    slug: "msi-rtx-3060-gaming-x-12gb",
    modelCode: " RTX3060GX12 ",
    searchAliases: [" 3060 ", "RTX 3060", "rtx 3060"],
    createdAt
  });

  assert.equal(model.modelCode, "RTX3060GX12");
  assert.deepEqual(model.searchAliases, ["3060", "rtx 3060"]);
  assert.equal(Object.isFrozen(model.searchAliases), true);
  assert.equal(Object.hasOwn(model, "serialNumber"), false);
});

test("product model rejects physical-item and commercial-sensitive fields", () => {
  const base = {
    id: "model-1",
    categoryId: "category-1",
    brandId: "brand-1",
    name: "Model 1",
    slug: "model-1"
  };

  for (const [field, value] of [
    ["serialNumber", "SN-1"],
    ["healthScore", 95],
    ["conditionGrade", "A"],
    ["acquisitionCost", 20000],
    ["sellingPrice", 25000],
    ["warranty", { days: 30 }]
  ]) {
    assert.throws(() => createProductModel({ ...base, [field]: value }), /not ProductModel/);
  }
  assert.throws(() => createProductModel({ ...base, categoryId: "" }), /categoryId/);
  assert.throws(() => createProductModel({ ...base, brandId: "" }), /brandId/);
});

test("archive transition preserves historical identity and is idempotent", () => {
  const brand = createBrand({ id: "brand-1", name: "Brand", slug: "brand", createdAt });
  const archived = archiveCatalogRecord(brand, { archivedAt: "2026-08-16T03:00:00.000Z" });

  assert.equal(archived.id, brand.id);
  assert.equal(archived.createdAt, brand.createdAt);
  assert.equal(archived.status, CatalogStatus.ARCHIVED);
  assert.equal(archived.archivedAt, "2026-08-16T03:00:00.000Z");
  assert.equal(archiveCatalogRecord(archived), archived);
  assert.equal(brand.status, CatalogStatus.ACTIVE);
});
