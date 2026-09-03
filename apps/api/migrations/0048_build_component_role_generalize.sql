-- Generalize build-component roles so a new BUILD sell entry can introduce its
-- own component roles at runtime instead of the seed ten-role enum. The seed
-- roles (cpu/gpu/motherboard/ram/storage/psu/battery/screen/keyboard/charger)
-- still satisfy the relaxed check, so this is non-destructive.

ALTER TABLE sell_build_components DROP CONSTRAINT IF EXISTS sell_build_components_role_check;
ALTER TABLE sell_build_components ADD CONSTRAINT sell_build_components_role_check CHECK (role ~ '^[a-z][a-z0-9-]*$');
