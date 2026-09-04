-- Custom sell-entry icon (image upload) on top of the emoji library. The icon
-- is stored in the shared `media` table (PUBLIC, purpose 'ICON'); this column
-- only references it. When set, the storefront renders the image instead of the
-- emoji mapped from `icon_key`. Additive and non-destructive.

ALTER TABLE sell_entry_config
  ADD COLUMN IF NOT EXISTS icon_media_id uuid REFERENCES media(id) ON DELETE SET NULL;
