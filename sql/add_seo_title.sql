-- SEO-only meta <title> override for media fiches. Written by the
-- striking-distance agent (Lever C) to put a ranking keyword in the Google
-- SERP title WITHOUT renaming the display name (H1/cards/links/schema stay
-- `title`). See src/lib/seo-autofix.ts. Additive + idempotent.

ALTER TABLE media_items
  ADD COLUMN IF NOT EXISTS seo_title text;
