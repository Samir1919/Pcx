function category(row) {
  return row
    ? Object.freeze({ id: row.category_id ?? row.id, name: row.name, slug: row.slug, parentId: row.parent_id, sortOrder: row.sort_order })
    : null;
}

export function createPostgresSellTaxonomyRepository({ pool }) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async listEntries({ activeOnly = false } = {}) {
      const where = activeOnly ? "WHERE sec.is_active" : "";
      const entriesResult = await pool.query(
        `SELECT sec.id AS config_id, sec.entry_key, sec.kind, sec.icon_key, sec.icon_media_id, sec.hint, sec.sort_order, sec.is_active,
                c.id AS category_id, c.name, c.slug, c.parent_id, c.sort_order AS category_sort_order
         FROM sell_entry_config sec
         JOIN categories c ON c.id = sec.category_id AND c.status = 'ACTIVE'
         ${where}
         ORDER BY sec.sort_order, sec.entry_key`
      );

      const entries = entriesResult.rows.map((row) => ({
        id: row.config_id,
        entryKey: row.entry_key,
        kind: row.kind,
        iconKey: row.icon_key,
        iconMediaId: row.icon_media_id ?? null,
        hint: row.hint,
        sortOrder: row.sort_order,
        isActive: row.is_active,
        category: Object.freeze({ id: row.category_id, name: row.name, slug: row.slug, parentId: row.parent_id, sortOrder: row.category_sort_order }),
        components: [],
        children: []
      }));

      const componentsResult = await pool.query(
        `SELECT sbc.id AS component_id, sbc.entry_key, sbc.role, sbc.required, sbc.sort_order,
                c.id AS category_id, c.name, c.slug
         FROM sell_build_components sbc
         JOIN categories c ON c.id = sbc.category_id AND c.status = 'ACTIVE'
         ORDER BY sbc.entry_key, sbc.sort_order, sbc.role`
      );
      const byEntry = new Map(entries.map((e) => [e.entryKey, e]));
      for (const row of componentsResult.rows) {
        const target = byEntry.get(row.entry_key);
        if (!target) continue;
        target.components.push(Object.freeze({
          id: row.component_id,
          role: row.role,
          required: row.required,
          sortOrder: row.sort_order,
          category: Object.freeze({ id: row.category_id, name: row.name, slug: row.slug })
        }));
      }

      const childrenResult = await pool.query(
        `SELECT c.id AS category_id, c.name, c.slug, c.parent_id, c.sort_order
         FROM categories c
         JOIN sell_entry_config sec ON sec.kind = 'PARTS' AND c.parent_id = sec.category_id
         WHERE c.status = 'ACTIVE'
         ORDER BY c.sort_order, c.name, c.id`
      );
      const partsByCategory = new Map(entries.filter((e) => e.kind === "PARTS").map((e) => [e.category.id, e]));
      for (const row of childrenResult.rows) {
        const target = partsByCategory.get(row.parent_id);
        if (!target) continue;
        target.children.push(category(row));
      }

      return entries.map((e) => Object.freeze(e));
    }
  });
}
