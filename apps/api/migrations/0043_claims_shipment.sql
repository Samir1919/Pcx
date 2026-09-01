-- Claim carrier pickup link (E13 remainder).
--
-- A claim can be linked to the return/pickup shipment that carried the item back
-- to PCX. The shipment is the server-owned logistics record.
ALTER TABLE claims
  ADD COLUMN shipment_id uuid REFERENCES shipments(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS claims_shipment_idx ON claims(shipment_id);