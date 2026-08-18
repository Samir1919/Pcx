-- Additive catalog taxonomy for the four Sell-to-PCX entry points:
-- Desktop PC, PC Parts, Laptop, Laptop Parts.
--
-- Non-destructive: inserts parent groups and laptop-part subcategories with
-- fixed seed-prefix UUIDs (ON CONFLICT DO NOTHING), then reparents existing
-- part categories under PC Parts and retunes sort_order for a grouped display.
-- Existing category ids, slugs, and model/spec references are unchanged.

-- Top-level parent groups.
INSERT INTO categories(id,parent_id,name,slug,status,sort_order) VALUES
('80000000-0000-0000-0000-000000000011',NULL,'PC Parts','pc-parts','ACTIVE',20),
('80000000-0000-0000-0000-000000000012',NULL,'Laptop Parts','laptop-parts','ACTIVE',40)
ON CONFLICT (id) DO NOTHING;

-- Laptop Parts subcategories (laptop RAM/storage differ from desktop parts).
INSERT INTO categories(id,parent_id,name,slug,status,sort_order) VALUES
('80000000-0000-0000-0000-000000000013','80000000-0000-0000-0000-000000000012','Laptop RAM','laptop-ram','ACTIVE',300),
('80000000-0000-0000-0000-000000000014','80000000-0000-0000-0000-000000000012','Laptop Storage','laptop-storage','ACTIVE',310),
('80000000-0000-0000-0000-000000000015','80000000-0000-0000-0000-000000000012','Battery','battery','ACTIVE',320),
('80000000-0000-0000-0000-000000000016','80000000-0000-0000-0000-000000000012','Keyboard','keyboard','ACTIVE',330),
('80000000-0000-0000-0000-000000000017','80000000-0000-0000-0000-000000000012','Charger','charger','ACTIVE',340),
('80000000-0000-0000-0000-000000000018','80000000-0000-0000-0000-000000000012','Screen','screen','ACTIVE',350)
ON CONFLICT (id) DO NOTHING;

-- Reparent existing part categories under PC Parts and retune sort order so
-- the four top-level entries lead and their parts group together.
UPDATE categories SET parent_id='80000000-0000-0000-0000-000000000011', sort_order=200 WHERE id='80000000-0000-0000-0000-000000000003'; -- GPU
UPDATE categories SET parent_id='80000000-0000-0000-0000-000000000011', sort_order=210 WHERE id='80000000-0000-0000-0000-000000000004'; -- CPU
UPDATE categories SET parent_id='80000000-0000-0000-0000-000000000011', sort_order=220 WHERE id='80000000-0000-0000-0000-000000000005'; -- Motherboard
UPDATE categories SET parent_id='80000000-0000-0000-0000-000000000011', sort_order=230 WHERE id='80000000-0000-0000-0000-000000000006'; -- RAM
UPDATE categories SET parent_id='80000000-0000-0000-0000-000000000011', sort_order=240 WHERE id='80000000-0000-0000-0000-000000000007'; -- Storage
UPDATE categories SET parent_id='80000000-0000-0000-0000-000000000011', sort_order=250 WHERE id='80000000-0000-0000-0000-000000000008'; -- PSU

-- Keep the top-level card order: Desktop PC, PC Parts, Laptop, Laptop Parts.
UPDATE categories SET sort_order=10 WHERE id='80000000-0000-0000-0000-000000000001'; -- Desktop PC
UPDATE categories SET sort_order=30 WHERE id='80000000-0000-0000-0000-000000000002'; -- Laptop
