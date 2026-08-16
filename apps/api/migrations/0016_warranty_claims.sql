CREATE TABLE IF NOT EXISTS warranties (
  id uuid PRIMARY KEY,
  order_item_id uuid NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE RESTRICT,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  policy_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'EXPIRED', 'VOID')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS warranties_inventory_idx ON warranties(inventory_item_id);

CREATE TABLE IF NOT EXISTS claims (
  id uuid PRIMARY KEY,
  warranty_id uuid NOT NULL REFERENCES warranties(id) ON DELETE RESTRICT,
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('REQUESTED', 'IN_REVIEW', 'RESOLVED', 'REJECTED', 'CANCELLED')),
  reason_code text NOT NULL,
  symptoms text,
  requested_at timestamptz NOT NULL,
  received_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'RESOLVED' AND resolved_at IS NOT NULL) OR (status <> 'RESOLVED' AND resolved_at IS NULL))
);

CREATE INDEX IF NOT EXISTS claims_warranty_idx ON claims(warranty_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS claim_resolutions (
  id uuid PRIMARY KEY,
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE RESTRICT,
  resolution_type text NOT NULL CHECK (resolution_type IN ('REPAIR', 'REPLACE', 'REFUND', 'REJECT')),
  notes text,
  cost_amount numeric CHECK (cost_amount IS NULL OR cost_amount >= 0),
  approved_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS claim_resolutions_claim_idx ON claim_resolutions(claim_id, created_at DESC);
