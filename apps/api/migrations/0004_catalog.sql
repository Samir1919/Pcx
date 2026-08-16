CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY,
  parent_id uuid REFERENCES categories(id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CHECK ((status = 'ACTIVE' AND archived_at IS NULL) OR (status = 'ARCHIVED' AND archived_at IS NOT NULL)),
  CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CHECK ((status = 'ACTIVE' AND archived_at IS NULL) OR (status = 'ARCHIVED' AND archived_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS product_models (
  id uuid PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  model_code text,
  search_aliases text[] NOT NULL DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE(id, category_id),
  CHECK ((status = 'ACTIVE' AND archived_at IS NULL) OR (status = 'ARCHIVED' AND archived_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS product_models_public_order_idx ON product_models(status, name, id);
CREATE INDEX IF NOT EXISTS product_models_category_idx ON product_models(category_id, status, name, id);
CREATE INDEX IF NOT EXISTS product_models_brand_idx ON product_models(brand_id, status, name, id);

CREATE TABLE IF NOT EXISTS spec_definitions (
  id uuid PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  label text NOT NULL,
  data_type text NOT NULL CHECK (data_type IN ('TEXT', 'NUMBER', 'BOOLEAN', 'JSON')),
  unit text,
  filterable boolean NOT NULL DEFAULT false,
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE(category_id, key),
  UNIQUE(id, category_id, data_type),
  CHECK (NOT (filterable AND data_type = 'JSON')),
  CHECK ((status = 'ACTIVE' AND archived_at IS NULL) OR (status = 'ARCHIVED' AND archived_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS model_spec_values (
  id uuid PRIMARY KEY,
  product_model_id uuid NOT NULL,
  spec_definition_id uuid NOT NULL,
  category_id uuid NOT NULL,
  data_type text NOT NULL,
  value_text text,
  value_number numeric,
  value_boolean boolean,
  value_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_model_id, spec_definition_id),
  FOREIGN KEY (product_model_id, category_id) REFERENCES product_models(id, category_id) ON DELETE RESTRICT,
  FOREIGN KEY (spec_definition_id, category_id, data_type) REFERENCES spec_definitions(id, category_id, data_type) ON DELETE RESTRICT,
  CHECK (
    (data_type = 'TEXT' AND value_text IS NOT NULL AND value_number IS NULL AND value_boolean IS NULL AND value_json IS NULL) OR
    (data_type = 'NUMBER' AND value_text IS NULL AND value_number IS NOT NULL AND value_boolean IS NULL AND value_json IS NULL) OR
    (data_type = 'BOOLEAN' AND value_text IS NULL AND value_number IS NULL AND value_boolean IS NOT NULL AND value_json IS NULL) OR
    (data_type = 'JSON' AND value_text IS NULL AND value_number IS NULL AND value_boolean IS NULL AND value_json IS NOT NULL AND jsonb_typeof(value_json) IN ('object', 'array'))
  )
);
