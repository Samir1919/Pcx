-- Disambiguate shared attributes that were reused across semantically distinct
-- build components. A single global key must mean one concept; reusing it for
-- two different meanings (RAM memory_type DDR4 vs GPU memory_type GDDR6,
-- motherboard chipset B550 vs GPU chip GA106, motherboard form_factor ATX vs
-- drive form_factor 3.5-inch, PSU wattage vs system wattage) made the build and
-- product-model input ambiguous. Correctly-shared definitions (socket =
-- CPU/Motherboard compatibility, capacity_gb = RAM/Storage capacity,
-- screen_size_in, processor/ram_gb/storage_gb) stay shared.
--
-- Also restores the desktop-pc set (items + category assignment) so a desktop
-- model shows its own processor/ram/storage/gpu/system-wattage attributes
-- instead of resolving to the CPU set.

-- 1. New, distinct definitions.
INSERT INTO spec_definitions(id, key, label, data_type, unit, filterable, status) VALUES
  ('83000000-0000-0000-0000-000000000029', 'vram_type', 'VRAM Type', 'TEXT', NULL, true, 'ACTIVE'),
  ('83000000-0000-0000-0000-000000000030', 'gpu_chip', 'GPU Chip', 'TEXT', NULL, false, 'ACTIVE'),
  ('83000000-0000-0000-0000-000000000031', 'drive_form_factor', 'Drive Form Factor', 'TEXT', NULL, true, 'ACTIVE'),
  ('83000000-0000-0000-0000-000000000032', 'system_wattage', 'System Wattage', 'NUMBER', 'W', false, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 2. Re-point set items (preserves required/sort_order).
UPDATE attribute_set_items SET definition_id = '83000000-0000-0000-0000-000000000030' WHERE set_id = '8a000000-0000-0000-0000-000000000003' AND definition_id = '83000000-0000-0000-0000-000000000007';
UPDATE attribute_set_items SET definition_id = '83000000-0000-0000-0000-000000000029' WHERE set_id = '8a000000-0000-0000-0000-000000000003' AND definition_id = '83000000-0000-0000-0000-000000000012';
UPDATE attribute_set_items SET definition_id = '83000000-0000-0000-0000-000000000031' WHERE set_id = '8a000000-0000-0000-0000-000000000007' AND definition_id = '83000000-0000-0000-0000-000000000008';
UPDATE attribute_set_items SET definition_id = '83000000-0000-0000-0000-000000000032' WHERE set_id = '8a000000-0000-0000-0000-000000000001' AND definition_id = '83000000-0000-0000-0000-000000000016';

-- 3. Re-point the model spec values.
UPDATE model_spec_values SET spec_definition_id = '83000000-0000-0000-0000-000000000030' WHERE spec_definition_id = '83000000-0000-0000-0000-000000000007' AND product_model_id IN ('82000000-0000-0000-0000-000000000016','82000000-0000-0000-0000-000000000017','82000000-0000-0000-0000-000000000018');
UPDATE model_spec_values SET spec_definition_id = '83000000-0000-0000-0000-000000000029' WHERE spec_definition_id = '83000000-0000-0000-0000-000000000012' AND product_model_id IN ('82000000-0000-0000-0000-000000000016','82000000-0000-0000-0000-000000000017','82000000-0000-0000-0000-000000000018');
UPDATE model_spec_values SET spec_definition_id = '83000000-0000-0000-0000-000000000031' WHERE spec_definition_id = '83000000-0000-0000-0000-000000000008' AND product_model_id IN ('82000000-0000-0000-0000-000000000011','82000000-0000-0000-0000-000000000012','82000000-0000-0000-0000-000000000013');
UPDATE model_spec_values SET spec_definition_id = '83000000-0000-0000-0000-000000000032' WHERE spec_definition_id = '83000000-0000-0000-0000-000000000016' AND product_model_id IN ('82000000-0000-0000-0000-000000000025','82000000-0000-0000-0000-000000000026');

-- 4. Restore the desktop-pc set (items + assignment), using system_wattage.
INSERT INTO attribute_set_items(set_id, definition_id, required, sort_order) VALUES
  ('8a000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000025', true, 10),
  ('8a000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000026', true, 20),
  ('8a000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000027', true, 30),
  ('8a000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000028', false, 40),
  ('8a000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000032', false, 50)
ON CONFLICT (set_id, definition_id) DO NOTHING;

-- The desktop-pc category must resolve its own set (not CPU's).
DELETE FROM category_attribute_sets WHERE category_id = '80000000-0000-0000-0000-000000000001' AND set_id = '8a000000-0000-0000-0000-000000000004';
INSERT INTO category_attribute_sets(category_id, set_id) VALUES
  ('80000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-000000000001')
ON CONFLICT (category_id, set_id) DO NOTHING;
