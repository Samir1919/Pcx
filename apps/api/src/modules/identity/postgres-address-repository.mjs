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
  } finally { client.release(); }
}

const columns = "id, user_id, label, recipient_name, phone, address_line_1, address_line_2, area, city, postal_code, is_default, created_at, updated_at";

function dto(row) {
  return Object.freeze({ id: row.id, label: row.label, recipientName: row.recipient_name, phone: row.phone, addressLine1: row.address_line_1, addressLine2: row.address_line_2, area: row.area, city: row.city, postalCode: row.postal_code, isDefault: row.is_default, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() });
}

export function createPostgresAddressRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");
  return Object.freeze({
    async findByOwner(userId, addressId) {
      const result = await pool.query(`SELECT ${columns} FROM addresses WHERE user_id = $1 AND id = $2`, [userId, addressId]);
      return result.rows[0] ? dto(result.rows[0]) : null;
    },
    async listByOwner(userId) {
      const result = await pool.query(`SELECT ${columns} FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at, id`, [userId]);
      return result.rows.map(dto);
    },
    async create(address) {
      return transaction(pool, async (client) => {
        const eligible = await client.query("SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE u.id = $1 AND u.status = 'ACTIVE' AND r.code = 'CUSTOMER' FOR UPDATE OF u", [address.userId]);
        if (eligible.rowCount !== 1) return { status: "ineligible" };
        if (address.isDefault) await client.query("UPDATE addresses SET is_default = false, updated_at = $2 WHERE user_id = $1 AND is_default = true", [address.userId, address.createdAt]);
        const result = await client.query(`INSERT INTO addresses(id, user_id, label, recipient_name, phone, address_line_1, address_line_2, area, city, postal_code, is_default, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING ${columns}`, [address.id, address.userId, address.label, address.recipientName, address.phone, address.addressLine1, address.addressLine2, address.area, address.city, address.postalCode, address.isDefault, address.createdAt]);
        return { status: "created", address: dto(result.rows[0]) };
      });
    },
    async update(userId, addressId, changes, updatedAt) {
      return transaction(pool, async (client) => {
        const owned = await client.query("SELECT id FROM addresses WHERE id = $1 AND user_id = $2 FOR UPDATE", [addressId, userId]);
        if (owned.rowCount !== 1) return null;
        if (changes.isDefault) await client.query("UPDATE addresses SET is_default = false, updated_at = $2 WHERE user_id = $1 AND id <> $3 AND is_default = true", [userId, updatedAt, addressId]);
        const result = await client.query(`UPDATE addresses SET label=$3, recipient_name=$4, phone=$5, address_line_1=$6, address_line_2=$7, area=$8, city=$9, postal_code=$10, is_default=$11, updated_at=$12 WHERE id=$1 AND user_id=$2 RETURNING ${columns}`, [addressId, userId, changes.label, changes.recipientName, changes.phone, changes.addressLine1, changes.addressLine2, changes.area, changes.city, changes.postalCode, changes.isDefault, updatedAt]);
        return dto(result.rows[0]);
      });
    },
    async delete(userId, addressId) {
      const result = await pool.query("DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id", [addressId, userId]);
      return result.rowCount === 1;
    }
  });
}
