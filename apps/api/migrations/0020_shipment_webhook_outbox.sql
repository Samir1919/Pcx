-- Durable outbox for inbound courier webhook events. Every webhook is durably
-- queued before/alongside application so a delivery event is never lost if the
-- process crashes between receipt and state transition. A worker retries
-- PENDING events until they are APPLIED or permanently FAILED.
CREATE TABLE IF NOT EXISTS shipment_webhook_events (
  id uuid PRIMARY KEY,
  shipment_id uuid REFERENCES shipments(id) ON DELETE RESTRICT,
  provider_status text NOT NULL,
  occurred_at timestamptz,
  status text NOT NULL CHECK (status IN ('PENDING', 'APPLIED', 'FAILED')),
  retry_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz
);

CREATE INDEX IF NOT EXISTS shipment_webhook_events_pending_idx
  ON shipment_webhook_events(status, next_attempt_at) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS shipment_webhook_events_shipment_idx
  ON shipment_webhook_events(shipment_id, created_at DESC);
