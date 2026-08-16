CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'PAUSED', 'RESERVED', 'SOLD', 'ARCHIVED')),
  public_slug text UNIQUE,
  published_at timestamptz,
  unpublished_at timestamptz,
  warranty_policy_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'PUBLISHED' AND public_slug IS NOT NULL AND published_at IS NOT NULL) OR (status <> 'PUBLISHED'))
);

-- One InventoryItem can have at most one active sellable listing.
CREATE UNIQUE INDEX IF NOT EXISTS listings_one_active_per_item
  ON listings(inventory_item_id) WHERE status IN ('PUBLISHED', 'RESERVED');

CREATE INDEX IF NOT EXISTS listings_status_idx ON listings(status, published_at DESC);

CREATE TABLE IF NOT EXISTS listing_prices (
  id uuid PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  price numeric NOT NULL CHECK (price > 0),
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  reason text,
  set_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE INDEX IF NOT EXISTS listing_prices_listing_idx ON listing_prices(listing_id, valid_from DESC);
