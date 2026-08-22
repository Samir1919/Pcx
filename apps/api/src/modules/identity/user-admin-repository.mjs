import { Role } from "@pcx/domain";

const canonicalStatuses = new Set(["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "DISABLED"]);

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

function maskContact(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  if (value.includes("@")) {
    const [local, domain] = value.split("@");
    const head = local.slice(0, 2);
    return `${head}***@${domain}`;
  }
  const head = value.slice(0, 3);
  const tail = value.slice(-2);
  return `${head}***${tail}`;
}

function publicUser(row) {
  return Object.freeze({
    id: row.id,
    email: maskContact(row.email),
    phone: maskContact(row.phone),
    status: row.status,
    contactVerified: row.contact_verified === true,
    roles: Object.freeze([...(row.roles ?? [])]),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null
  });
}

// Identity management repository. Only canonical roles/statuses are accepted,
// and every write assigns the actor for auditability.
export function createUserAdminRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async list({ q = null, status = null, role = null, limit = 50, cursor = null } = {}) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new TypeError("limit is invalid");
      const values = [];
      const where = [];
      const add = (value) => { values.push(value); return `$${values.length}`; };

      if (q && typeof q === "string" && q.trim()) {
        const parameter = add(`%${q.trim().replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
        where.push(`(u.email ILIKE ${parameter} ESCAPE '\\' OR u.phone ILIKE ${parameter} ESCAPE '\\')`);
      }
      if (status) {
        if (!canonicalStatuses.has(status)) throw new TypeError("status is invalid");
        where.push(`u.status = ${add(status)}`);
      }
      if (role) {
        if (!Object.values(Role).includes(role)) throw new TypeError("role is invalid");
        where.push(`EXISTS (SELECT 1 FROM user_roles ur2 JOIN roles r2 ON r2.id = ur2.role_id WHERE ur2.user_id = u.id AND r2.code = ${add(role)})`);
      }
      if (cursor) {
        const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
        where.push(`(u.created_at, u.id::text) < (${add(decoded.createdAt)}, ${add(decoded.id)})`);
      }

      const pageSize = add(limit + 1);
      const result = await pool.query(
        `SELECT u.id, u.email, u.phone, u.status, u.contact_verified, u.created_at,
                COALESCE(array_agg(r.code ORDER BY r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
         GROUP BY u.id
         ORDER BY u.created_at DESC, u.id::text DESC
         LIMIT ${pageSize}`,
        values
      );

      const hasNext = result.rows.length > limit;
      const rows = result.rows.slice(0, limit);
      const nextCursor = hasNext && rows.length > 0
        ? Buffer.from(JSON.stringify({ id: rows.at(-1).id, createdAt: new Date(rows.at(-1).created_at).toISOString() })).toString("base64url")
        : null;
      return { rows: rows.map(publicUser), nextCursor };
    },

    async findRoles(userId) {
      const exists = await pool.query("SELECT 1 FROM users WHERE id::text = $1", [userId]);
      if (exists.rowCount !== 1) return null;
      const result = await pool.query(
        `SELECT r.code
         FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id::text = $1`,
        [userId]
      );
      return result.rows.map((row) => row.code);
    },

    async findStatus(userId) {
      const result = await pool.query("SELECT status, id FROM users WHERE id::text = $1", [userId]);
      return result.rows[0] ?? null;
    },

    async updateStatus({ userId, status, actorId, now }) {
      if (!canonicalStatuses.has(status)) throw new TypeError("status is invalid");
      return transaction(pool, async (client) => {
        const updated = await client.query(
          "UPDATE users SET status = $2, updated_at = $3 WHERE id::text = $1 RETURNING id, email, phone, status, contact_verified, created_at",
          [userId, status, now]
        );
        if (updated.rowCount !== 1) return null;
        return publicUser(updated.rows[0]);
      });
    },

    async replaceRoles({ userId, roles, actorId, now }) {
      return transaction(pool, async (client) => {
        await client.query("DELETE FROM user_roles WHERE user_id::text = $1", [userId]);
        if (roles.length === 0) return [];
        const byCode = new Map();
        for (const code of roles) {
          const found = await client.query("SELECT id FROM roles WHERE code = $1", [code]);
          if (found.rowCount !== 1) throw new TypeError("unknown role");
          byCode.set(code, found.rows[0].id);
        }
        for (const code of roles) {
          await client.query(
            "INSERT INTO user_roles(user_id, role_id, assigned_by, assigned_at) VALUES ($1, $2, $3, $4)",
            [userId, byCode.get(code), actorId, now]
          );
        }
        return [...roles];
      });
    },

    // Revoke every role and set DISABLED/SUSPENDED for a user being deactivated.
    async disableRefreshSessions(userId, now) {
      await pool.query("UPDATE refresh_families SET revoked_at = COALESCE(revoked_at, $2), revoke_reason = 'user_disabled' WHERE user_id::text = $1", [userId, now]);
    },

    // Persist a validated security-audit event (identity status/role changes).
    async recordAudit(event) {
      await pool.query(
        "INSERT INTO auth_audit_events(id, actor_id, action, target_type, target_id, request_id, reason, changes, occurred_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)",
        [event.id, event.actorId, event.action, event.targetType, event.targetId, event.requestId, event.reason, JSON.stringify(event.changes), event.occurredAt]
      );
    }
  });
}
