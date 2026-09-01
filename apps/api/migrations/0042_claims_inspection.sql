-- Claim inspection link (E13 remainder).
--
-- A claim can be linked to the inspection of the returned item so the resolution
-- is grounded in a real inspection. Moving REQUESTED → IN_REVIEW happens when the
-- inspection is linked.
ALTER TABLE claims
  ADD COLUMN inspection_id uuid REFERENCES inspections(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS claims_inspection_idx ON claims(inspection_id);