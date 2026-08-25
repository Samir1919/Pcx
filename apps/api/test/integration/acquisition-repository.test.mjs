import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresAcquisitionRepository } from "../../src/modules/acquisition/postgres-acquisition-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("acquisition repository persists offer/immutable acquisition with idempotency", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresAcquisitionRepository({ pool });
  const seller = "9a000000-0000-4000-8000-000000000001";
  const admin = "9a000000-0000-4000-8000-000000000002";
  const sellRequest = "9a000000-0000-4000-8000-000000000003";
  const offerId = "9a000000-0000-4000-8000-000000000005";
  const acquisitionId = "9a000000-0000-4000-8000-000000000006";
  const now = "2026-08-16T12:00:00.000Z";
  try {
    await pool.query("DELETE FROM acquisitions WHERE id::text = $1", [acquisitionId]);
    await pool.query("DELETE FROM offers WHERE id::text = $1", [offerId]);
    await pool.query("DELETE FROM sell_requests WHERE id::text = $1", [sellRequest]);
    await pool.query("DELETE FROM acquisitions WHERE seller_user_id::text IN ($1,$2)", [seller, admin]);
    await pool.query("DELETE FROM users WHERE email IN ('acq-seller@example.com','acq-admin@example.com')");
    await pool.query("INSERT INTO users(id,email,status) VALUES ($1,'acq-seller@example.com','ACTIVE'),($2,'acq-admin@example.com','ACTIVE')", [seller, admin]);
    await pool.query("INSERT INTO sell_requests(id, user_id, contact_name, contact_phone, category_id, status, fulfilment_preference, submitted_at, created_at, updated_at) VALUES ($1,$2,'Seller','017','80000000-0000-0000-0000-000000000001','SUBMITTED','PICKUP',now(),now(),now())", [sellRequest, seller]);

    const offer = await repository.createOffer({ id: offerId, sellRequestId: sellRequest, amount: 7000, expiresAt: "2026-08-17T00:00:00.000Z", createdBy: admin, createdAt: now });
    assert.equal(offer.status, "ACTIVE");
    assert.equal(Number(offer.amount), 7000);
    assert.equal(offer.sellRequestId, sellRequest);

    const acceptResult = await repository.acceptOffer(offerId, now);
    assert.equal(acceptResult.status, "accepted");
    assert.equal(acceptResult.record.status, "ACCEPTED");

    const acquisition = await repository.createAcquisition(
      { id: acquisitionId, sellRequestId: sellRequest, acceptedOfferId: offerId, sellerUserId: seller, sourceType: "SELL_TO_PCX", agreedPrice: 7000, ownershipConfirmedAt: null, acquiredAt: now, idempotencyKey: "idem-1" },
      acceptResult.record,
      now
    );
    assert.equal(Number(acquisition.agreedPrice), 7000);
    assert.equal(acquisition.paymentStatus, "PENDING");

    assert.equal((await repository.findByOffer(offerId)).id, acquisitionId);

    // Duplicate idempotency key is rejected by the DB unique constraint.
    await assert.rejects(
      repository.createAcquisition(
        { id: "9a000000-0000-4000-8000-000000000099", sellRequestId: sellRequest, acceptedOfferId: offerId, sellerUserId: seller, sourceType: "SELL_TO_PCX", agreedPrice: 7000, ownershipConfirmedAt: null, acquiredAt: now, idempotencyKey: "idem-1" },
        acceptResult.record,
        now
      ),
      (error) => error.code === "23505"
    );
  } finally {
    await pool.end();
  }
});
