ALTER TABLE inventory_items ADD COLUMN acquisition_cost numeric CHECK (acquisition_cost >= 0);
