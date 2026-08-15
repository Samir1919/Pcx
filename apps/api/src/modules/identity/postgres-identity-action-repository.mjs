const purposes = new Set(["CONTACT_VERIFICATION", "PASSWORD_RESET"]);

function assertHash(value) {
  if (!Buffer.isBuffer(value) || value.length !== 32) throw new TypeError("credentialHash must be a 32-byte hash");
}

function assertPurpose(value) {
  if (!purposes.has(value)) throw new TypeError("purpose is invalid");
}

function assertPasswordHash(value) {
  if (typeof value !== "string" || !value.startsWith("$argon2id$")) throw new TypeError("passwordHash must be an Argon2id hash");
}

async function transaction(pool, operation) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function selectUsable(client, credentialHash, purpose, now) {
  const selected = await client.query(
    "SELECT id, user_id, expires_at, used_at, revoked_at FROM identity_action_tokens WHERE credential_hash = $1 AND purpose = $2 FOR UPDATE",
    [credentialHash, purpose]
  );
  if (selected.rowCount !== 1) return { status: "invalid" };
  const token = selected.rows[0];
  if (token.used_at || token.revoked_at) return { status: "invalid" };
  if (new Date(token.expires_at).getTime() <= new Date(now).getTime()) {
    await client.query("UPDATE identity_action_tokens SET revoked_at = COALESCE(revoked_at, $2) WHERE id = $1", [token.id, now]);
    return { status: "expired" };
  }
  return { status: "usable", token };
}

export function createPostgresIdentityActionRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");
  return Object.freeze({
    async issue({ id, userId, purpose, credentialHash, expiresAt, createdAt }) {
      assertPurpose(purpose);
      assertHash(credentialHash);
      return transaction(pool, async (client) => {
        const user = await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
        if (user.rowCount !== 1) return { status: "invalid_user" };
        await client.query(
          "UPDATE identity_action_tokens SET revoked_at = $3 WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL AND revoked_at IS NULL",
          [userId, purpose, createdAt]
        );
        await client.query(
          "INSERT INTO identity_action_tokens(id, user_id, purpose, credential_hash, expires_at, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
          [id, userId, purpose, credentialHash, expiresAt, createdAt]
        );
        return { id, userId, purpose };
      });
    },

    async verifyContact({ credentialHash, now }) {
      assertHash(credentialHash);
      return transaction(pool, async (client) => {
        const selected = await selectUsable(client, credentialHash, "CONTACT_VERIFICATION", now);
        if (selected.status !== "usable") return { status: selected.status };
        await client.query("UPDATE identity_action_tokens SET used_at = $2 WHERE id = $1", [selected.token.id, now]);
        const activated = await client.query("UPDATE users SET contact_verified = true, status = 'ACTIVE', updated_at = $2 WHERE id = $1 AND status = 'PENDING_VERIFICATION' RETURNING id", [selected.token.user_id, now]);
        if (activated.rowCount !== 1) return { status: "invalid_state" };
        return { status: "verified", userId: selected.token.user_id };
      });
    },

    async resetPassword({ credentialHash, passwordHash, now }) {
      assertHash(credentialHash);
      assertPasswordHash(passwordHash);
      return transaction(pool, async (client) => {
        const selected = await selectUsable(client, credentialHash, "PASSWORD_RESET", now);
        if (selected.status !== "usable") return { status: selected.status };
        const userId = selected.token.user_id;
        await client.query("UPDATE identity_action_tokens SET used_at = $2 WHERE id = $1", [selected.token.id, now]);
        await client.query("UPDATE users SET password_hash = $2, updated_at = $3 WHERE id = $1", [userId, passwordHash, now]);
        await client.query("UPDATE identity_action_tokens SET revoked_at = COALESCE(revoked_at, $2) WHERE user_id = $1 AND used_at IS NULL", [userId, now]);
        await client.query("UPDATE refresh_families SET revoked_at = COALESCE(revoked_at, $2), revoke_reason = COALESCE(revoke_reason, 'password_reset') WHERE user_id = $1", [userId, now]);
        await client.query("UPDATE refresh_credentials rc SET revoked_at = COALESCE(rc.revoked_at, $2) FROM refresh_families rf WHERE rc.family_id = rf.id AND rf.user_id = $1", [userId, now]);
        await client.query("UPDATE access_sessions SET revoked_at = COALESCE(revoked_at, $2) WHERE user_id = $1", [userId, now]);
        return { status: "reset", userId };
      });
    }
  });
}
