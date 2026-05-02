-- One-shot cleanup — mark all existing manga rows as enriched so they
-- stop showing in the "œuvres à enrichir" counter and don't get picked
-- up by the daily enrichment cron (we no longer maintain the manga
-- vertical so spending API budget on their analysis is wasted work).
--
-- Safe to re-run: idempotent (only flips rows that aren't already true).
-- Doesn't delete any data — the manga rows stay queryable in case the
-- vertical is ever revived.

UPDATE media_items
SET is_enriched = TRUE
WHERE type = 'MANGA'
  AND is_enriched = FALSE;
