-- Server-authored warranty policies (E13).
--
-- A policy is a reusable coverage template (name, duration, coverage, terms).
-- Warranties snapshot a policy's facts at issuance, so editing/archiving a policy
-- never rewrites the coverage sold on an existing warranty.
CREATE TABLE IF NOT EXISTS warranty_policies (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  duration_days integer NOT NULL CHECK (duration_days > 0),
  coverage_summary text NOT NULL,
  terms text,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);