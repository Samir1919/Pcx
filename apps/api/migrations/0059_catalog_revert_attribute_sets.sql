-- Revert the global-attributes + attribute-set model (0052-0058) back to the
-- approved per-category spec model (DATABASE_ERD v1.0 §4), and introduce the
-- separate "full PC build" concept as a composite ProductModel (ADR 0017).
--
-- Destructive migration (DROP TABLE / DROP COLUMN) — dev/staging only,
-- authorized by explicit human approval (ADR 0017).

-- 1. Drop the attribute-set machinery (order matters for FK safety).
ALTER TABLE sell_build_components DROP COLUMN IF EXISTS attribute_set_id;
DROP TABLE IF EXISTS category_attribute_sets;
DROP TABLE IF EXISTS attribute_set_items;
DROP TABLE IF EXISTS attribute_sets;

-- 2. Restore per-category spec_definitions schema. category_id is added NULLABLE
--    first, backfilled below, then set NOT NULL.
ALTER TABLE spec_definitions DROP CONSTRAINT IF EXISTS spec_definitions_key_key;
ALTER TABLE spec_definitions ADD COLUMN IF NOT EXISTS category_id uuid;
ALTER TABLE spec_definitions ADD COLUMN IF NOT EXISTS required boolean NOT NULL DEFAULT false;
ALTER TABLE spec_definitions ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0);

-- 3. Build concept: model kind + component links.
ALTER TABLE product_models ADD COLUMN IF NOT EXISTS model_kind text NOT NULL DEFAULT 'PART' CHECK (model_kind IN ('PART','BUILD'));
CREATE TABLE IF NOT EXISTS product_model_components (
  id uuid PRIMARY KEY,
  product_model_id uuid NOT NULL REFERENCES product_models(id) ON DELETE CASCADE,
  component_model_id uuid NOT NULL REFERENCES product_models(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_model_id, component_model_id),
  CHECK (product_model_id <> component_model_id)
);

-- 4. Convert the two Desktop PC models to BUILD and drop their flat component
--    spec values (cpu/ram/storage/gpu/wattage), replaced by component links below.
DELETE FROM model_spec_values
 WHERE product_model_id IN ('82000000-0000-0000-0000-000000000025','82000000-0000-0000-0000-000000000026');
UPDATE product_models SET model_kind = 'BUILD'
 WHERE id IN ('82000000-0000-0000-0000-000000000025','82000000-0000-0000-0000-000000000026');

-- 5. Split the remaining shared definitions (socket, capacity_gb, screen_size_in)
--    into per-category rows. Keep the parent for one category; add a clone for
--    each other category and re-point values by their stored category_id.
INSERT INTO spec_definitions(id, category_id, key, label, data_type, unit, filterable, required, sort_order, status) VALUES
  ('83000000-0000-0000-0000-000000000033', '80000000-0000-0000-0000-000000000005', 'socket', 'Socket', 'TEXT', NULL, true, true, 10, 'ACTIVE'),
  ('83000000-0000-0000-0000-000000000034', '80000000-0000-0000-0000-000000000007', 'capacity_gb', 'Capacity', 'NUMBER', 'GB', true, true, 10, 'ACTIVE'),
  ('83000000-0000-0000-0000-000000000035', '80000000-0000-0000-0000-000000000009', 'screen_size_in', 'Screen Size', 'NUMBER', 'in', true, true, 10, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;
UPDATE model_spec_values SET spec_definition_id = '83000000-0000-0000-0000-000000000033'
 WHERE spec_definition_id = '83000000-0000-0000-0000-000000000001' AND category_id = '80000000-0000-0000-0000-000000000005';
UPDATE model_spec_values SET spec_definition_id = '83000000-0000-0000-0000-000000000034'
 WHERE spec_definition_id = '83000000-0000-0000-0000-000000000010' AND category_id = '80000000-0000-0000-0000-000000000007';
UPDATE model_spec_values SET spec_definition_id = '83000000-0000-0000-0000-000000000035'
 WHERE spec_definition_id = '83000000-0000-0000-0000-000000000021' AND category_id = '80000000-0000-0000-0000-000000000009';

-- 6. Remove definitions that only served the flat desktop-pc model (now empty).
DELETE FROM spec_definitions WHERE id IN ('83000000-0000-0000-0000-000000000028','83000000-0000-0000-0000-000000000032');

-- 7. Assign category_id + required + sort_order to every remaining definition.
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000004', required = true,  sort_order = 10 WHERE id = '83000000-0000-0000-0000-000000000001';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000004', required = false, sort_order = 20 WHERE id = '83000000-0000-0000-0000-000000000002';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000004', required = false, sort_order = 30 WHERE id = '83000000-0000-0000-0000-000000000003';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000004', required = false, sort_order = 40 WHERE id = '83000000-0000-0000-0000-000000000004';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000004', required = false, sort_order = 50 WHERE id = '83000000-0000-0000-0000-000000000005';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000004', required = false, sort_order = 60 WHERE id = '83000000-0000-0000-0000-000000000006';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000005', required = true,  sort_order = 10 WHERE id = '83000000-0000-0000-0000-000000000033';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000005', required = false, sort_order = 20 WHERE id = '83000000-0000-0000-0000-000000000007';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000005', required = false, sort_order = 30 WHERE id = '83000000-0000-0000-0000-000000000008';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000005', required = false, sort_order = 40 WHERE id = '83000000-0000-0000-0000-000000000009';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000006', required = true,  sort_order = 10 WHERE id = '83000000-0000-0000-0000-000000000010';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000006', required = true,  sort_order = 20 WHERE id = '83000000-0000-0000-0000-000000000011';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000006', required = false, sort_order = 30 WHERE id = '83000000-0000-0000-0000-000000000012';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000006', required = false, sort_order = 40 WHERE id = '83000000-0000-0000-0000-000000000013';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000007', required = true,  sort_order = 10 WHERE id = '83000000-0000-0000-0000-000000000034';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000007', required = false, sort_order = 20 WHERE id = '83000000-0000-0000-0000-000000000014';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000007', required = false, sort_order = 30 WHERE id = '83000000-0000-0000-0000-000000000031';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000007', required = false, sort_order = 40 WHERE id = '83000000-0000-0000-0000-000000000015';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000003', required = true,  sort_order = 10 WHERE id = '83000000-0000-0000-0000-000000000019';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000003', required = false, sort_order = 20 WHERE id = '83000000-0000-0000-0000-000000000030';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000003', required = false, sort_order = 30 WHERE id = '83000000-0000-0000-0000-000000000029';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000003', required = false, sort_order = 40 WHERE id = '83000000-0000-0000-0000-000000000020';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000008', required = true,  sort_order = 10 WHERE id = '83000000-0000-0000-0000-000000000016';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000008', required = false, sort_order = 20 WHERE id = '83000000-0000-0000-0000-000000000017';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000008', required = false, sort_order = 30 WHERE id = '83000000-0000-0000-0000-000000000018';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000002', required = true,  sort_order = 10 WHERE id = '83000000-0000-0000-0000-000000000021';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000002', required = true,  sort_order = 20 WHERE id = '83000000-0000-0000-0000-000000000025';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000002', required = true,  sort_order = 30 WHERE id = '83000000-0000-0000-0000-000000000026';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000002', required = true,  sort_order = 40 WHERE id = '83000000-0000-0000-0000-000000000027';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000009', required = true,  sort_order = 10 WHERE id = '83000000-0000-0000-0000-000000000035';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000009', required = false, sort_order = 20 WHERE id = '83000000-0000-0000-0000-000000000022';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000009', required = false, sort_order = 30 WHERE id = '83000000-0000-0000-0000-000000000023';
UPDATE spec_definitions SET category_id = '80000000-0000-0000-0000-000000000009', required = false, sort_order = 40 WHERE id = '83000000-0000-0000-0000-000000000024';

-- 7b. Remove any pre-existing definition left outside the seeded catalog (e.g.
--     admin-created global definitions or test artifacts): they have no
--     category under the per-category model and are part of the drift to clean.
DELETE FROM model_spec_values WHERE spec_definition_id IN (SELECT id FROM spec_definitions WHERE category_id IS NULL);
DELETE FROM spec_definitions WHERE category_id IS NULL;

-- 8. Enforce per-category constraints now that every definition has a category.
ALTER TABLE spec_definitions ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE spec_definitions ADD CONSTRAINT spec_definitions_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT;
ALTER TABLE spec_definitions ADD CONSTRAINT spec_definitions_category_id_key_key UNIQUE(category_id, key);
ALTER TABLE spec_definitions ADD CONSTRAINT spec_definitions_id_category_id_data_type_key UNIQUE(id, category_id, data_type);

-- 9. Link the seeded builds to their component parts.
INSERT INTO product_model_components(id, product_model_id, component_model_id, quantity, sort_order) VALUES
  ('85000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000025', '82000000-0000-0000-0000-000000000001', 1, 10),
  ('85000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000025', '82000000-0000-0000-0000-000000000006', 1, 20),
  ('85000000-0000-0000-0000-000000000003', '82000000-0000-0000-0000-000000000025', '82000000-0000-0000-0000-000000000008', 1, 30),
  ('85000000-0000-0000-0000-000000000004', '82000000-0000-0000-0000-000000000025', '82000000-0000-0000-0000-000000000011', 1, 40),
  ('85000000-0000-0000-0000-000000000005', '82000000-0000-0000-0000-000000000025', '82000000-0000-0000-0000-000000000014', 1, 50),
  ('85000000-0000-0000-0000-000000000011', '82000000-0000-0000-0000-000000000026', '82000000-0000-0000-0000-000000000003', 1, 10),
  ('85000000-0000-0000-0000-000000000012', '82000000-0000-0000-0000-000000000026', '82000000-0000-0000-0000-000000000005', 1, 20),
  ('85000000-0000-0000-0000-000000000013', '82000000-0000-0000-0000-000000000026', '82000000-0000-0000-0000-000000000008', 2, 30),
  ('85000000-0000-0000-0000-000000000014', '82000000-0000-0000-0000-000000000026', '82000000-0000-0000-0000-000000000011', 1, 40),
  ('85000000-0000-0000-0000-000000000015', '82000000-0000-0000-0000-000000000026', '82000000-0000-0000-0000-000000000016', 1, 50),
  ('85000000-0000-0000-0000-000000000016', '82000000-0000-0000-0000-000000000026', '82000000-0000-0000-0000-000000000014', 1, 60)
ON CONFLICT (id) DO NOTHING;


