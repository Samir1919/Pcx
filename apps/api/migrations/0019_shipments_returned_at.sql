ALTER TABLE shipments ADD COLUMN IF NOT EXISTS returned_at timestamptz;

ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_returned_at_check;
ALTER TABLE shipments ADD CONSTRAINT shipments_returned_at_check
  CHECK ((status = 'RETURNED' AND returned_at IS NOT NULL) OR (status <> 'RETURNED' AND returned_at IS NULL));
