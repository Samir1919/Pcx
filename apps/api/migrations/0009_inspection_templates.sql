CREATE TABLE IF NOT EXISTS inspection_templates (
  id uuid PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name text NOT NULL,
  version text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category_id, name, version)
);

CREATE INDEX IF NOT EXISTS inspection_templates_category_idx ON inspection_templates(category_id, status);

CREATE TABLE IF NOT EXISTS inspection_template_items (
  id uuid PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES inspection_templates(id) ON DELETE RESTRICT,
  code text NOT NULL CHECK (code ~ '^[a-z][a-z0-9_]*$'),
  label text NOT NULL,
  result_type text NOT NULL CHECK (result_type IN ('PASS_FAIL', 'NUMBER', 'TEXT', 'SELECT', 'BOOLEAN')),
  unit text,
  is_mandatory boolean NOT NULL DEFAULT false,
  is_critical boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, code),
  CHECK (NOT (is_critical AND result_type = 'TEXT'))
);

CREATE INDEX IF NOT EXISTS inspection_template_items_template_idx ON inspection_template_items(template_id, sort_order);
