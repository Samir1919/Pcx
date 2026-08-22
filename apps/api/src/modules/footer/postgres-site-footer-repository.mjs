async function transaction(pool, operation) {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const result = await operation(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

function mapRow(row) {
  if (!row) return null;
  return Object.freeze({
    tagline: row.tagline,
    copyright: row.copyright,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    address: row.address,
    tradeLicense: row.trade_license,
    bin: row.bin,
    socialLinks: Object.freeze(Array.isArray(row.social_links) ? row.social_links : []),
    linkColumns: Object.freeze(Array.isArray(row.link_columns) ? row.link_columns : [])
  });
}

export function createPostgresSiteFooterRepository({ pool }) {
  if (!pool || typeof pool.connect !== "function" || typeof pool.query !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    // Public projection only — no id or lifecycle fields.
    async getActive() {
      const result = await pool.query(
        `SELECT tagline, copyright, contact_email, contact_phone, address, trade_license, bin, social_links, link_columns
         FROM site_footer
         WHERE is_active = true
         ORDER BY created_at, id
         LIMIT 1`
      );
      return mapRow(result.rows[0]) ?? emptyFooter();
    },

    async get() {
      const result = await pool.query(
        `SELECT tagline, copyright, contact_email, contact_phone, address, trade_license, bin, social_links, link_columns, is_active, updated_at
         FROM site_footer
         ORDER BY created_at, id
         LIMIT 1`
      );
      const row = result.rows[0];
      if (!row) return Object.freeze({ ...emptyFooter(), isActive: true, updatedAt: null });
      return Object.freeze({ ...mapRow(row), isActive: row.is_active, updatedAt: row.updated_at });
    },

    // Upsert the singleton row and append a durable audit event.
    async save(footer, updatedAt, auditEvent) {
      return transaction(pool, async (client) => {
        const result = await client.query(
          `INSERT INTO site_footer(id, tagline, copyright, contact_email, contact_phone, address, trade_license, bin, social_links, link_columns, is_active, updated_at)
           VALUES ('a0000000-0000-0000-0000-000000000001', $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, true, $10)
           ON CONFLICT (id) DO UPDATE SET
             tagline = EXCLUDED.tagline,
             copyright = EXCLUDED.copyright,
             contact_email = EXCLUDED.contact_email,
             contact_phone = EXCLUDED.contact_phone,
             address = EXCLUDED.address,
             trade_license = EXCLUDED.trade_license,
             bin = EXCLUDED.bin,
             social_links = EXCLUDED.social_links,
             link_columns = EXCLUDED.link_columns,
             updated_at = EXCLUDED.updated_at
           RETURNING tagline, copyright, contact_email, contact_phone, address, trade_license, bin, social_links, link_columns`,
          [
            footer.tagline,
            footer.copyright,
            footer.contactEmail,
            footer.contactPhone,
            footer.address,
            footer.tradeLicense,
            footer.bin,
            JSON.stringify(footer.socialLinks),
            JSON.stringify(footer.linkColumns),
            updatedAt
          ]
        );
        await client.query(
          "INSERT INTO auth_audit_events(id, actor_id, action, target_type, target_id, request_id, changes, occurred_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)",
          [auditEvent.id, auditEvent.actorId, auditEvent.action, auditEvent.targetType, auditEvent.targetId, auditEvent.requestId, JSON.stringify(auditEvent.changes), auditEvent.occurredAt]
        );
        return mapRow(result.rows[0]);
      });
    }
  });
}

function emptyFooter() {
  return Object.freeze({
    tagline: "",
    copyright: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    tradeLicense: "",
    bin: "",
    socialLinks: Object.freeze([]),
    linkColumns: Object.freeze([])
  });
}
