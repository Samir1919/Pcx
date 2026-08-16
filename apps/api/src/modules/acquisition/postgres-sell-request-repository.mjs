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

function row(record) {
  return Object.freeze({
    id: record.id,
    publicRequestNo: record.public_request_no,
    userId: record.user_id,
    categoryId: record.category_id,
    productModelId: record.product_model_id,
    contactName: record.contact_name,
    contactPhone: record.contact_phone,
    contactEmail: record.contact_email,
    fulfilmentPreference: record.fulfilment_preference,
    status: record.status,
    submittedAt: record.submitted_at,
    createdAt: new Date(record.created_at).toISOString(),
    updatedAt: new Date(record.updated_at).toISOString(),
    declaration: record.declaration_id ? Object.freeze({
      id: record.declaration_id,
      ageEstimate: record.age_estimate,
      warrantyRemaining: record.warranty_remaining,
      repairDeclared: record.repair_declared,
      repairNotes: record.repair_notes,
      boxAvailable: record.box_available,
      invoiceAvailable: record.invoice_available,
      ownershipDeclared: record.ownership_declared
    }) : null
  });
}

const selectClause = `
  SELECT sr.id, sr.public_request_no, sr.user_id, sr.category_id, sr.product_model_id,
         sr.contact_name, sr.contact_phone, sr.contact_email, sr.fulfilment_preference,
         sr.status, sr.submitted_at, sr.created_at, sr.updated_at,
         sd.id AS declaration_id, sd.age_estimate, sd.warranty_remaining, sd.repair_declared,
         sd.repair_notes, sd.box_available, sd.invoice_available, sd.ownership_declared
  FROM sell_requests sr
  LEFT JOIN seller_declarations sd ON sd.sell_request_id = sr.id`;

export function createPostgresSellRequestRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async create(request, declaration, now) {
      return transaction(pool, async (client) => {
        const inserted = await client.query(
          `INSERT INTO sell_requests(id, public_request_no, user_id, contact_name, contact_phone, contact_email, category_id, product_model_id, status, fulfilment_preference, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
           RETURNING id, public_request_no, user_id, category_id, product_model_id, contact_name, contact_phone, contact_email, fulfilment_preference, status, submitted_at, created_at, updated_at`,
          [request.id, request.publicRequestNo, request.userId, request.contactName, request.contactPhone, request.contactEmail, request.categoryId, request.productModelId, request.status, request.fulfilmentPreference, now]
        );
        await client.query(
          `INSERT INTO seller_declarations(id, sell_request_id, age_estimate, warranty_remaining, repair_declared, repair_notes, box_available, invoice_available, ownership_declared, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [declaration.id, declaration.sellRequestId, declaration.ageEstimate, declaration.warrantyRemaining, declaration.repairDeclared, declaration.repairNotes, declaration.boxAvailable, declaration.invoiceAvailable, declaration.ownershipDeclared, now]
        );
        const record = inserted.rows[0];
        return row({ ...record, declaration_id: declaration.id, age_estimate: declaration.ageEstimate, warranty_remaining: declaration.warrantyRemaining, repair_declared: declaration.repairDeclared, repair_notes: declaration.repairNotes, box_available: declaration.boxAvailable, invoice_available: declaration.invoiceAvailable, ownership_declared: declaration.ownershipDeclared });
      });
    },

    async submit(userId, requestId, now) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE sell_requests SET status = 'SUBMITTED', submitted_at = $3, updated_at = $3
           WHERE id = $1 AND user_id = $2 AND status = 'DRAFT'
           RETURNING id`,
          [requestId, userId, now]
        );
        if (updated.rowCount !== 1) return { status: "not_found" };
        const result = await client.query(`${selectClause} WHERE sr.id = $1 AND sr.user_id = $2`, [requestId, userId]);
        return { status: "submitted", record: row(result.rows[0]) };
      });
    },

    async findByOwner(userId, requestId) {
      const result = await pool.query(`${selectClause} WHERE sr.id = $1 AND sr.user_id = $2`, [requestId, userId]);
      return result.rows[0] ? row(result.rows[0]) : null;
    },

    async listByOwner(userId) {
      const result = await pool.query(`${selectClause} WHERE sr.user_id = $1 ORDER BY sr.created_at DESC`, [userId]);
      return result.rows.map(row);
    }
  });
}
