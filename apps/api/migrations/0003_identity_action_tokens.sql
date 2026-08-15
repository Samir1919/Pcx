CREATE TABLE IF NOT EXISTS identity_action_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  purpose text NOT NULL CHECK (purpose IN ('CONTACT_VERIFICATION', 'PASSWORD_RESET')),
  credential_hash bytea NOT NULL UNIQUE CHECK (octet_length(credential_hash) = 32),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK (used_at IS NULL OR used_at >= created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX IF NOT EXISTS identity_action_tokens_user_purpose_idx
  ON identity_action_tokens(user_id, purpose, created_at DESC);
