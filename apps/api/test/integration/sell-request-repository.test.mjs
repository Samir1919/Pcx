import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresSellRequestRepository } from "../../src/modules/acquisition/postgres-sell-request-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("sell request repository persists draft, declaration, and owner-scoped submit", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresSellRequestRepository({ pool });
  const userId = "7a000000-0000-4000-8000-000000000001";
  const requestId = "7a000000-0000-4000-8000-000000000002";
  const declarationId = "7a000000-0000-4000-8000-000000000003";
  const now = "2026-08-16T00:00:00.000Z";
  try {
    await pool.query("DELETE FROM seller_declarations WHERE sell_request_id=$1", [requestId]);
    await pool.query("DELETE FROM sell_requests WHERE id=$1", [requestId]);
    await pool.query("DELETE FROM users WHERE id=$1", [userId]);
    await pool.query("INSERT INTO users(id,email,status) VALUES ($1,'seller@example.com','ACTIVE')", [userId]);

    const created = await repository.create(
      { id: requestId, publicRequestNo: null, userId, categoryId: "7a000000-0000-4000-8000-000000000010", productModelId: null, contactName: "Seller", contactPhone: "01700000000", contactEmail: null, fulfilmentPreference: "PICKUP", selectedSpecs: [], sellEntry: "DESKTOP_PC", buildComponents: [{ role: "cpu", productModelId: "7a000000-0000-4000-8000-000000000020" }, { role: "ram", productModelId: "7a000000-0000-4000-8000-000000000021" }], status: "DRAFT", submittedAt: null, createdAt: now, updatedAt: now },
      { id: declarationId, sellRequestId: requestId, ageEstimate: null, warrantyRemaining: null, repairDeclared: false, repairNotes: null, boxAvailable: true, invoiceAvailable: false, ownershipDeclared: true, createdAt: now },
      now
    );
    assert.equal(created.id, requestId);
    assert.equal(created.status, "DRAFT");
    assert.equal(created.declaration.ownershipDeclared, true);
    assert.equal(created.sellEntry, "DESKTOP_PC");
    assert.deepEqual(created.buildComponents, [{ role: "cpu", productModelId: "7a000000-0000-4000-8000-000000000020" }, { role: "ram", productModelId: "7a000000-0000-4000-8000-000000000021" }]);

    assert.equal((await repository.findByOwner(userId, requestId)).id, requestId);
    assert.equal(await repository.findByOwner("7a000000-0000-4000-8000-000000000099", requestId), null);
    assert.equal((await repository.listByOwner(userId)).some((item) => item.id === requestId), true);

    // Admin queue must exclude DRAFT: a seller's unfinished draft is private.
    assert.equal((await repository.listAll()).some((item) => item.id === requestId), false);

    const submitted = await repository.submit(userId, requestId, now);
    assert.equal(submitted.status, "submitted");
    assert.equal(submitted.record.status, "SUBMITTED");
    assert.ok(submitted.record.submittedAt);

    // Once SUBMITTED, the request becomes visible in the admin queue.
    assert.equal((await repository.listAll()).some((item) => item.id === requestId), true);

    // Submitting again is rejected because the state is no longer DRAFT.
    assert.deepEqual(await repository.submit(userId, requestId, now), { status: "not_found" });
  } finally {
    await pool.end();
  }
});
