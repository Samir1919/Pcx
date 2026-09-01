function policy(row) {
  return Object.freeze({
    id: row.id,
    name: row.name,
    durationDays: row.duration_days,
    coverageSummary: row.coverage_summary,
    terms: row.terms,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null
  });
}

const columns = "id, name, duration_days, coverage_summary, terms, status, created_at, archived_at";

export function createPostgresWarrantyPolicyRepository({ pool }) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async create(record) {
      const result = await pool.query(
        `INSERT INTO warranty_policies(id, name, duration_days, coverage_summary, terms, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6)
         RETURNING ${columns}`,
        [record.id, record.name, record.durationDays, record.coverageSummary, record.terms, record.createdAt]
      );
      return policy(result.rows[0]);
    },

    async list() {
      const result = await pool.query(`SELECT ${columns} FROM warranty_policies ORDER BY created_at DESC LIMIT 100`);
      return result.rows.map(policy);
    },

    async findById(id) {
      const result = await pool.query(`SELECT ${columns} FROM warranty_policies WHERE id::text = $1`, [id]);
      return result.rows[0] ? policy(result.rows[0]) : null;
    },

    async archive(id, now) {
      const result = await pool.query(
        `UPDATE warranty_policies SET status = 'ARCHIVED', archived_at = $2
         WHERE id::text = $1 AND status = 'ACTIVE'
         RETURNING ${columns}`,
        [id, now]
      );
      return result.rows[0] ? policy(result.rows[0]) : null;
    }
  });
}
