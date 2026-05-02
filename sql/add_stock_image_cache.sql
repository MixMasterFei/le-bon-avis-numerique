-- Cache table for Pexels / Unsplash search results. The free tiers
-- have generous-but-finite quotas (Pexels 200/h, Unsplash 50/h);
-- caching by normalized keyword set keeps re-runs of the news cron
-- from re-hitting the API for the same story themes.
--
-- Keys: (provider, keywords_key) is unique. keywords_key is the
-- lowercased, sorted, space-joined top-3 stopword-stripped tokens
-- from the story title. Same keywords + same provider → same image.
--
-- TTL is enforced at read time in src/lib/stock-photo.ts (30 days).
-- We don't add a partial index for it because the table stays small.

CREATE TABLE IF NOT EXISTS stock_image_cache (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  keywords_key  TEXT        NOT NULL,
  provider      TEXT        NOT NULL,
  image_url     TEXT        NOT NULL,
  credit        TEXT        NOT NULL,
  license_url   TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_image_cache_provider_key_idx
  ON stock_image_cache(provider, keywords_key);

CREATE INDEX IF NOT EXISTS stock_image_cache_created_at_idx
  ON stock_image_cache(created_at);
