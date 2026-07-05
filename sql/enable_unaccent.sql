-- Accent-insensitive search.
--
-- The `unaccent` Postgres extension lets us match "Amelie" against the
-- stored title "Le Fabuleux Destin d'Amélie Poulain" (é → e). Without it the
-- header/autocomplete/search queries did a plain ILIKE that treated é and e
-- as different characters, so users typing without accents got "aucun
-- résultat" for titles that exist.
--
-- Idempotent. Already applied to the production database on 2026-07-05.
-- Supabase whitelists `unaccent`; no superuser action required.
--
-- Used by:
--   src/lib/search-normalize.ts        (matchMediaIdsByTitle)
--   src/app/api/db/media/route.ts      (/recherche results)
--   src/app/api/autocomplete/route.ts  (nav typeahead)
--   src/app/api/search/route.ts        (aggregated search local DB tier)

CREATE EXTENSION IF NOT EXISTS unaccent;
