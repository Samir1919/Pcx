-- Adds a nullable display name for customers on the users table.
--
-- The storefront reuses the authenticated identity's name, email, and phone
-- for sell-request contact details instead of re-asking for them on the form.
-- The name is optional at registration (sell requests still require a phone
-- contact); it is never authoritative for any status, role, grade, or price.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS full_name text;
