-- Additive sell-request extension for the four Sell-to-PCX entry flows.
--
-- sell_entry records which public entry the seller used (DESKTOP_PC / PC_PARTS /
-- LAPTOP / LAPTOP_PARTS). It is nullable so legacy/unspecified rows remain valid,
-- but any supplied value must be one of the four canonical entries.
--
-- build_components is a JSONB array of { role, productModelId } selections for
-- full-system builds. Each role may appear at most once; duplicate-role and
-- entry-shape validation is enforced in the domain layer and is this column's
-- source of truth for new writes. Component selections are seller declarations
-- only and never set price, grade, or health.

ALTER TABLE sell_requests
  ADD COLUMN IF NOT EXISTS sell_entry text
    CHECK (sell_entry IS NULL OR sell_entry IN ('DESKTOP_PC', 'PC_PARTS', 'LAPTOP', 'LAPTOP_PARTS')),
  ADD COLUMN IF NOT EXISTS build_components jsonb NOT NULL DEFAULT '[]'::jsonb;
