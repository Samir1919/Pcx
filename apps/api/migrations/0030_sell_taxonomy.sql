-- Sell-to-PCX entry points and full-system build component mapping.
--
-- categories remain the single catalog source of truth. `sell_entry_config`
-- records which catalog category is a public sell entry and its presentation
-- metadata; `sell_build_components` maps a BUILD entry's roles to component
-- categories. Both are additive and non-destructive. entry_key mirrors the
-- canonical domain `SellEntry` values; role mirrors `BuildComponentRole`.

CREATE TABLE IF NOT EXISTS sell_entry_config (
  id uuid PRIMARY KEY,
  entry_key text NOT NULL UNIQUE CHECK (entry_key IN ('DESKTOP_PC', 'PC_PARTS', 'LAPTOP', 'LAPTOP_PARTS')),
  category_id uuid NOT NULL UNIQUE REFERENCES categories(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('BUILD', 'PARTS')),
  icon_key text NOT NULL CHECK (icon_key IN ('desktop', 'parts', 'laptop', 'laptop-parts')),
  hint text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sell_build_components (
  id uuid PRIMARY KEY,
  entry_key text NOT NULL REFERENCES sell_entry_config(entry_key) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'battery', 'screen', 'keyboard', 'charger')),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entry_key, role),
  UNIQUE(entry_key, category_id)
);

-- Seed the four canonical sell entries, pointing at the existing catalog
-- categories (desktop-pc / laptop introduced in 0006, pc-parts / laptop-parts
-- introduced in 0024). Non-destructive: ON CONFLICT DO NOTHING.
INSERT INTO sell_entry_config(id, entry_key, category_id, kind, icon_key, hint, sort_order, is_active) VALUES
('90000000-0000-0000-0000-000000000001', 'DESKTOP_PC',   '80000000-0000-0000-0000-000000000001', 'BUILD', 'desktop',       'Sell a complete desktop build', 10, true),
('90000000-0000-0000-0000-000000000002', 'PC_PARTS',     '80000000-0000-0000-0000-000000000011', 'PARTS', 'parts',         'Sell a single desktop part',    20, true),
('90000000-0000-0000-0000-000000000003', 'LAPTOP',       '80000000-0000-0000-0000-000000000002', 'BUILD', 'laptop',        'Sell a complete laptop',        30, true),
('90000000-0000-0000-0000-000000000004', 'LAPTOP_PARTS', '80000000-0000-0000-0000-000000000012', 'PARTS', 'laptop-parts',  'Sell a single laptop part',     40, true)
ON CONFLICT (id) DO NOTHING;

-- Desktop PC build: cpu, motherboard, ram, storage required; psu/gpu optional.
INSERT INTO sell_build_components(id, entry_key, role, category_id, required, sort_order) VALUES
('90000000-0000-0000-0000-000000000011', 'DESKTOP_PC', 'cpu',         '80000000-0000-0000-0000-000000000004', true,  10),
('90000000-0000-0000-0000-000000000012', 'DESKTOP_PC', 'motherboard', '80000000-0000-0000-0000-000000000005', true,  20),
('90000000-0000-0000-0000-000000000013', 'DESKTOP_PC', 'ram',         '80000000-0000-0000-0000-000000000006', true,  30),
('90000000-0000-0000-0000-000000000014', 'DESKTOP_PC', 'storage',     '80000000-0000-0000-0000-000000000007', true,  40),
('90000000-0000-0000-0000-000000000015', 'DESKTOP_PC', 'psu',         '80000000-0000-0000-0000-000000000008', false, 50),
('90000000-0000-0000-0000-000000000016', 'DESKTOP_PC', 'gpu',         '80000000-0000-0000-0000-000000000003', false, 60)
ON CONFLICT (id) DO NOTHING;

-- Laptop build: ram/storage required (laptop-specific categories), battery,
-- keyboard, charger, screen optional.
INSERT INTO sell_build_components(id, entry_key, role, category_id, required, sort_order) VALUES
('90000000-0000-0000-0000-000000000017', 'LAPTOP', 'ram',       '80000000-0000-0000-0000-000000000013', true,  10),
('90000000-0000-0000-0000-000000000018', 'LAPTOP', 'storage',   '80000000-0000-0000-0000-000000000014', true,  20),
('90000000-0000-0000-0000-000000000019', 'LAPTOP', 'battery',   '80000000-0000-0000-0000-000000000015', false, 30),
('90000000-0000-0000-0000-000000000020', 'LAPTOP', 'keyboard',  '80000000-0000-0000-0000-000000000016', false, 40),
('90000000-0000-0000-0000-000000000021', 'LAPTOP', 'charger',   '80000000-0000-0000-0000-000000000017', false, 50),
('90000000-0000-0000-0000-000000000022', 'LAPTOP', 'screen',    '80000000-0000-0000-0000-000000000018', false, 60)
ON CONFLICT (id) DO NOTHING;
