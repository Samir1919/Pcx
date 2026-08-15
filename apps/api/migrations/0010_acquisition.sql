CREATE TABLE IF NOT EXISTS valuations (
  id uuid PRIMARY KEY,
  sell_request_id uuid NOT NULL REFERENCES sell_requests(id) ON DELETE RESTRICT,
  valuation_type text NOT NULL CHECK (valuation_type IN ('PRELIMINARY', 'POST_INSPECTION', 'MANUAL')),
  low_value numeric CHECK (low_value IS NULL OR low_value > 0),
  high_value numeric CHECK (high_value IS NULL OR high_value > 0),
  recommended_value numeric CHECK (recommended_value IS NULL OR recommended_value > 0),
  inputs_snapshot jsonb,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (low_value IS NULL OR high_value IS NULL OR low_value <= high_value)
);

CREATE INDEX IF NOT EXISTS valuations_sell_request_idx ON valuations(sell_request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY,
  sell_request_id uuid NOT NULL REFERENCES sell_requests(id) ON DELETE RESTRICT,
  valuation_id uuid NOT NULL REFERENCES valuations(id) ON DELETE RESTRICT,
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN')),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'ACCEPTED' AND accepted_at IS NOT NULL) OR (status <> 'ACCEPTED' AND accepted_at IS NULL))
);

CREATE INDEX IF NOT EXISTS offers_sell_request_idx ON offers(sell_request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS acquisitions (
  id uuid PRIMARY KEY,
  sell_request_id uuid NOT NULL REFERENCES sell_requests(id) ON DELETE RESTRICT,
  accepted_offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE RESTRICT,
  seller_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  source_type text NOT NULL CHECK (source_type IN ('SELL_TO_PCX', 'DIRECT_PURCHASE', 'TRADE_IN', 'CORPORATE', 'OTHER')),
  agreed_price numeric NOT NULL CHECK (agreed_price > 0),
  payment_status text NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID')),
  ownership_confirmed_at timestamptz,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) <= 128)
);

CREATE INDEX IF NOT EXISTS acquisitions_sell_request_idx ON acquisitions(sell_request_id, acquired_at DESC);
