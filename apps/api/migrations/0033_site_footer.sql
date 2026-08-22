-- Admin-managed storefront site footer content.
--
-- A single-row config table (singleton) drives the public storefront footer
-- (`GET /api/v1/footer`). Admin edits it through `POST /api/v1/admin/footer`
-- (upsert). Content is presentation-only: no secrets, no lifecycle state.
--
-- Non-destructive: the row is seeded with the default footer so the storefront
-- never regresses to an empty footer before an admin edits it.

CREATE TABLE IF NOT EXISTS site_footer (
  id uuid PRIMARY KEY,
  tagline text NOT NULL DEFAULT '',
  copyright text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  trade_license text NOT NULL DEFAULT '',
  bin text NOT NULL DEFAULT '',
  social_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  link_columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO site_footer(id, tagline, copyright, link_columns) VALUES
(
  'a0000000-0000-0000-0000-000000000001',
  'A certified pre-owned marketplace for inspected, graded hardware.',
  'PCX · Certified pre-owned marketplace',
  '[
    {
      "title": "Shop",
      "links": [
        { "label": "Storefront", "href": "/storefront" },
        { "label": "Sell to PCX", "href": "/sell" },
        { "label": "Verify your contact", "href": "/verify" }
      ]
    },
    {
      "title": "Account",
      "links": [
        { "label": "Sign in", "href": "/login" },
        { "label": "Register", "href": "/register" }
      ]
    }
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
