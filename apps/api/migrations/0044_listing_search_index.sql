-- Dedicated full-text search index (E8).
--
-- A tsvector generated column on product_models (name + model_code, weighted)
-- backed by a GIN index accelerates token-based storefront search with relevance
-- ranking instead of a sequential ILIKE substring scan.
ALTER TABLE product_models
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(model_code, '')), 'B')
  ) STORED;

CREATE INDEX product_models_search_idx ON product_models USING GIN(search_vector);