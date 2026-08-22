-- Persistent cart (E9). A customer has at most one ACTIVE cart; items snapshot
-- the listing price at add time (server-owned, never client-authoritative).
-- Cart alone never locks inventory: reservation remains the double-sell guard
-- and is only created at checkout.

CREATE TABLE IF NOT EXISTS carts (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'CONVERTED', 'EXPIRED', 'CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS carts_one_active_per_user
  ON carts(user_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY,
  cart_id uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  listing_id uuid REFERENCES listings(id) ON DELETE RESTRICT,
  price_snapshot numeric CHECK (price_snapshot IS NULL OR price_snapshot >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cart_id, inventory_item_id)
);

CREATE INDEX IF NOT EXISTS cart_items_cart_idx ON cart_items(cart_id);
