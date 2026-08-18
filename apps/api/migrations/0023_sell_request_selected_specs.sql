-- Additive: seller-declared selected specification values on a sell request.
-- This captures the S04 "Variant/Specs" step of the Sell-to-PCX flow. The values
-- are the seller's declaration only; they are never authoritative for price,
-- grade, or health.

ALTER TABLE sell_requests
  ADD COLUMN IF NOT EXISTS selected_specs jsonb NOT NULL DEFAULT '[]'::jsonb;
