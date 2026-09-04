import assert from "node:assert/strict";
import test from "node:test";
import { CatalogCommandError, createCatalogCommandService } from "../src/modules/catalog/catalog-command-service.mjs";

function fixture(roles = ["ADMIN"]) {
  let sequence = 0;
  const calls = [];
  const service = createCatalogCommandService({
    authService: { async authenticateAccess() { return { userId: "actor-1", status: "ACTIVE", roles }; } },
    repository: { async create(...input) { calls.push(["create", ...input]); return input[0]; }, async find(kind,id) { calls.push(["find",kind,id]); return kind === "brand" ? { id, name:"Old", slug:"old", status:"ACTIVE", createdAt:"2026-08-15T00:00:00.000Z" } : kind === "category" ? { id, name:"Old", slug:"old", status:"ACTIVE", sortOrder:0, createdAt:"2026-08-15T00:00:00.000Z" } : null; }, async update(...input) { calls.push(["update",...input]); return true; }, async archive(...input) { calls.push(["archive", ...input]); return true; }, async setStatus(...input) { calls.push(["setStatus", ...input]); return true; }, async listCategories(...input) { calls.push(["listCategories", ...input]); return [{ id: "c1", name: "GPU", slug: "gpu", status: "ACTIVE", sortOrder: 1 }]; }, async remove(...input) { calls.push(["remove", ...input]); return { status: "deleted" }; } },
    id: () => `id-${++sequence}`,
    clock: () => new Date("2026-08-16T00:00:00.000Z")
  });
  return { service, calls };
}

test("admin catalog commands own IDs/status/audit actor and archive instead of delete", async () => {
  const { service, calls } = fixture();
  const category = await service.createCategory("access", { name: "GPU", slug: "gpu", sortOrder: 1 }, { requestId: "request-1" });
  assert.equal(category.id, "id-1");
  assert.equal(category.status, "ACTIVE");
  assert.equal(calls[0][3].actorId, "actor-1");
  assert.equal(calls[0][3].targetId, "id-1");
  await service.archive("access", "category", "category-1", { requestId: "request-2" });
  assert.equal(calls[1][0], "archive");
  assert.equal(calls[1][2], "category");
  assert.equal(calls[1][4].changes.status, "ARCHIVED");
});

test("catalog commands deny non-admin roles and mass assignment/physical facts", async () => {
  for (const role of ["CUSTOMER", "SUPPORT", "TECHNICIAN", "SUPERVISOR", "INVENTORY", "FINANCE"]) {
    const { service } = fixture([role]);
    await assert.rejects(service.createBrand("access", { name: "Brand", slug: "brand" }), (error) => error instanceof CatalogCommandError && error.code === "forbidden");
  }
  const { service } = fixture();
  await assert.rejects(service.createCategory("access", { id: "client-id", name: "GPU", slug: "gpu" }), (error) => error.code === "invalid_input");
  await assert.rejects(service.createProductModel("access", { categoryId: "c", brandId: "b", name: "Model", slug: "model", acquisitionCost: 1 }), (error) => error.code === "invalid_input");
});

test("catalog PATCH merges active records while preserving server identity and lifecycle", async()=>{
  const {service,calls}=fixture();
  const updated=await service.update("access","brand","brand-1",{name:"New",slug:"new"},{requestId:"patch"});
  assert.equal(updated.id,"brand-1"); assert.equal(updated.status,"ACTIVE"); assert.equal(updated.name,"New");
  const update=calls.find(([name])=>name==="update"); assert.equal(update[1].id,"brand-1"); assert.equal(update[4].actorId,"actor-1");
  await assert.rejects(service.update("access","brand","brand-1",{status:"ARCHIVED"}),error=>error.code==="invalid_input");
});

test("catalog remove hard-deletes unreferenced records with a DELETED audit event", async () => {
  const { service, calls } = fixture();
  await service.remove("access", "brand", "brand-1", { requestId: "purge" });
  const remove = calls.find(([name]) => name === "remove");
  assert.equal(remove[1], "brand-1");
  assert.equal(remove[2], "brand");
  assert.equal(remove[3].action, "CATALOG_BRAND_DELETED");
  assert.deepEqual(remove[3].changes, { status: "DELETED" });
  assert.equal(remove[3].actorId, "actor-1");
});

test("catalog remove maps in_use and not_found outcomes to errors", async () => {
  const { service } = fixture();
  const base = { async remove() { return { status: "in_use" }; } };
  const inUse = createCatalogCommandService({
    authService: { async authenticateAccess() { return { userId: "a", status: "ACTIVE", roles: ["ADMIN"] }; } },
    repository: { create() {}, find() {}, update() {}, archive() {}, setStatus() {}, listCategories() {}, ...base }
  });
  await assert.rejects(inUse.remove("access", "category", "c1"), (e) => e.code === "in_use");

  const notFound = createCatalogCommandService({
    authService: { async authenticateAccess() { return { userId: "a", status: "ACTIVE", roles: ["ADMIN"] }; } },
    repository: { create() {}, find() {}, update() {}, archive() {}, setStatus() {}, listCategories() {}, async remove() { return { status: "not_found" }; } }
  });
  await assert.rejects(notFound.remove("access", "category", "c1"), (e) => e.code === "not_found");
});

test("catalog setStatus toggles visibility and audits the transition", async () => {
  const { service, calls } = fixture();
  await service.setStatus("access", "category", "category-1", "INACTIVE", { requestId: "toggle" });
  const set = calls.find(([name]) => name === "setStatus");
  assert.equal(set[1], "category-1");
  assert.equal(set[2], "category");
  assert.equal(set[3], "INACTIVE");
  assert.equal(set[5].action, "CATALOG_CATEGORY_DEACTIVATED");

  await service.setStatus("access", "category", "category-1", "ACTIVE", { requestId: "toggle" });
  const reactivate = calls.filter(([name]) => name === "setStatus").at(-1);
  assert.equal(reactivate[5].action, "CATALOG_CATEGORY_ACTIVATED");

  await assert.rejects(service.setStatus("access", "category", "category-1", "ARCHIVED"), (e) => e.code === "invalid_input");
  await assert.rejects(service.setStatus("access", "category", "category-1", "BOGUS"), (e) => e.code === "invalid_input");
});

test("catalog setStatus cannot act on a missing record", async () => {
  const { service } = fixture();
  // The fixture find() returns null for product_model, simulating a missing row.
  await assert.rejects(service.setStatus("access", "product_model", "model-1", "INACTIVE"), (e) => e.code === "not_found");
});

test("catalog listCategories returns admin categories via the repository", async () => {
  const { service, calls } = fixture();
  const result = await service.listCategories("access");
  assert.equal(result.data[0].slug, "gpu");
  assert.equal(calls[0][0], "listCategories");
});
