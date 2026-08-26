-- One-shot SEO title override for Spider-Man: Brand New Day.
--
-- Issue: GSC shows "Interdit aux enfants ?" queries at 0.3% CTR. The default
-- buildFicheTitle() produces a title that doesn't match the dominant query
-- pattern. This override explicitly includes "À partir de quel âge".
--
-- The H1 (`title` column) stays unchanged — "Spider-Man: Brand New Day".
-- Only the document <title> (SERP) changes via the existing `seo_title` field.
--
-- The root layout appends " | Totem Avisé" automatically, so we exclude that
-- suffix from the stored value.
--
-- Safe + idempotent: UPDATE with WHERE id = ... affects one row only.

UPDATE media_items
SET seo_title = 'Spider-Man: Brand New Day — À partir de quel âge ? Dès 12 ans'
WHERE id = '2a7f0579-f70d-4717-a0aa-d2b4838492f1';
