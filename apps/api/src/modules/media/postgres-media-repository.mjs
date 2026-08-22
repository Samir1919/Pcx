function media(row) {
  return Object.freeze({
    id: row.id,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    visibility: row.visibility,
    purpose: row.purpose,
    uploadedBy: row.uploaded_by,
    createdAt: new Date(row.created_at).toISOString()
  });
}

export function createPostgresMediaRepository({ pool }) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async create(record) {
      const result = await pool.query(
        `INSERT INTO media(id, storage_key, mime_type, size_bytes, visibility, purpose, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, storage_key, mime_type, size_bytes, visibility, purpose, uploaded_by, created_at`,
        [record.id, record.storageKey, record.mimeType, record.sizeBytes, record.visibility, record.purpose, record.uploadedBy]
      );
      return media(result.rows[0]);
    },

    async findById(id) {
      const result = await pool.query(
        "SELECT id, storage_key, mime_type, size_bytes, visibility, purpose, uploaded_by, created_at FROM media WHERE id::text = $1",
        [id]
      );
      return result.rows[0] ? media(result.rows[0]) : null;
    },

    async linkSellRequest(linkId, sellRequestId, mediaId, purpose) {
      await pool.query(
        "INSERT INTO sell_request_media(id, sell_request_id, media_id, purpose) VALUES ($1,$2,$3,$4)",
        [linkId, sellRequestId, mediaId, purpose]
      );
    },

    async linkInspection(linkId, inspectionId, mediaId, purpose) {
      await pool.query(
        "INSERT INTO inspection_media(id, inspection_id, media_id, purpose) VALUES ($1,$2,$3,$4)",
        [linkId, inspectionId, mediaId, purpose]
      );
    },

    async linkListing(linkId, listingId, mediaId, purpose) {
      await pool.query(
        "INSERT INTO listing_media(id, listing_id, media_id, purpose) VALUES ($1,$2,$3,$4)",
        [linkId, listingId, mediaId, purpose]
      );
    },

    async findSellRequestOwner(sellRequestId) {
      const result = await pool.query(
        "SELECT user_id FROM sell_requests WHERE id::text = $1",
        [sellRequestId]
      );
      return result.rows[0]?.user_id ?? null;
    },

    async listSellRequestMedia(sellRequestId) {
      const result = await pool.query(
        `SELECT m.id, m.storage_key, m.mime_type, m.size_bytes, m.visibility, m.purpose, m.uploaded_by, m.created_at
         FROM sell_request_media srm JOIN media m ON m.id = srm.media_id
         WHERE srm.sell_request_id::text = $1 ORDER BY m.created_at`,
        [sellRequestId]
      );
      return result.rows.map(media);
    },

    async listInspectionMedia(inspectionId) {
      const result = await pool.query(
        `SELECT m.id, m.storage_key, m.mime_type, m.size_bytes, m.visibility, m.purpose, m.uploaded_by, m.created_at
         FROM inspection_media im JOIN media m ON m.id = im.media_id
         WHERE im.inspection_id::text = $1 ORDER BY m.created_at`,
        [inspectionId]
      );
      return result.rows.map(media);
    },

    async listListingMedia(listingId) {
      const result = await pool.query(
        `SELECT m.id, m.storage_key, m.mime_type, m.size_bytes, m.visibility, m.purpose, m.uploaded_by, m.created_at
         FROM listing_media lm JOIN media m ON m.id = lm.media_id
         WHERE lm.listing_id::text = $1 ORDER BY m.created_at`,
        [listingId]
      );
      return result.rows.map(media);
    }
  });
}
