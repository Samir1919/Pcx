async function transaction(pool, operation) {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const result = await operation(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function audit(client, { id, actorId, action, targetType, targetId, requestId, changes, occurredAt }) {
  await client.query(
    "INSERT INTO auth_audit_events(id,actor_id,action,target_type,target_id,request_id,changes,occurred_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)",
    [id, actorId, action, targetType, targetId, requestId, JSON.stringify(changes), occurredAt]
  );
}

export function createPostgresSellTaxonomyCommandRepository({ pool }) {
  if (!pool || typeof pool.connect !== "function" || typeof pool.query !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async createEntry(entry, updatedAt, auditEvent) {
      return transaction(pool, async (client) => {
        const result = await client.query(
          `INSERT INTO sell_entry_config(id, entry_key, category_id, kind, icon_key, hint, sort_order, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
           RETURNING entry_key`,
          [entry.id, entry.entryKey, entry.categoryId, entry.kind, entry.iconKey, entry.hint, entry.sortOrder, entry.isActive, updatedAt]
        );
        await audit(client, auditEvent);
        return result.rows[0].entry_key;
      });
    },

    async updateEntry(entryKey, patch, updatedAt, auditEvent) {
      return transaction(pool, async (client) => {
        const sets = [];
        const values = [entryKey];
        const add = (v) => { values.push(v); return `$${values.length}`; };
        if (patch.iconKey !== undefined) sets.push(`icon_key=${add(patch.iconKey)}`);
        if (patch.hint !== undefined) sets.push(`hint=${add(patch.hint)}`);
        if (patch.sortOrder !== undefined) sets.push(`sort_order=${add(patch.sortOrder)}`);
        if (patch.isActive !== undefined) sets.push(`is_active=${add(patch.isActive)}`);
        if (sets.length === 0) return false;
        sets.push(`updated_at=${add(updatedAt)}`);
        const result = await client.query(
          `UPDATE sell_entry_config SET ${sets.join(", ")} WHERE entry_key=$1 RETURNING entry_key`,
          values
        );
        if (result.rowCount !== 1) return false;
        await audit(client, auditEvent);
        return true;
      });
    },

    async updateComponent(entryKey, role, patch, updatedAt, auditEvent) {
      return transaction(pool, async (client) => {
        const sets = [];
        const values = [entryKey, role];
        const add = (v) => { values.push(v); return `$${values.length}`; };
        if (patch.categoryId !== undefined) sets.push(`category_id=${add(patch.categoryId)}`);
        if (patch.required !== undefined) sets.push(`required=${add(patch.required)}`);
        if (patch.sortOrder !== undefined) sets.push(`sort_order=${add(patch.sortOrder)}`);
        if (sets.length === 0) return false;
        sets.push(`updated_at=${add(updatedAt)}`);
        const result = await client.query(
          `UPDATE sell_build_components SET ${sets.join(", ")} WHERE entry_key=$1 AND role=$2 RETURNING id`,
          values
        );
        if (result.rowCount !== 1) return false;
        await audit(client, auditEvent);
        return true;
      });
    }
  });
}
