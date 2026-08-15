import assert from "node:assert/strict";
import test from "node:test";
import { CatalogCommandError, createCatalogCommandService } from "../src/modules/catalog/catalog-command-service.mjs";

function fixture(roles = ["ADMIN"]) {
  let sequence = 0;
  const calls = [];
  const service = createCatalogCommandService({
    authService: { async authenticateAccess() { return { userId: "actor-1", status: "ACTIVE", roles }; } },
    repository: { async create(...input) { calls.push(["create", ...input]); return input[0]; }, async find(kind,id) { calls.push(["find",kind,id]); return kind === "brand" ? { id, name:"Old", slug:"old", status:"ACTIVE", createdAt:"2026-08-15T00:00:00.000Z" } : null; }, async update(...input) { calls.push(["update",...input]); return true; }, async archive(...input) { calls.push(["archive", ...input]); return true; } },
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
