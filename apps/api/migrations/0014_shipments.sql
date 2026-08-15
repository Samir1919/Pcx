CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  courier text NOT NULL,
  tracking_id text UNIQUE,
  package_type text NOT NULL,
  weight numeric NOT NULL CHECK (weight >= 0),
  cod_amount numeric NOT NULL DEFAULT 0 CHECK (cod_amount >= 0),
  shipping_charge numeric NOT NULL DEFAULT 0 CHECK (shipping_charge >= 0),
  status text NOT NULL CHECK (status IN ('DRAFT', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED')),
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status IN ('SHIPPED', 'DELIVERED') AND shipped_at IS NOT NULL) OR (status NOT IN ('SHIPPED', 'DELIVERED') AND shipped_at IS NULL)),
  CHECK ((status = 'DELIVERED' AND delivered_at IS NOT NULL) OR (status <> 'DELIVERED' AND delivered_at IS NULL))
);

CREATE INDEX IF NOT EXISTS shipments_order_idx ON shipments(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS shipment_events (
  id uuid PRIMARY KEY,
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('DRAFT', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED')),
  provider_status_raw text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipment_events_shipment_idx ON shipment_events(shipment_id, occurred_at DESC);
