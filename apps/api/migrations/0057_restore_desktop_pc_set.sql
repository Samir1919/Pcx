-- Restore the desktop-pc attribute set after its items were removed and its
-- category assignment was moved (to the legacy CPU category and to RAM). A
-- desktop model must resolve its own processor/ram/storage/gpu/system-wattage
-- attributes through the desktop-pc set assigned to the Desktop PC category.

-- 1. Restore the five desktop-pc set items (forced to correct required/sort).
INSERT INTO attribute_set_items(set_id, definition_id, required, sort_order) VALUES
  ('8a000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000025', true, 10),  -- processor
  ('8a000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000026', true, 20),  -- ram_gb
  ('8a000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000027', true, 30),  -- storage_gb
  ('8a000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000028', false, 40), -- gpu
  ('8a000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000032', false, 50)  -- system_wattage
ON CONFLICT (set_id, definition_id) DO UPDATE
  SET required = EXCLUDED.required, sort_order = EXCLUDED.sort_order;

-- 2. Detach the set from every category except Desktop PC (removes the wrong
--    RAM and legacy-CPU assignments).
DELETE FROM category_attribute_sets
WHERE set_id = '8a000000-0000-0000-0000-000000000001'
  AND category_id <> '80000000-0000-0000-0000-000000000001';

-- 3. Ensure the Desktop PC category resolves its own set.
INSERT INTO category_attribute_sets(category_id, set_id)
VALUES ('80000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-000000000001')
ON CONFLICT (category_id, set_id) DO NOTHING;
