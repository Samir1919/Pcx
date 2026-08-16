CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  channel text NOT NULL CHECK (channel IN ('EMAIL', 'SMS', 'PUSH')),
  notification_type text NOT NULL,
  reference_type text,
  reference_id text,
  status text NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  payload_snapshot jsonb,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_pending_idx ON notifications(status, scheduled_at) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC);
