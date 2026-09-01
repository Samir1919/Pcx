// PostgreSQL repository for payment provider configuration.
//
// Stores the encrypted credentials blob per (provider, mode). The repository
// never sees plaintext credentials; it persists and returns the ciphertext
// produced by the credentials cipher. The service layer owns encryption and
// masking.

function row(record) {
  return Object.freeze({
    id: record.id,
    provider: record.provider,
    mode: record.mode,
    encryptedCredentials: record.encrypted_credentials,
    active: record.active === true,
    createdAt: new Date(record.created_at).toISOString(),
    updatedAt: new Date(record.updated_at).toISOString()
  });
}

export function createPostgresPaymentProviderConfigRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async upsert(record) {
      const result = await pool.query(
        `INSERT INTO payment_provider_config(id, provider, mode, encrypted_credentials, active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         ON CONFLICT (provider, mode)
         DO UPDATE SET encrypted_credentials = EXCLUDED.encrypted_credentials,
                       active = EXCLUDED.active,
                       updated_at = EXCLUDED.updated_at
         RETURNING id, provider, mode, encrypted_credentials, active, created_at, updated_at`,
        [record.id, record.provider, record.mode, record.encryptedCredentials, record.active, record.createdAt]
      );
      return row(result.rows[0]);
    },

    async findByProviderAndMode(provider, mode) {
      const result = await pool.query(
        `SELECT id, provider, mode, encrypted_credentials, active, created_at, updated_at
         FROM payment_provider_config
         WHERE provider = $1 AND mode = $2`,
        [provider, mode]
      );
      return result.rowCount === 1 ? row(result.rows[0]) : null;
    },

    async listByProvider(provider) {
      const result = await pool.query(
        `SELECT id, provider, mode, encrypted_credentials, active, created_at, updated_at
         FROM payment_provider_config
         WHERE provider = $1
         ORDER BY mode`,
        [provider]
      );
      return result.rows.map(row);
    },

    async setActive(provider, mode, now) {
      const result = await pool.query(
        `UPDATE payment_provider_config
         SET active = (provider = $1 AND mode = $2), updated_at = $3
         WHERE provider = $1
         RETURNING id, provider, mode, encrypted_credentials, active, created_at, updated_at`,
        [provider, mode, now]
      );
      return result.rows.map(row);
    },

    async remove(provider, mode) {
      const result = await pool.query(
        `DELETE FROM payment_provider_config
         WHERE provider = $1 AND mode = $2
         RETURNING id, provider, mode, encrypted_credentials, active, created_at, updated_at`,
        [provider, mode]
      );
      return result.rowCount === 1 ? row(result.rows[0]) : null;
    }
  });
}
