-- Refund provider reconciliation fields on return_requests (E12).
--
-- settleRefund now records the server-authoritative refund gateway outcome
-- (provider name, idempotent provider transaction id, and status) alongside the
-- REFUNDED transition. The provider transaction id is unique so a replayed or
-- duplicate disbursement is deduped. A gateway failure still transitions the
-- return to REFUNDED (the authorized financial fact persists) and records
-- refund_provider_status = 'FAILED' for later reconciliation.
ALTER TABLE return_requests
  ADD COLUMN refund_provider text,
  ADD COLUMN refund_provider_transaction_id text,
  ADD COLUMN refund_provider_status text CHECK (refund_provider_status IN ('INITIATED', 'CONFIRMED', 'FAILED'));

CREATE UNIQUE INDEX IF NOT EXISTS return_requests_refund_provider_txn_uniq
  ON return_requests(refund_provider_transaction_id) WHERE refund_provider_transaction_id IS NOT NULL;