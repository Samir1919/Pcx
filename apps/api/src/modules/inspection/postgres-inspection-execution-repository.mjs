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

function inspection(row) {
  return Object.freeze({
    id: row.id,
    inventoryItemId: row.inventory_item_id,
    inspectionTemplateId: row.inspection_template_id,
    technicianUserId: row.technician_user_id,
    supervisorUserId: row.supervisor_user_id,
    status: row.status,
    suggestedGrade: row.suggested_grade,
    startedAt: new Date(row.started_at).toISOString(),
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
    finalizedAt: row.finalized_at ? new Date(row.finalized_at).toISOString() : null,
    notes: row.notes
  });
}

function result(row) {
  return Object.freeze({
    id: row.id,
    inspectionId: row.inspection_id,
    inspectionTemplateItemId: row.inspection_template_item_id,
    resultStatus: row.result_status,
    valueNumber: row.value_number == null ? null : Number(row.value_number),
    valueText: row.value_text,
    passBoolean: row.pass_boolean,
    notes: row.notes
  });
}

function health(row) {
  return Object.freeze({
    id: row.id,
    inspectionId: row.inspection_id,
    inventoryItemId: row.inventory_item_id,
    score: row.score,
    formulaVersion: row.formula_version,
    components: row.components,
    createdAt: new Date(row.created_at).toISOString()
  });
}

export function createPostgresInspectionExecutionRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async create(record, now) {
      const inserted = await pool.query(
        `INSERT INTO inspections(id, inventory_item_id, inspection_template_id, technician_user_id, status, started_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         RETURNING id, inventory_item_id, inspection_template_id, technician_user_id, supervisor_user_id, status, suggested_grade, started_at, submitted_at, finalized_at, notes`,
        [record.id, record.inventoryItemId, record.inspectionTemplateId, record.technicianUserId, record.status, now]
      );
      return inspection(inserted.rows[0]);
    },

    async findById(id) {
      const result = await pool.query(
        "SELECT id, inventory_item_id, inspection_template_id, technician_user_id, supervisor_user_id, status, suggested_grade, started_at, submitted_at, finalized_at, notes FROM inspections WHERE id::text = $1",
        [id]
      );
      return result.rows[0] ? inspection(result.rows[0]) : null;
    },

    // Latest live inspection for a physical item (DRAFT/SUBMITTED/ESCALATED).
    async findActiveByItem(inventoryItemId) {
      const result = await pool.query(
        "SELECT id, inventory_item_id, inspection_template_id, technician_user_id, supervisor_user_id, status, suggested_grade, started_at, submitted_at, finalized_at, notes FROM inspections WHERE inventory_item_id::text = $1 AND status IN ('DRAFT','SUBMITTED','ESCALATED') ORDER BY created_at DESC LIMIT 1",
        [inventoryItemId]
      );
      return result.rows[0] ? inspection(result.rows[0]) : null;
    },

    async listByItem(inventoryItemId) {
      const result = await pool.query(
        "SELECT id, inventory_item_id, inspection_template_id, technician_user_id, supervisor_user_id, status, suggested_grade, started_at, submitted_at, finalized_at, notes FROM inspections WHERE inventory_item_id::text = $1 ORDER BY created_at DESC",
        [inventoryItemId]
      );
      return result.rows.map(inspection);
    },

    // Editable DRAFT results: replace the single template item's result row.
    async upsertResult(record, now) {
      return transaction(pool, async (client) => {
        await client.query("DELETE FROM test_results WHERE inspection_id::text = $1 AND inspection_template_item_id::text = $2", [record.inspectionId, record.inspectionTemplateItemId]);
        const inserted = await client.query(
          `INSERT INTO test_results(id, inspection_id, inspection_template_item_id, result_status, value_number, value_text, pass_boolean, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, inspection_id, inspection_template_item_id, result_status, value_number, value_text, pass_boolean, notes`,
          [record.id, record.inspectionId, record.inspectionTemplateItemId, record.resultStatus, record.valueNumber, record.valueText, record.passBoolean, record.notes, now]
        );
        return result(inserted.rows[0]);
      });
    },

    async listResults(inspectionId) {
      const rows = await pool.query(
        "SELECT id, inspection_id, inspection_template_item_id, result_status, value_number, value_text, pass_boolean, notes FROM test_results WHERE inspection_id::text = $1 ORDER BY created_at",
        [inspectionId]
      );
      return rows.rows.map(result);
    },

    async findHealthScore(inspectionId) {
      const rows = await pool.query(
        "SELECT id, inspection_id, inventory_item_id, score, formula_version, components, created_at FROM health_scores WHERE inspection_id::text = $1 LIMIT 1",
        [inspectionId]
      );
      return rows.rows[0] ? health(rows.rows[0]) : null;
    },

    // Atomically persist the server-derived health score and advance the
    // inspection to SUBMITTED or ESCALATED.
    async submit(inspectionId, { status, submittedAt, healthScore, suggestedGrade }, now) {
      return transaction(pool, async (client) => {
        await client.query(
          `INSERT INTO health_scores(id, inspection_id, inventory_item_id, score, formula_version, components, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [healthScore.id, inspectionId, healthScore.inventoryItemId, healthScore.score, healthScore.formulaVersion, JSON.stringify(healthScore.components), now]
        );
        await client.query(
          "UPDATE inspections SET status = $2, submitted_at = $3, suggested_grade = $4 WHERE id::text = $1",
          [inspectionId, status, submittedAt, suggestedGrade]
        );
        return { status: "submitted" };
      });
    },

    // Finalize APPROVED/REJECTED and record the verified grade/health directly
    // on the physical inventory item (server-owned, inspection-derived).
    async finalize(inspectionId, { status, supervisorUserId, finalizedAt, grade, score }, now) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE inspections SET status = $2, supervisor_user_id = $3, finalized_at = $4
           WHERE id::text = $1 AND status IN ('SUBMITTED','ESCALATED')
           RETURNING inventory_item_id`,
          [inspectionId, status, supervisorUserId, finalizedAt]
        );
        if (updated.rowCount !== 1) return { status: "not_finalizable", itemId: null };
        const itemId = updated.rows[0].inventory_item_id;
        const itemStatus = status === "APPROVED" ? "APPROVED" : "REJECTED";
        await client.query(
          `UPDATE inventory_items
           SET condition_grade = $2, current_health_score = $3, status = $4, approved_at = $5, updated_at = $5
           WHERE id::text = $1`,
          [itemId, grade, score, itemStatus, finalizedAt]
        );
        return { status: "finalized", itemId };
      });
    }
  });
}
