function assertHash(value, name) {
  if (!Buffer.isBuffer(value) || value.length !== 32) throw new TypeError(`${name} must be a 32-byte hash`);
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

export function createPostgresIdentityRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  async function revokeFamily(client, familyId, reason, now) {
    await client.query("UPDATE refresh_families SET revoked_at = COALESCE(revoked_at, $2), revoke_reason = COALESCE(revoke_reason, $3) WHERE id = $1", [familyId, now, reason]);
    await client.query("UPDATE refresh_credentials SET revoked_at = COALESCE(revoked_at, $2) WHERE family_id = $1", [familyId, now]);
    await client.query("UPDATE access_sessions SET revoked_at = COALESCE(revoked_at, $2) WHERE refresh_family_id = $1", [familyId, now]);
  }

  return Object.freeze({
    async createCustomer({ id, email, phone, passwordHash, createdAt }) {
      assertPasswordHash(passwordHash);
      return transaction(pool, async (client) => {
        const inserted = await client.query(
          "INSERT INTO users(id, email, phone, password_hash, status, contact_verified, created_at, updated_at) VALUES ($1, $2, $3, $4, 'PENDING_VERIFICATION', false, $5, $5) RETURNING id, email, phone, status, contact_verified",
          [id, email, phone, passwordHash, createdAt]
        );
        const role = await client.query("SELECT id FROM roles WHERE code = 'CUSTOMER'");
        if (role.rowCount !== 1) throw new Error("canonical CUSTOMER role is missing");
        await client.query("INSERT INTO user_roles(user_id, role_id, assigned_at) VALUES ($1, $2, $3)", [id, role.rows[0].id, createdAt]);
        return inserted.rows[0];
      });
    },

    async findPasswordIdentityByContact(contact) {
      if (typeof contact !== "string" || contact.length === 0) throw new TypeError("contact is required");
      const normalized = contact.trim();
      const byEmail = normalized.includes("@");
      const result = await pool.query(
        `SELECT u.id, u.email, u.phone, u.password_hash, u.status, u.contact_verified,
                COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE ${byEmail ? "lower(u.email) = lower($1)" : "u.phone = $1"}
         GROUP BY u.id`,
        [normalized]
      );
      return result.rows[0] ?? null;
    },

    async createSession({ userId, familyId, refreshId, refreshHash, refreshExpiresAt, accessId, accessHash, accessExpiresAt, createdAt, ipHash = null, userAgent = null }) {
      assertHash(refreshHash, "refreshHash");
      assertHash(accessHash, "accessHash");
      return transaction(pool, async (client) => {
        await client.query("INSERT INTO refresh_families(id, user_id, created_at) VALUES ($1, $2, $3)", [familyId, userId, createdAt]);
        await client.query("INSERT INTO refresh_credentials(id, family_id, credential_hash, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)", [refreshId, familyId, refreshHash, refreshExpiresAt, createdAt]);
        await client.query("INSERT INTO access_sessions(id, user_id, credential_hash, refresh_family_id, expires_at, created_at, ip_hash, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [accessId, userId, accessHash, familyId, accessExpiresAt, createdAt, ipHash, userAgent]);
        return { familyId, refreshId, accessId };
      });
    },

    async findActiveIdentityByAccessHash(accessHash, now) {
      assertHash(accessHash, "accessHash");
      const result = await pool.query(
        `SELECT u.id user_id, u.status, u.contact_verified,
                COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') roles
         FROM access_sessions s
         JOIN users u ON u.id = s.user_id
         JOIN refresh_families f ON f.id = s.refresh_family_id
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE s.credential_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > $2
           AND f.revoked_at IS NULL AND u.status = 'ACTIVE'
         GROUP BY u.id`,
        [accessHash, now]
      );
      const row = result.rows[0];
      return row ? { userId: row.user_id, status: row.status, contactVerified: row.contact_verified, roles: row.roles } : null;
    },

    async rotateRefresh({ presentedHash, newRefreshId, newRefreshHash, newRefreshExpiresAt, newAccessId, newAccessHash, newAccessExpiresAt, now, ipHash = null, userAgent = null }) {
      assertHash(presentedHash, "presentedHash");
      assertHash(newRefreshHash, "newRefreshHash");
      assertHash(newAccessHash, "newAccessHash");
      return transaction(pool, async (client) => {
        const selected = await client.query(
          `SELECT rc.id, rc.family_id, rc.used_at, rc.revoked_at, rc.replaced_by_id, rc.expires_at,
                  rf.user_id, rf.revoked_at family_revoked_at
           FROM refresh_credentials rc JOIN refresh_families rf ON rf.id = rc.family_id
           WHERE rc.credential_hash = $1 FOR UPDATE OF rc, rf`,
          [presentedHash]
        );
        if (selected.rowCount !== 1) return { status: "invalid" };
        const current = selected.rows[0];
        if (current.family_revoked_at) return { status: "invalid" };
        const expired = new Date(current.expires_at).getTime() <= new Date(now).getTime();
        if (current.used_at || current.revoked_at || current.replaced_by_id || expired) {
          await revokeFamily(client, current.family_id, expired ? "refresh_expired" : "refresh_reuse_detected", now);
          return { status: expired ? "expired" : "reuse_detected" };
        }
        await client.query("INSERT INTO refresh_credentials(id, family_id, credential_hash, parent_id, expires_at, created_at) VALUES ($1, $2, $3, $4, $5, $6)", [newRefreshId, current.family_id, newRefreshHash, current.id, newRefreshExpiresAt, now]);
        await client.query("UPDATE refresh_credentials SET used_at = $2, replaced_by_id = $3 WHERE id = $1", [current.id, now, newRefreshId]);
        await client.query("UPDATE access_sessions SET revoked_at = COALESCE(revoked_at, $2) WHERE refresh_family_id = $1", [current.family_id, now]);
        await client.query("INSERT INTO access_sessions(id, user_id, credential_hash, refresh_family_id, expires_at, created_at, ip_hash, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [newAccessId, current.user_id, newAccessHash, current.family_id, newAccessExpiresAt, now, ipHash, userAgent]);
        return { status: "rotated", familyId: current.family_id, userId: current.user_id };
      });
    },

    async revokeFamilyByRefreshHash(refreshHash, reason, now) {
      assertHash(refreshHash, "refreshHash");
      return transaction(pool, async (client) => {
        const selected = await client.query("SELECT family_id FROM refresh_credentials WHERE credential_hash = $1 FOR UPDATE", [refreshHash]);
        if (selected.rowCount !== 1) return false;
        await revokeFamily(client, selected.rows[0].family_id, reason, now);
        return true;
      });
    }
  });
}
