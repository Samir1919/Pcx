-- Global, reusable attribute definitions + attribute sets (part templates).
--
-- spec definitions stop being pinned to a single category: `category_id`,
-- `required`, and `sort_order` leave the definition row. A definition is now a
-- global typed property (key globally unique). Assignment to a category (and,
-- later, to build roles) happens through a reusable "attribute set" so the same
-- property — e.g. capacity_gb, socket, form_factor — is defined once and reused
-- across categories and build components (Magento attribute-set model).
--
-- `required` and `sort_order` become per-assignment facts on attribute_set_items.
--
-- Duplicate-key definitions that were previously defined once per category are
-- merged into one global definition and re-pointed (socket, capacity_gb,
-- screen_size_in, form_factor).

-- 1. Reusable attribute sets and their assignment tables.
CREATE TABLE attribute_sets (
  id uuid PRIMARY KEY,
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_-]*$'),
  label text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE(key),
  CHECK ((status = 'ACTIVE' AND archived_at IS NULL) OR (status = 'ARCHIVED' AND archived_at IS NOT NULL))
);

CREATE TABLE attribute_set_items (
  set_id uuid NOT NULL REFERENCES attribute_sets(id) ON DELETE RESTRICT,
  definition_id uuid NOT NULL REFERENCES spec_definitions(id) ON DELETE RESTRICT,
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  PRIMARY KEY(set_id, definition_id)
);

CREATE TABLE category_attribute_sets (
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  set_id uuid NOT NULL REFERENCES attribute_sets(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY(category_id, set_id)
);

-- 2. Drop the composite FK that pinned each value to its definition's category
--    (it referenced spec_definitions(id, category_id, data_type), which is being
--    removed below). Values will reference definitions by id alone.
ALTER TABLE model_spec_values DROP CONSTRAINT model_spec_values_spec_definition_id_category_id_data_type_fkey;

-- 3. Merge duplicate-key definitions into one global definition each (keep the
--    lowest id, re-point values, delete the duplicates). These pairs carry the
--    same data_type/unit, so the value CHECK and data_type stay consistent.
--    socket: keep CPU's 003; Motherboard's 004 has no values.
DELETE FROM spec_definitions WHERE id = '83000000-0000-0000-0000-000000000004';
--    capacity_gb: keep RAM's 005; re-point Storage's value from 006.
UPDATE model_spec_values SET spec_definition_id = '83000000-0000-0000-0000-000000000005' WHERE spec_definition_id = '83000000-0000-0000-0000-000000000006';
DELETE FROM spec_definitions WHERE id = '83000000-0000-0000-0000-000000000006';
--    screen_size_in: keep Laptop's 001; re-point Monitor's value from 008.
UPDATE model_spec_values SET spec_definition_id = '83000000-0000-0000-0000-000000000001' WHERE spec_definition_id = '83000000-0000-0000-0000-000000000008';
DELETE FROM spec_definitions WHERE id = '83000000-0000-0000-0000-000000000008';
--    form_factor: keep Motherboard's 019; re-point Storage's values from 023.
UPDATE model_spec_values SET spec_definition_id = '83000000-0000-0000-0000-000000000019' WHERE spec_definition_id = '83000000-0000-0000-0000-000000000023';
DELETE FROM spec_definitions WHERE id = '83000000-0000-0000-0000-000000000023';

-- 4. Detach category_id / required / sort_order from spec_definitions.
ALTER TABLE spec_definitions DROP CONSTRAINT spec_definitions_category_id_fkey;
ALTER TABLE spec_definitions DROP CONSTRAINT spec_definitions_category_id_key_key;
ALTER TABLE spec_definitions DROP CONSTRAINT spec_definitions_id_category_id_data_type_key;
ALTER TABLE spec_definitions DROP CONSTRAINT spec_definitions_sort_order_check;
ALTER TABLE spec_definitions DROP COLUMN category_id;
ALTER TABLE spec_definitions DROP COLUMN required;
ALTER TABLE spec_definitions DROP COLUMN sort_order;
ALTER TABLE spec_definitions ADD CONSTRAINT spec_definitions_key_key UNIQUE(key);

-- 5. Re-establish the value → definition FK (simple, category-agnostic).
ALTER TABLE model_spec_values ADD CONSTRAINT model_spec_values_spec_definition_id_fkey
  FOREIGN KEY (spec_definition_id) REFERENCES spec_definitions(id) ON DELETE RESTRICT;
