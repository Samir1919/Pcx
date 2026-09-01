-- Packaging evidence media for shipments (E11).
--
-- A shipment can carry packaging evidence photos (box sealed, label, contents)
-- linked through this join table. The binary lives on disk via the media table;
-- only the link + purpose are stored here.
CREATE TABLE IF NOT EXISTS shipment_media (
  id uuid PRIMARY KEY,
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  UNIQUE(shipment_id, media_id)
);