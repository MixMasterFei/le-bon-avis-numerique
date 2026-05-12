-- Add FALLBACK to the ImageSourceType enum.
-- Used by the news pipeline when an article carries no usable photo (or
-- only a thumbnail too small for a hero) and we substitute the generated
-- branded "zen card" served by /api/news/fallback-card.
-- Idempotent; safe to re-run. Additive only — no existing rows affected.
ALTER TYPE "ImageSourceType" ADD VALUE IF NOT EXISTS 'FALLBACK';
