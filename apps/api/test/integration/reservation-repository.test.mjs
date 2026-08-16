import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresReservationRepository } from "../../src/modules/commerce/postgres-reservation-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("reservation repository enforces one-active-per-item and converts atomically", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresReservationRepository({ pool });
  const userId = "9d000000-0000-4000-8000-000000000001";
  const itemId = "9d000000-0000-4000-8000-000000000002";
  const reservationA = "9d000000-0000-4000-8000-000000000003";
  const reservationB = "9d000000-0000-4000-8000-000000000004";
  const productModelId = "82000000-0000-0000-0000-000000000001"; // seeded catalog model
  try {
    await pool.query("DELETE FROM reservations WHERE inventory_item_id::text = $1", [itemId]);
    await pool.query("DELETE FROM serial_identifiers WHERE inventory_item_id::text = $1", [itemId]);
    await pool.query("DELETE FROM inventory_items WHERE id::text = $1", [itemId]);
    await pool.query("DELETE FROM users WHERE email = 'res-customer@example.com'");
    await pool.query("INSERT INTO users(id,email,status) VALUES ($1,'res-customer@example.com','ACTIVE')", [userId]);
    await pool.query("INSERT INTO inventory_items(id, pcx_item_id, product_model_id, status, received_at, created_at, updated_at) VALUES ($1, 'PCX-TEST-RES', $2, 'APPROVED', now(), now(), now())", [itemId, productModelId]);

    const first = await repository.create({
      id: reservationA,
      inventoryItemId: itemId,
      cartId: null,
      reservedByUserId: userId,
      status: "ACTIVE",
      reservedUntil: "2026-08-16T12:15:00.000Z",
      createdAt: "2026-08-16T12:00:00.000Z",
    });
    assert.equal(first.status, "ACTIVE");

    // Second ACTIVE reservation for the same item must be rejected (double-sell guard).
    await assert.rejects(
      repository.create({
        id: reservationB,
        inventoryItemId: itemId,
        cartId: null,
        reservedByUserId: userId,
        status: "ACTIVE",
        reservedUntil: "2026-08-16T12:15:00.000Z",
        createdAt: "2026-08-16T12:00:00.000Z",
      }),
      (error) => error.code === "23505"
    );

    const converted = await repository.convert(reservationA, "2026-08-16T12:10:00.000Z");
    assert.equal(converted.status, "converted");
    assert.equal(converted.record.status, "CONVERTED");

    // After conversion, the unique index no longer blocks a new ACTIVE reservation.
    const third = await repository.create({
      id: "9d000000-0000-4000-8000-000000000005",
      inventoryItemId: itemId,
      cartId: null,
      reservedByUserId: userId,
      status: "ACTIVE",
      reservedUntil: "2026-08-16T12:20:00.000Z",
      createdAt: "2026-08-16T12:05:00.000Z",
    });
    assert.equal(third.status, "ACTIVE");

    assert.equal((await repository.findActiveByItem(itemId, "2026-08-16T12:10:00.000Z")).id, third.id);
  } finally {
    await pool.end();
  }
});
