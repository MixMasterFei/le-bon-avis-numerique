-- Backfill MediaItem.platforms[] from streaming_availability.
--
-- Context: the platform FILTER (media-queries.ts, smart filter, MCP tools)
-- reads the denormalized media_items.platforms[] array, while the fiche
-- displays streaming_availability rows. The admin "MAJ streaming" operation
-- (api/admin/streaming/cache) populated the table for ~8k films but never
-- wrote the array, so ~2,090 films with a real subscription/free offer on a
-- filterable platform were invisible to the filter (525 covered vs 2,441
-- justified, movies+TV).
--
-- Semantics mirror extractProviders() in src/lib/streaming-providers.ts:
-- SUBSCRIPTION + FREE offers only (no RENT/BUY — "sur Netflix" means
-- watchable, not purchasable), normalized through PROVIDER_NAME_MAP,
-- restricted to FILTERABLE_PLATFORMS. Keep the three lists in sync with
-- that file when editing.
--
-- Additive only: fills rows whose platforms[] is empty, never overwrites a
-- non-empty array (day-one import data is fresher than the table for recent
-- titles). Games are excluded — their platforms[] holds console names.
-- Idempotent: re-running finds nothing left to fill.
--
-- Apply with:
--   npx prisma db execute --file sql/backfill_platforms_from_streaming.sql --schema prisma/schema.prisma

WITH name_map(raw, norm) AS (VALUES
  ('Netflix','Netflix'),('Netflix basic with Ads','Netflix'),
  ('Amazon Prime Video','Prime Video'),('Prime Video','Prime Video'),
  ('Disney Plus','Disney+'),('Disney+','Disney+'),
  ('Canal+','Canal+'),('Canal+ Cinema','Canal+'),('myCANAL','Canal+'),
  ('Apple TV Plus','Apple TV+'),('Apple TV','Apple TV+'),('Apple TV+','Apple TV+'),
  ('France TV','France TV'),('france.tv','France TV'),
  ('Arte','Arte'),('ARTE','Arte'),
  ('OCS Go','OCS'),('OCS','OCS'),
  ('Paramount Plus','Paramount+'),('Paramount+ Amazon Channel','Paramount+'),('Paramount+','Paramount+'),
  ('Max','Max'),('Max Amazon Channel','Max'),
  ('Crunchyroll','Crunchyroll'),
  ('ADN','ADN'),('Anime Digital Network','ADN')
),
filterable(p) AS (VALUES
  ('Netflix'),('Disney+'),('Prime Video'),('Canal+'),('France TV'),
  ('Apple TV+'),('Max'),('Paramount+'),('OCS'),('Arte'),('Crunchyroll'),('ADN')
),
derived AS (
  SELECT sa.media_id, array_agg(DISTINCT nm.norm ORDER BY nm.norm) AS platforms
  FROM streaming_availability sa
  JOIN name_map nm ON nm.raw = sa.provider
  JOIN filterable f ON f.p = nm.norm
  WHERE sa.provider <> '_none'
    AND sa.country = 'FR'
    AND sa.type IN ('SUBSCRIPTION', 'FREE')
  GROUP BY sa.media_id
)
UPDATE media_items m
SET platforms = d.platforms
FROM derived d
WHERE m.id = d.media_id
  AND m.type IN ('MOVIE', 'TV')
  AND cardinality(COALESCE(m.platforms, '{}')) = 0;
