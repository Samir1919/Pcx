-- Server-derived tax allocation on orders (E9).
--
-- The order total is server-computed: total = subtotal + shipping + tax - discount.
-- tax_amount is derived by the server (flat VAT percentage of the subtotal), never
-- supplied by the client, and rendered read-only on every surface.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tax_amount numeric NOT NULL DEFAULT 0 CHECK (tax_amount >= 0);

-- Update the totals invariant to include tax.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_check;
ALTER TABLE orders ADD CONSTRAINT orders_check CHECK (total_amount = subtotal + shipping_amount + tax_amount - discount_amount);