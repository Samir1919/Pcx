-- Indicative price ranges for the public Sell-to-PCX quotation.
--
-- Each row targets exactly one of product_model_id or category_id; a model
-- price overrides a category default for that model, and a category price is
-- the fallback when no model price exists. Prices are server-owned and
-- append-only: the partial unique indexes below allow at most one ACTIVE row per
-- target, so a new range must archive the previous one (a new row) rather than
-- mutate history. Monetary values are NUMERIC and strictly positive.
--
-- These are estimated market ranges, never a final offer and never acquisition
-- cost; the public quote projection always carries a final-offer disclaimer.

CREATE TABLE IF NOT EXISTS indicative_prices (
  id uuid PRIMARY KEY,
  product_model_id uuid REFERENCES product_models(id) ON DELETE RESTRICT,
  category_id uuid REFERENCES categories(id) ON DELETE RESTRICT,
  low_value numeric NOT NULL CHECK (low_value > 0),
  high_value numeric NOT NULL CHECK (high_value > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  set_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CHECK ((product_model_id IS NULL) <> (category_id IS NULL)),
  CHECK (low_value <= high_value),
  CHECK ((status = 'ACTIVE' AND archived_at IS NULL) OR (status = 'ARCHIVED' AND archived_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS indicative_prices_model_active_idx
  ON indicative_prices(product_model_id) WHERE status = 'ACTIVE' AND product_model_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS indicative_prices_category_active_idx
  ON indicative_prices(category_id) WHERE status = 'ACTIVE' AND category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS indicative_prices_created_idx
  ON indicative_prices(created_at DESC);
