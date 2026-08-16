import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresAddressRepository } from "../../src/modules/identity/postgres-address-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("address repository enforces owner and one-default behavior", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresAddressRepository({ pool });
  const owner = "60000000-0000-0000-0000-000000000001";
  const other = "60000000-0000-0000-0000-000000000002";
  const now = "2026-08-16T00:00:00.000Z";
  const base = { userId: owner, label: "Home", recipientName: "Buyer", phone: "01700000000", addressLine1: "Road 1", addressLine2: null, area: "Dhanmondi", city: "Dhaka", postalCode: "1209", isDefault: true, createdAt: now };
  try {
    await pool.query("DELETE FROM addresses WHERE user_id IN ($1,$2)", [owner, other]);
    await pool.query("DELETE FROM user_roles WHERE user_id IN ($1,$2)", [owner, other]);
    await pool.query("DELETE FROM users WHERE id IN ($1,$2)", [owner, other]);
    await pool.query("INSERT INTO users(id,email,status,contact_verified,created_at,updated_at) VALUES ($1,'address-owner@example.com','ACTIVE',true,$3,$3),($2,'address-other@example.com','ACTIVE',true,$3,$3)", [owner, other, now]);
    await pool.query("INSERT INTO user_roles(user_id,role_id,assigned_at) SELECT id,(SELECT id FROM roles WHERE code='CUSTOMER'),$3 FROM users WHERE id IN ($1,$2)", [owner, other, now]);
    assert.equal((await repository.create({ ...base, id: "61000000-0000-0000-0000-000000000001" })).status, "created");
    assert.equal((await repository.create({ ...base, id: "61000000-0000-0000-0000-000000000002", label: "Office", createdAt: "2026-08-16T00:01:00.000Z" })).status, "created");
    const listed = await repository.listByOwner(owner);
    assert.equal(listed.length, 2);
    assert.equal(listed.filter((address) => address.isDefault).length, 1);
    assert.equal(listed[0].label, "Office");
    assert.equal(await repository.update(other, listed[0].id, listed[0], "2026-08-16T00:02:00.000Z"), null);
    assert.equal(await repository.delete(other, listed[0].id), false);
    assert.equal(await repository.delete(owner, listed[0].id), true);
  } finally { await pool.end(); }
});
