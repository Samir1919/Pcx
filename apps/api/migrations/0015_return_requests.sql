CREATE TABLE IF NOT EXISTS return_requests (
  id uuid PRIMARY KEY,
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('REQUESTED', 'APPROVED', 'RECEIVED', 'REFUNDED', 'REJECTED', 'CANCELLED')),
  reason_code text NOT NULL,
  customer_notes text,
  requested_at timestamptz NOT NULL,
  received_at timestamptz,
  resolution_type text CHECK (resolution_type IN ('REFUND', 'REPLACE', 'REPAIR', 'REJECT')),
  resolution_amount numeric CHECK (resolution_amount IS NULL OR resolution_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status IN ('RECEIVED', 'REFUNDED') AND received_at IS NOT NULL) OR (status NOT IN ('RECEIVED', 'REFUNDED') AND received_at IS NULL)),
  CHECK ((status = 'REFUNDED' AND resolution_type IS NOT NULL AND resolution_amount IS NOT NULL) OR (status <> 'REFUNDED'))
);

-- One active/refunded return per sold order item to prevent double refunds; a
-- fully REJECTED or CANCELLED return is excluded so a later request is allowed.
CREATE UNIQUE INDEX IF NOT EXISTS return_requests_one_refundable_per_item
  ON return_requests(order_item_id) WHERE status IN ('REQUESTED', 'APPROVED', 'RECEIVED', 'REFUNDED');

CREATE INDEX IF NOT EXISTS return_requests_item_idx ON return_requests(order_item_id, requested_at DESC);
