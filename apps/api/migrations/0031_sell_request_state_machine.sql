-- Expand the sell-request lifecycle to the canonical state machine from
-- API_SPECIFICATION_STATE_MACHINES §16 (reconciled with BUSINESS_PRODUCT_REQUIREMENTS
-- §12; PRELIMINARY_REVIEW becomes REVIEWING). Additive and non-destructive:
-- the existing DRAFT/SUBMITTED/REVIEWING rows remain valid.

ALTER TABLE sell_requests DROP CONSTRAINT sell_requests_status_check;
ALTER TABLE sell_requests DROP CONSTRAINT sell_requests_check;

ALTER TABLE sell_requests
  ADD CONSTRAINT sell_requests_status_check
    CHECK (status IN (
      'DRAFT', 'SUBMITTED', 'REVIEWING', 'INFO_REQUIRED',
      'INSPECTION_REQUIRED', 'INSPECTING', 'OFFERED', 'ACCEPTED',
      'REJECTED', 'REJECTED_BY_SELLER', 'EXPIRED',
      'ACQUISITION_PENDING', 'PAID', 'CLOSED', 'CANCELLED'
    )),
  ADD CONSTRAINT sell_requests_check
    CHECK (
      (status = 'DRAFT' AND submitted_at IS NULL)
      OR (status <> 'DRAFT' AND status <> 'CANCELLED' AND submitted_at IS NOT NULL)
      OR (status = 'CANCELLED')
    );
