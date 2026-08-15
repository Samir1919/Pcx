CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  cart_id uuid,
  reserved_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'CONVERTED', 'EXPIRED', 'CANCELLED')),
  reserved_until timestamptz NOT NULL,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reserved_until > created_at),
  CHECK ((status = 'ACTIVE' AND converted_at IS NULL) OR (status <> 'ACTIVE'))
);

-- Critical double-sell guard: at most one ACTIVE reservation per item.
CREATE UNIQUE INDEX IF NOT EXISTS reservations_one_active_per_item
  ON reservations(inventory_item_id) WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS reservations_item_idx ON reservations(inventory_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reservations_expiry_idx ON reservations(reserved_until) WHERE status = 'ACTIVE';
