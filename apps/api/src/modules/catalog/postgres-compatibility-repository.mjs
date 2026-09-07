async function transaction(pool, operation) {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const result = await operation(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function audit(client, e) {
  await client.query("INSERT INTO auth_audit_events(id,actor_id,action,target_type,target_id,request_id,changes,occurred_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)", [e.id, e.actorId, e.action, e.targetType, e.targetId, e.requestId, JSON.stringify(e.changes), e.occurredAt]);
}

function timestamp(value) { return new Date(value).toISOString(); }

function referenceValue(row) {
  return Object.freeze({ id: row.id, key: row.key, value: row.value, label: row.label, sortOrder: row.sort_order, status: row.status, createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at) });
}

function rule(row) {
  return Object.freeze({ id: row.id, sourceCategoryId: row.source_category_id, sourceKey: row.source_key, operator: row.operator, targetCategoryId: row.target_category_id, targetKey: row.target_key, required: row.required, reason: row.reason, sortOrder: row.sort_order, status: row.status, createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at) });
}

export function createPostgresCompatibilityRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async listReferenceValues() {
      const r = await pool.query("SELECT * FROM reference_values WHERE status='ACTIVE' ORDER BY key, sort_order, value");
      return r.rows.map(referenceValue);
    },
    async listReferenceValuesByKey(key) {
      const r = await pool.query("SELECT * FROM reference_values WHERE status='ACTIVE' AND key=$1 ORDER BY sort_order, value", [key]);
      return r.rows.map(referenceValue);
    },
    async createReferenceValue(record, auditEvent) {
      return transaction(pool, async (c) => {
        await c.query("INSERT INTO reference_values(id,key,value,label,sort_order,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$7)", [record.id, record.key, record.value, record.label, record.sortOrder, record.status, record.createdAt]);
        await audit(c, auditEvent);
        return record;
      });
    },
    async archiveReferenceValue(id, now, auditEvent) {
      return transaction(pool, async (c) => {
        const q = await c.query("UPDATE reference_values SET status='ARCHIVED',archived_at=COALESCE(archived_at,$2),updated_at=$2 WHERE id::text=$1 AND status='ACTIVE'", [id, now]);
        if (q.rowCount !== 1) return false;
        await audit(c, auditEvent);
        return true;
      });
    },
    async listRules() {
      const r = await pool.query("SELECT * FROM compatibility_rules WHERE status='ACTIVE' ORDER BY sort_order, source_key");
      return r.rows.map(rule);
    },
    async createRule(record, auditEvent) {
      return transaction(pool, async (c) => {
        await c.query("INSERT INTO compatibility_rules(id,source_category_id,source_key,operator,target_category_id,target_key,required,reason,sort_order,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)", [record.id, record.sourceCategoryId, record.sourceKey, record.operator, record.targetCategoryId, record.targetKey, record.required, record.reason, record.sortOrder, record.status, record.createdAt]);
        await audit(c, auditEvent);
        return record;
      });
    },
    async archiveRule(id, now, auditEvent) {
      return transaction(pool, async (c) => {
        const q = await c.query("UPDATE compatibility_rules SET status='ARCHIVED',archived_at=COALESCE(archived_at,$2),updated_at=$2 WHERE id::text=$1 AND status='ACTIVE'", [id, now]);
        if (q.rowCount !== 1) return false;
        await audit(c, auditEvent);
        return true;
      });
    }
  });
}
