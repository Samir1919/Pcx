CREATE SEQUENCE IF NOT EXISTS orders_no_seq;

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY,
  order_no text UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'PACKING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED')),
  currency text NOT NULL DEFAULT 'BDT',
  subtotal numeric NOT NULL CHECK (subtotal >= 0),
  shipping_amount numeric NOT NULL DEFAULT 0 CHECK (shipping_amount >= 0),
  discount_amount numeric NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  placed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (total_amount = subtotal + shipping_amount - discount_amount)
);

CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  listing_id uuid,
  product_model_id uuid NOT NULL REFERENCES product_models(id) ON DELETE RESTRICT,
  pcx_item_id_snapshot text NOT NULL,
  product_name_snapshot text NOT NULL,
  spec_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  grade_snapshot text,
  health_score_snapshot numeric,
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id, inventory_item_id)
);

CREATE INDEX IF NOT EXISTS order_items_inventory_idx ON order_items(inventory_item_id);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY,
  order_id uuid REFERENCES orders(id) ON DELETE RESTRICT,
  payment_direction text NOT NULL CHECK (payment_direction IN ('INBOUND', 'OUTBOUND')),
  provider text NOT NULL,
  provider_transaction_id text UNIQUE NOT NULL,
  method text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  status text NOT NULL CHECK (status IN ('INITIATED', 'CONFIRMED', 'FAILED')),
  initiated_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'CONFIRMED' AND confirmed_at IS NOT NULL) OR (status <> 'CONFIRMED' AND confirmed_at IS NULL))
);

CREATE INDEX IF NOT EXISTS payments_order_idx ON payments(order_id, initiated_at DESC);
CREATE INDEX IF NOT EXISTS payments_provider_txn_idx ON payments(provider_transaction_id);
