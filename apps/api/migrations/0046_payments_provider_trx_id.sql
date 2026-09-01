-- bKash refund reconciliation support (E10/E12).
--
-- The bKash gateway's refund needs the original payment's paymentID AND its
-- trxID (returned by execute/query after the customer completes the checkout).
-- Store the trxID server-side when the payment is reconciled so the returns
-- module can reverse the exact transaction without re-querying the gateway.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider_trx_id text;