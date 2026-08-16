-- Payment provider configuration.
--
-- Stores provider credentials (e.g. bKash) per environment mode (SANDBOX / REAL)
-- so the admin panel can input and switch between sandbox and live credentials
-- without committing secrets to the repository. Credentials are encrypted at
-- rest (AES-256-GCM) using a key supplied via the PAYMENT_CREDENTIALS_KEY
-- environment variable; the ciphertext and IV are stored here, never plaintext.
--
-- Only privileged admins (SYSTEM_CONFIGURE) may read/write these rows, and the
-- public API never exposes the stored credentials.

CREATE TABLE IF NOT EXISTS payment_provider_config (
  id uuid PRIMARY KEY,
  provider text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('SANDBOX', 'REAL')),
  encrypted_credentials text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, mode)
);

CREATE INDEX IF NOT EXISTS payment_provider_config_active_idx
  ON payment_provider_config(provider, active);
