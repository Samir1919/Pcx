-- Add an INACTIVE status for catalog categories (hidden from the storefront but
-- still manageable/reactivatable in the admin). INACTIVE is a reversible
-- ACTIVE↔INACTIVE toggle, distinct from ARCHIVED (soft-delete, preserved for
-- history) and DELETE (hard purge). Non-destructive: only the two CHECK
-- constraints on `categories` are relaxed.

ALTER TABLE categories DROP CONSTRAINT categories_status_check;
ALTER TABLE categories ADD CONSTRAINT categories_status_check CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED'));

ALTER TABLE categories DROP CONSTRAINT categories_check;
ALTER TABLE categories ADD CONSTRAINT categories_check CHECK (
  (status IN ('ACTIVE', 'INACTIVE') AND archived_at IS NULL)
  OR (status = 'ARCHIVED' AND archived_at IS NOT NULL)
);
