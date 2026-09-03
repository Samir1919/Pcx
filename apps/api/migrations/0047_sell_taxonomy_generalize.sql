-- Generalize sell-entry identifiers so new catalog categories can be promoted
-- to sell entries at runtime (admin Catalog -> Sell flow) instead of being a
-- fixed four-value enum.
--
-- entry_key / sell_requests.sell_entry become canonical UPPER_SNAKE_CASE derived
-- from the category slug; icon_key becomes a canonical lowercase slug so a new
-- entry can carry any presentation icon. The existing seed values (DESKTOP_PC,
-- PC_PARTS, LAPTOP, LAPTOP_PARTS and desktop/parts/laptop/laptop-parts) still
-- satisfy the relaxed checks, so this is non-destructive.

ALTER TABLE sell_entry_config DROP CONSTRAINT IF EXISTS sell_entry_config_entry_key_check;
ALTER TABLE sell_entry_config ADD CONSTRAINT sell_entry_config_entry_key_check CHECK (entry_key ~ '^[A-Z][A-Z0-9_]*$');

ALTER TABLE sell_entry_config DROP CONSTRAINT IF EXISTS sell_entry_config_icon_key_check;
ALTER TABLE sell_entry_config ADD CONSTRAINT sell_entry_config_icon_key_check CHECK (icon_key ~ '^[a-z][a-z0-9-]*$');

ALTER TABLE sell_requests DROP CONSTRAINT IF EXISTS sell_requests_sell_entry_check;
ALTER TABLE sell_requests ADD CONSTRAINT sell_requests_sell_entry_check CHECK (sell_entry IS NULL OR sell_entry ~ '^[A-Z][A-Z0-9_]*$');
