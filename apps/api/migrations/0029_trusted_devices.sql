-- Trusted-device credentials for the privileged MFA "remember this device"
-- window (ADR 0010). Only a SHA-256 hash of each opaque device credential is
-- stored; the raw value is held only by the client in an HttpOnly cookie.

CREATE TABLE IF NOT EXISTS trusted_devices (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  credential_hash bytea NOT NULL UNIQUE CHECK (octet_length(credential_hash) = 32),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS trusted_devices_user_active_idx ON trusted_devices(user_id) WHERE revoked_at IS NULL;
