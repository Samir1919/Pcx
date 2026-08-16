CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY,
  pcx_item_id text UNIQUE,
  product_model_id uuid NOT NULL REFERENCES product_models(id) ON DELETE RESTRICT,
  acquisition_id uuid,
  status text NOT NULL CHECK (status IN ('RECEIVED', 'INSPECTION', 'APPROVED', 'REJECTED', 'ESCALATED')),
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_items_status_idx ON inventory_items(status, received_at DESC);

CREATE TABLE IF NOT EXISTS serial_identifiers (
  id uuid PRIMARY KEY,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  identifier_type text NOT NULL CHECK (identifier_type IN ('SERIAL', 'IMEI', 'SERVICE_TAG', 'OTHER')),
  value_normalized text NOT NULL,
  value_display text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(identifier_type, value_normalized),
  CHECK (length(value_normalized) <= 128)
);

CREATE UNIQUE INDEX IF NOT EXISTS serial_identifiers_one_primary_per_item
  ON serial_identifiers(inventory_item_id) WHERE is_primary;
