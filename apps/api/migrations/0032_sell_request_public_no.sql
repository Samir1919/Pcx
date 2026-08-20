-- Server-owned human-readable sell-request number. The public number is
-- generated from a sequence, never from client input, and is independent of
-- the internal UUID primary key.

CREATE SEQUENCE IF NOT EXISTS sell_request_public_no_seq AS integer START 1;

-- Backfill existing requests deterministically (null public_request_no only)
-- before the column is relied upon by the web UI. Legacy orders get a stable
-- number derived from their creation order.
UPDATE sell_requests
SET public_request_no = 'SR-' || lpad(nextval('sell_request_public_no_seq')::text, 6, '0')
WHERE public_request_no IS NULL;
