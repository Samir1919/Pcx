-- Per-item cost allocation ledger (E4/E6).
--
-- inventory_items.acquisition_cost (migration 0036) is the seed for the
-- ACQUISITION cost type. This table appends the remaining per-item cost
-- allocation (REFURBISHMENT, TESTING, PACKAGING, SHIPPING_IN, OTHER, and any
-- acquisition adjustments). Totals are always summed server-side in SQL —
-- the client never authors a cost total, only one entry's amount.
CREATE TABLE IF NOT EXISTS item_costs (
  id uuid PRIMARY KEY,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  cost_type text NOT NULL CHECK (cost_type IN ('ACQUISITION', 'REFURBISHMENT', 'TESTING', 'PACKAGING', 'SHIPPING_IN', 'OTHER')),
  amount numeric NOT NULL CHECK (amount > 0),
  reference text,
  recorded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reference IS NULL OR length(reference) <= 256)
);

CREATE INDEX IF NOT EXISTS item_costs_inventory_item_idx ON item_costs(inventory_item_id, created_at DESC);
