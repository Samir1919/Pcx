-- Dynamic sub-grouping inside an attribute set. A set item can belong to a
-- named group (the desktop-pc set's items map to Processor/RAM/Storage/GPU/
-- Power component groups) so input forms render attributes in labeled groups
-- instead of one flat list. The group is data-driven (never hardcoded in the
-- UI); a null group renders under a generic "Attributes" group.

ALTER TABLE attribute_set_items ADD COLUMN group_key text;

-- Seed the desktop-pc sub-groups.
UPDATE attribute_set_items SET group_key = 'processor'
WHERE set_id = '8a000000-0000-0000-0000-000000000001' AND definition_id = '83000000-0000-0000-0000-000000000025';
UPDATE attribute_set_items SET group_key = 'ram'
WHERE set_id = '8a000000-0000-0000-0000-000000000001' AND definition_id = '83000000-0000-0000-0000-000000000026';
UPDATE attribute_set_items SET group_key = 'storage'
WHERE set_id = '8a000000-0000-0000-0000-000000000001' AND definition_id = '83000000-0000-0000-0000-000000000027';
UPDATE attribute_set_items SET group_key = 'gpu'
WHERE set_id = '8a000000-0000-0000-0000-000000000001' AND definition_id = '83000000-0000-0000-0000-000000000028';
UPDATE attribute_set_items SET group_key = 'power'
WHERE set_id = '8a000000-0000-0000-0000-000000000001' AND definition_id = '83000000-0000-0000-0000-000000000032';
