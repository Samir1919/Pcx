-- Optional attribute-set override for a build role (Option 3): a build component
-- may reference a reusable attribute set directly, overriding the category→set
-- inheritance used for the seller's selected specs. NULL means "use the
-- component category's assigned set".
ALTER TABLE sell_build_components
  ADD COLUMN IF NOT EXISTS attribute_set_id uuid REFERENCES attribute_sets(id) ON DELETE SET NULL;
