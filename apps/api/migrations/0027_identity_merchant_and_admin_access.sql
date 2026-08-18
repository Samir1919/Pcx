-- Adds the MERCHANT role, admin:access and identity/merchant-listing
-- permissions, and a nullable merchant-owner column on listings.

INSERT INTO roles(id, code) VALUES
  ('20000000-0000-0000-0000-000000000009', 'MERCHANT')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions(id, code) VALUES
  ('30000000-0000-0000-0000-000000000024', 'admin:access'),
  ('30000000-0000-0000-0000-000000000025', 'identity:read'),
  ('30000000-0000-0000-0000-000000000026', 'identity:manage'),
  ('30000000-0000-0000-0000-000000000027', 'merchant-listing:read:self'),
  ('30000000-0000-0000-0000-000000000028', 'merchant-listing:manage:self')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT role.id, permission.id
FROM (VALUES
  ('MERCHANT', 'profile:read:self'),
  ('MERCHANT', 'profile:update:self'),
  ('MERCHANT', 'address:manage:self'),
  ('MERCHANT', 'merchant-listing:read:self'),
  ('MERCHANT', 'merchant-listing:manage:self'),
  ('SUPPORT', 'admin:access'),
  ('TECHNICIAN', 'admin:access'),
  ('SUPERVISOR', 'admin:access'),
  ('INVENTORY', 'admin:access'),
  ('FINANCE', 'admin:access'),
  ('ADMIN', 'admin:access'),
  ('ADMIN', 'identity:read'),
  ('ADMIN', 'identity:manage'),
  ('ADMIN', 'role:assign')
) AS grant_matrix(role_code, permission_code)
JOIN roles role ON role.code = grant_matrix.role_code
JOIN permissions permission ON permission.code = grant_matrix.permission_code
ON CONFLICT DO NOTHING;

-- SUPER_ADMIN already receives every permission via migration 0002's cross
-- join, but ensure any newly-added permissions are also granted to it.
INSERT INTO role_permissions(role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
CROSS JOIN permissions permission
WHERE role.code = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE RESTRICT;

-- Merchant drafts are created against a product model before PCX assigns a
-- physical inventory item during approval. The item stays required for any
-- sellable (PUBLISHED/RESERVED) listing and is enforced at the service layer.
ALTER TABLE listings
  ALTER COLUMN inventory_item_id DROP NOT NULL;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS product_model_id uuid REFERENCES product_models(id) ON DELETE RESTRICT;

-- Backfill product_model_id for pre-existing inventory-backed listings.
UPDATE listings l
SET product_model_id = ii.product_model_id
FROM inventory_items ii
WHERE l.inventory_item_id = ii.id
  AND l.product_model_id IS NULL;

-- Merchant-proposed price (path A): indicative only, never authoritative.
-- PCX records the final sellable price in listing_prices at approval.
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS proposed_price numeric CHECK (proposed_price IS NULL OR proposed_price > 0);

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS listings_owner_user_id_idx ON listings(owner_user_id);
