CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text,
  phone text,
  password_hash text,
  auth_provider text NOT NULL DEFAULT 'PASSWORD',
  status text NOT NULL CHECK (status IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED')),
  contact_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_ci ON users (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users (phone) WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  assigned_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE RESTRICT,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  label text NOT NULL,
  recipient_name text NOT NULL,
  phone text NOT NULL,
  address_line_1 text NOT NULL,
  address_line_2 text,
  area text NOT NULL,
  city text NOT NULL,
  postal_code text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS addresses_user_id_idx ON addresses(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS addresses_one_default_per_user ON addresses(user_id) WHERE is_default;

CREATE TABLE IF NOT EXISTS access_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  credential_hash bytea NOT NULL UNIQUE CHECK (octet_length(credential_hash) = 32),
  refresh_family_id uuid,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  ip_hash bytea,
  user_agent text,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS access_sessions_user_active_idx ON access_sessions(user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS refresh_families (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE access_sessions
  ADD CONSTRAINT access_sessions_refresh_family_fk
  FOREIGN KEY (refresh_family_id) REFERENCES refresh_families(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS refresh_credentials (
  id uuid PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES refresh_families(id) ON DELETE RESTRICT,
  credential_hash bytea NOT NULL UNIQUE CHECK (octet_length(credential_hash) = 32),
  parent_id uuid REFERENCES refresh_credentials(id) ON DELETE RESTRICT,
  replaced_by_id uuid REFERENCES refresh_credentials(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK (replaced_by_id IS NULL OR used_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS refresh_credentials_family_idx ON refresh_credentials(family_id, created_at DESC);

CREATE TABLE IF NOT EXISTS auth_audit_events (
  id uuid PRIMARY KEY,
  actor_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  request_id text NOT NULL,
  reason text,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_audit_events_target_idx ON auth_audit_events(target_type, target_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS auth_audit_events_actor_idx ON auth_audit_events(actor_id, occurred_at DESC);
