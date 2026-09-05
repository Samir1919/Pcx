-- Add an INACTIVE status for product models (hidden from the storefront but
-- still manageable/reactivatable in the admin). Mirrors 0050 for categories:
-- INACTIVE is a reversible ACTIVE↔INACTIVE toggle, distinct from ARCHIVED
-- (soft-delete, preserved for history) and DELETE (hard purge). Non-destructive:
-- only the two CHECK constraints on `product_models` are relaxed.

ALTER TABLE product_models DROP CONSTRAINT product_models_status_check;
ALTER TABLE product_models ADD CONSTRAINT product_models_status_check CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED'));

ALTER TABLE product_models DROP CONSTRAINT product_models_check;
ALTER TABLE product_models ADD CONSTRAINT product_models_check CHECK (
  (status IN ('ACTIVE', 'INACTIVE') AND archived_at IS NULL)
  OR (status = 'ARCHIVED' AND archived_at IS NOT NULL)
);
