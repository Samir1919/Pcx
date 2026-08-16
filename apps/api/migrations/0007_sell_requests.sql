CREATE TABLE IF NOT EXISTS sell_requests (
  id uuid PRIMARY KEY,
  public_request_no text UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text,
  category_id uuid NOT NULL,
  product_model_id uuid,
  status text NOT NULL CHECK (status IN ('DRAFT', 'SUBMITTED', 'REVIEWING')),
  fulfilment_preference text NOT NULL CHECK (fulfilment_preference IN ('PICKUP', 'DROP_OFF', 'COURIER')),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'DRAFT' AND submitted_at IS NULL) OR (status IN ('SUBMITTED', 'REVIEWING') AND submitted_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS sell_requests_user_idx ON sell_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sell_requests_status_idx ON sell_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS seller_declarations (
  id uuid PRIMARY KEY,
  sell_request_id uuid NOT NULL REFERENCES sell_requests(id) ON DELETE RESTRICT,
  age_estimate text,
  warranty_remaining text,
  repair_declared boolean NOT NULL DEFAULT false,
  repair_notes text,
  box_available boolean NOT NULL DEFAULT false,
  invoice_available boolean NOT NULL DEFAULT false,
  ownership_declared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ownership_declared = true)
);

CREATE UNIQUE INDEX IF NOT EXISTS seller_declarations_request_unique ON seller_declarations(sell_request_id);
