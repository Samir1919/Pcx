-- Remove the internal "valuation" estimate concept entirely.
--
-- An offer is now created directly from a sell request (amount + expiry).
-- The `valuations` table and the `offers.valuation_id` column/foreign-key are
-- removed so no dangling references remain.
--
-- This is intentionally idempotent (all guards use IF EXISTS / dynamic name
-- resolution) so it reaches the same final state on a freshly-provisioned DB
-- (after 0010) and on an already-migrated DB.

DO $$
DECLARE
  fk_name text;
BEGIN
  -- Drop the foreign key on offers.valuation_id by resolving its actual
  -- constraint name (PostgreSQL auto-names it differently across versions).
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'offers'::regclass
    AND confrelid = 'valuations'::regclass
    AND contype = 'f'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE offers DROP CONSTRAINT %I', fk_name);
  END IF;
END
$$;

ALTER TABLE offers DROP COLUMN IF EXISTS valuation_id;
DROP TABLE IF EXISTS valuations;
