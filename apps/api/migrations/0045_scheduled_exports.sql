-- Scheduled report exports (E14/E16).
--
-- A registry of recurring exports that the worker runs on a cadence. The run
-- record (last_run_at + last_row_count) is server-owned; the export payload is
-- produced on demand by the report export endpoints and can be delivered to an
-- external bucket/SIEM sink (E19 media storage) as a follow-up.
CREATE TABLE IF NOT EXISTS scheduled_exports (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  report text NOT NULL,
  format text NOT NULL DEFAULT 'csv',
  cadence text NOT NULL DEFAULT 'daily',
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_row_count integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scheduled_exports_due_idx ON scheduled_exports(enabled, last_run_at);