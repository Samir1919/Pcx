-- Notification provider configuration (email + SMS).
--
-- Mirrors payment_provider_config: stores provider credentials per environment
-- mode (SANDBOX / REAL) so the admin panel can input and switch between sandbox
-- and live credentials without committing secrets to the repository. Credentials
-- are encrypted at rest (AES-256-GCM) using the same PAYMENT_CREDENTIALS_KEY
-- cipher used for payment providers; only ciphertext is stored, never plaintext.
--
-- provider: EMAIL (Resend) | SMS (bdBulksms/greenweb)
-- Only privileged admins (SYSTEM_CONFIGURE) may read/write these rows; the public
-- API never exposes the stored credentials.

CREATE TABLE IF NOT EXISTS notification_provider_config (
  id uuid PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('EMAIL', 'SMS')),
  mode text NOT NULL CHECK (mode IN ('SANDBOX', 'REAL')),
  encrypted_credentials text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, mode)
);

CREATE INDEX IF NOT EXISTS notification_provider_config_active_idx
  ON notification_provider_config(provider, active);
