export function createPostgresScheduledExportRepository({ pool }) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("PostgreSQL pool is required");

  function row(r) {
    return Object.freeze({
      id: r.id,
      name: r.name,
      report: r.report,
      format: r.format,
      cadence: r.cadence,
      enabled: r.enabled,
      lastRunAt: r.last_run_at ? new Date(r.last_run_at).toISOString() : null,
      lastRowCount: r.last_row_count == null ? null : Number(r.last_row_count),
      createdAt: new Date(r.created_at).toISOString()
    });
  }

  return Object.freeze({
    async list() {
      const result = await pool.query(
        `SELECT id, name, report, format, cadence, enabled, last_run_at, last_row_count, created_at
         FROM scheduled_exports ORDER BY created_at`
      );
      return result.rows.map(row);
    },

    async create(record) {
      const result = await pool.query(
        `INSERT INTO scheduled_exports(id, name, report, format, cadence, enabled, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, report, format, cadence, enabled, last_run_at, last_row_count, created_at`,
        [record.id, record.name, record.report, record.format, record.cadence, record.enabled, record.createdAt]
      );
      return row(result.rows[0]);
    },

    // Due exports are enabled rows whose cadence window has elapsed since the
    // last run (or that have never run).
    async findDue(now, cadenceHours = { daily: 24, weekly: 168 }) {
      const result = await pool.query(
        `SELECT id, name, report, format, cadence, enabled, last_run_at, last_row_count, created_at
         FROM scheduled_exports
         WHERE enabled = true`
      );
      return result.rows
        .map(row)
        .filter((r) => {
          const hours = cadenceHours[r.cadence] ?? 24;
          const due = r.lastRunAt == null || new Date(r.lastRunAt).getTime() + hours * 3_600_000 <= new Date(now).getTime();
          return due;
        });
    },

    async markRun(id, lastRunAt, lastRowCount) {
      const result = await pool.query(
        `UPDATE scheduled_exports SET last_run_at = $2, last_row_count = $3 WHERE id::text = $1
         RETURNING id, name, report, format, cadence, enabled, last_run_at, last_row_count, created_at`,
        [id, lastRunAt, lastRowCount]
      );
      return result.rows[0] ? row(result.rows[0]) : null;
    },

    async remove(id) {
      const result = await pool.query(
        `DELETE FROM scheduled_exports WHERE id::text = $1
         RETURNING id, name, report, format, cadence, enabled, last_run_at, last_row_count, created_at`,
        [id]
      );
      return result.rows[0] ? row(result.rows[0]) : null;
    }
  });
}