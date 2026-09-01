import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresRetentionRepository } from "../../src/modules/reporting/postgres-retention-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("retention repository purges only obsolete rows per category", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresRetentionRepository({ pool });
  const prefix = "77000000-0000-0000-0000-";
  const user = `${prefix}000000000001`;
  const category = `${prefix}000000000002`;
  const brand = `${prefix}000000000003`;
  const model = `${prefix}000000000004`;
  const item = `${prefix}000000000005`;
  const sellRequest = `${prefix}000000000006`;
  const resOld = `${prefix}000000000011`;
  const resActive = `${prefix}000000000012`;
  const notifSent = `${prefix}000000000021`;
  const notifPending = `${prefix}000000000022`;
  const sessionExpired = `${prefix}000000000031`;
  const sessionActive = `${prefix}000000000032`;
  const offerExpired = `${prefix}000000000041`;
  const offerActive = `${prefix}000000000042`;
  const old = "2020-01-01T00:00:00.000Z";
  const recent = "2099-01-01T00:00:00.000Z";
  const cutoff = "2021-01-01T00:00:00.000Z";

  async function cleanup() {
    await pool.query("DELETE FROM offers WHERE sell_request_id::text = $1", [sellRequest]);
    await pool.query("DELETE FROM sell_requests WHERE id::text = $1", [sellRequest]);
    await pool.query("DELETE FROM reservations WHERE reserved_by_user_id::text = $1", [user]);
    await pool.query("DELETE FROM notifications WHERE user_id::text = $1", [user]);
    await pool.query("DELETE FROM access_sessions WHERE user_id::text = $1", [user]);
    await pool.query("DELETE FROM inventory_items WHERE id::text = $1", [item]);
    await pool.query("DELETE FROM product_models WHERE id::text = $1", [model]);
    await pool.query("DELETE FROM brands WHERE id::text = $1", [brand]);
    await pool.query("DELETE FROM categories WHERE id::text = $1", [category]);
    await pool.query("DELETE FROM users WHERE id::text = $1 OR email = 'retention@example.com'", [user]);
  }

  async function setup() {
    await cleanup();
    await pool.query("INSERT INTO users(id,email,status,contact_verified) VALUES ($1,'retention@example.com','ACTIVE',true)", [user]);
    await pool.query("INSERT INTO categories(id,name,slug,status) VALUES ($1,'Ret Cat','ret-cat','ACTIVE')", [category]);
    await pool.query("INSERT INTO brands(id,name,slug,status) VALUES ($1,'Ret Brand','ret-brand','ACTIVE')", [brand]);
    await pool.query("INSERT INTO product_models(id,category_id,brand_id,name,slug,status) VALUES ($1,$2,$3,'Ret Model','ret-model','ACTIVE')", [model, category, brand]);
    await pool.query("INSERT INTO inventory_items(id,pcx_item_id,product_model_id,status,received_at,created_at,updated_at) VALUES ($1,'PCX-RET',$2,'APPROVED',now(),now(),now())", [item, model]);
    await pool.query("INSERT INTO sell_requests(id,user_id,contact_name,contact_phone,category_id,product_model_id,status,fulfilment_preference,submitted_at,created_at) VALUES ($1,$2,'Ret Name','01700000000',$3,$4,'SUBMITTED','PICKUP',now(),now())", [sellRequest, user, category, model]);
  }

  try {
    await setup();

    // Reservations: one EXPIRED (old), one ACTIVE. reserved_until must exceed created_at.
    await pool.query(
      "INSERT INTO reservations(id,inventory_item_id,reserved_by_user_id,status,reserved_until,created_at) VALUES ($1,$2,$3,'EXPIRED',$4,$5),($6,$2,$3,'ACTIVE',$7,$5)",
      [resOld, item, user, old, "2019-01-01T00:00:00.000Z", resActive, recent]
    );

    // Notifications: one SENT (old), one PENDING.
    await pool.query(
      "INSERT INTO notifications(id,user_id,channel,notification_type,status,created_at) VALUES ($1,$2,'EMAIL','test','SENT',$3),($4,$2,'EMAIL','test','PENDING',$3)",
      [notifSent, user, old, notifPending]
    );

    // Sessions: one expired, one active. expires_at must exceed created_at.
    await pool.query(
      "INSERT INTO access_sessions(id,user_id,credential_hash,expires_at,created_at) VALUES ($1,$2,$3,$4,$5),($6,$2,$7,$8,$9)",
      [sessionExpired, user, "\\x" + "a".repeat(64), old, "2019-01-01T00:00:00.000Z", sessionActive, "\\x" + "b".repeat(64), recent, old]
    );

    // Offers: one EXPIRED (old), one ACTIVE.
    await pool.query(
      "INSERT INTO offers(id,sell_request_id,amount,status,expires_at,created_by,created_at) VALUES ($1,$2,100,'EXPIRED',$3,$4,$5),($6,$2,100,'ACTIVE',$7,$4,$5)",
      [offerExpired, sellRequest, old, user, old, offerActive, recent]
    );

    assert.equal(await repository.deleteClosedReservations(cutoff), 1);
    assert.equal(await repository.deleteDeliveredNotifications(cutoff), 1);
    assert.equal(await repository.deleteExpiredSessions(cutoff), 1);
    assert.equal(await repository.deleteClosedOffers(cutoff), 1);

    // The active/recent rows survive.
    const reservations = await pool.query("SELECT count(*)::int AS c FROM reservations WHERE reserved_by_user_id::text = $1", [user]);
    assert.equal(reservations.rows[0].c, 1);
    const notifications = await pool.query("SELECT count(*)::int AS c FROM notifications WHERE user_id::text = $1", [user]);
    assert.equal(notifications.rows[0].c, 1);
    const sessions = await pool.query("SELECT count(*)::int AS c FROM access_sessions WHERE user_id::text = $1", [user]);
    assert.equal(sessions.rows[0].c, 1);
    const offers = await pool.query("SELECT count(*)::int AS c FROM offers WHERE sell_request_id::text = $1", [sellRequest]);
    assert.equal(offers.rows[0].c, 1);
  } finally {
    await cleanup().catch(() => {});
    await pool.end();
  }
});