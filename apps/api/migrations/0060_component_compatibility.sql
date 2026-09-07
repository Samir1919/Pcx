-- Component compatibility: reference values (shared controlled vocabulary) and
-- data-driven compatibility rules (ADR 0018). A SELECT spec definition points at
-- a referenceKey, so its allowed values are admin-managed data; a new socket or
-- memory type is added as a reference value — never a code or UI change.

-- 1. Extend spec data_type with SELECT + add reference_key.
ALTER TABLE spec_definitions DROP CONSTRAINT IF EXISTS spec_definitions_data_type_check;
ALTER TABLE spec_definitions ADD CONSTRAINT spec_definitions_data_type_check CHECK (data_type IN ('TEXT','NUMBER','BOOLEAN','JSON','SELECT'));
ALTER TABLE spec_definitions ADD COLUMN IF NOT EXISTS reference_key text;

-- 2. Reference values (shared controlled vocabulary, admin CRUD).
CREATE TABLE IF NOT EXISTS reference_values (
  id uuid PRIMARY KEY,
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  value text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE(key, value),
  CHECK ((status = 'ACTIVE' AND archived_at IS NULL) OR (status = 'ARCHIVED' AND archived_at IS NOT NULL))
);

-- 3. Compatibility rules (admin CRUD).
CREATE TABLE IF NOT EXISTS compatibility_rules (
  id uuid PRIMARY KEY,
  source_category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  source_key text NOT NULL CHECK (source_key ~ '^[a-z][a-z0-9_]*$'),
  operator text NOT NULL CHECK (operator IN ('EQUALS')),
  target_category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  target_key text NOT NULL CHECK (target_key ~ '^[a-z][a-z0-9_]*$'),
  required boolean NOT NULL DEFAULT true,
  reason text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE(source_category_id, source_key, target_category_id, target_key),
  CHECK ((status = 'ACTIVE' AND archived_at IS NULL) OR (status = 'ARCHIVED' AND archived_at IS NOT NULL))
);

-- 4. Seed reference values (socket + memory_type).
INSERT INTO reference_values(id, key, value, label, sort_order) VALUES
  ('87000000-0000-0000-0000-000000000001', 'socket', 'AM4', 'AM4', 10),
  ('87000000-0000-0000-0000-000000000002', 'socket', 'AM5', 'AM5', 20),
  ('87000000-0000-0000-0000-000000000003', 'socket', 'LGA1200', 'LGA1200', 30),
  ('87000000-0000-0000-0000-000000000004', 'socket', 'LGA1700', 'LGA1700', 40),
  ('87000000-0000-0000-0000-000000000005', 'memory_type', 'DDR4', 'DDR4', 10),
  ('87000000-0000-0000-0000-000000000006', 'memory_type', 'DDR5', 'DDR5', 20)
ON CONFLICT (key, value) DO NOTHING;

-- 5. Convert compatibility-relevant definitions to SELECT + reference_key.
UPDATE spec_definitions SET data_type = 'SELECT', reference_key = 'socket'      WHERE id = '83000000-0000-0000-0000-000000000001';
UPDATE spec_definitions SET data_type = 'SELECT', reference_key = 'socket'      WHERE id = '83000000-0000-0000-0000-000000000033';
UPDATE spec_definitions SET data_type = 'SELECT', reference_key = 'memory_type' WHERE id = '83000000-0000-0000-0000-000000000012';

-- 6. Add memory_type (SELECT) to CPU and Motherboard so a build can enforce
--    CPU / motherboard ↔ RAM memory-type matching.
INSERT INTO spec_definitions(id, category_id, key, label, data_type, unit, filterable, required, sort_order, reference_key, status) VALUES
  ('83000000-0000-0000-0000-000000000036', '80000000-0000-0000-0000-000000000004', 'memory_type', 'Memory Type', 'SELECT', NULL, false, false, 70, 'memory_type', 'ACTIVE'),
  ('83000000-0000-0000-0000-000000000037', '80000000-0000-0000-0000-000000000005', 'memory_type', 'Memory Type', 'SELECT', NULL, false, false, 50, 'memory_type', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 7. Seed compatibility rules (CPU socket ↔ motherboard; CPU/motherboard ↔ RAM).
INSERT INTO compatibility_rules(id, source_category_id, source_key, operator, target_category_id, target_key, required, reason, sort_order) VALUES
  ('88000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000004', 'socket', 'EQUALS', '80000000-0000-0000-0000-000000000005', 'socket', true, 'CPU socket must match the motherboard socket', 10),
  ('88000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000005', 'memory_type', 'EQUALS', '80000000-0000-0000-0000-000000000006', 'memory_type', true, 'Motherboard memory type must match the RAM', 20),
  ('88000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000004', 'memory_type', 'EQUALS', '80000000-0000-0000-0000-000000000006', 'memory_type', true, 'CPU memory type must match the RAM', 30)
ON CONFLICT (source_category_id, source_key, target_category_id, target_key) DO NOTHING;
