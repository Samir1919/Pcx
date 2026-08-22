-- Inspection execution: a technician performs the category-scoped template
-- tests against one physical InventoryItem, submits immutable results, and the
-- system derives a rule-based health score plus a suggested condition grade.
-- Critical failures escalate for supervisor review; approved items receive
-- their verified grade/health score on the inventory record.

-- Inventory items gain the approved grade/health columns (server-owned, derived
-- from inspection data, never from client input).
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS condition_grade text
    CHECK (condition_grade IS NULL OR condition_grade IN ('A_PLUS', 'A', 'B', 'C', 'REJECT')),
  ADD COLUMN IF NOT EXISTS current_health_score integer
    CHECK (current_health_score IS NULL OR (current_health_score >= 0 AND current_health_score <= 100)),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE TABLE IF NOT EXISTS inspections (
  id uuid PRIMARY KEY,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  inspection_template_id uuid NOT NULL REFERENCES inspection_templates(id) ON DELETE RESTRICT,
  technician_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  supervisor_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'ESCALATED', 'SUPERSEDED')),
  suggested_grade text CHECK (suggested_grade IS NULL OR suggested_grade IN ('A_PLUS', 'A', 'B', 'C', 'REJECT')),
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  finalized_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inspections_item_idx ON inspections(inventory_item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS test_results (
  id uuid PRIMARY KEY,
  inspection_id uuid NOT NULL REFERENCES inspections(id) ON DELETE RESTRICT,
  inspection_template_item_id uuid NOT NULL REFERENCES inspection_template_items(id) ON DELETE RESTRICT,
  result_status text CHECK (result_status IN ('PASS', 'FAIL', 'NA')),
  value_number numeric,
  value_text text,
  pass_boolean boolean,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(inspection_id, inspection_template_item_id)
);

CREATE INDEX IF NOT EXISTS test_results_inspection_idx ON test_results(inspection_id);

CREATE TABLE IF NOT EXISTS health_scores (
  id uuid PRIMARY KEY,
  inspection_id uuid NOT NULL REFERENCES inspections(id) ON DELETE RESTRICT,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  formula_version text NOT NULL,
  components jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(inspection_id)
);

CREATE INDEX IF NOT EXISTS health_scores_item_idx ON health_scores(inventory_item_id, created_at DESC);
