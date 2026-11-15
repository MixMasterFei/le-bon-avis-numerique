# 📚 Librarian

**Mission.** Keep the catalogue complete, correct and fresh: what comes in, how it is
enriched, and the scheduled jobs that keep it all running.

## Owns
- Imports: `src/lib/tmdb.ts`, `src/lib/igdb.ts`, `src/lib/google-books.ts`,
  `src/lib/import-helpers.ts`, cinema (`src/lib/cinema.ts`)
- Enrichment, quality score, similarity, streaming sync, age-floor sweep
- Scheduled jobs: `.github/workflows/cron.yml`, `src/lib/cron-supervisor.ts`,
  `src/lib/cron-log.ts`, `src/lib/debt-digest.ts`, `KNOWN_CRON_TASKS`, `/steph` glossary
- Data freshness (`content_updated_at` triggers) and the sitemap (`src/lib/sitemap.ts`)
- SQL migrations (`sql/`, `prisma/schema.prisma`) — written and tested here, **applied to
  production only with Xavier's OK**

## Rules
- New cron: register it in `cron.yml`, `CRON_JOB_ROUTES` (`src/lib/cron-credential.ts`),
  `EXPECTED_TASKS` (with `activatedAt`),
  `KNOWN_CRON_TASKS`, `CRON_STALE_HOURS` if weekly+, and `PIPELINE_TASKS`.
- Manual SQL migrations only (`prisma db execute`), never `prisma db push`.
- `media_items` is unique on `(tmdb_id, type)` — never on bare `tmdb_id`.

## Open work (2026-11-15) — import batches, preview first
Branch `librarian/import-candidates` (pushed, no PR). Xavier approved preparing two
targeted batches (~300 family series available in France, ~150 games popular in France)
for title-by-title review. Nothing written to production.
- `POST /api/cron/import-candidates?kind=tv|games&dryRun=1` = read-only ranked list
  (one `cron_logs` row, task `import-candidates`); `&ids=…` imports exactly the approved
  ids (≤ 40 séries / ≤ 100 jeux per call), never a discover result. Dispatch-only in
  cron.yml (`import-candidates-tv` / `-games`, input `import_ids`), so not in
  EXPECTED_TASKS / KNOWN_CRON_TASKS / PIPELINE_TASKS (ad-hoc, like news-reset-recent).
  Rules + thresholds: `src/lib/import-candidates.ts`; TV creation shared with the
  pre-school sweep via `src/lib/tv-import.ts`.
- Next: Xavier dispatches the two previews, approves ids, then the import runs.
- **Pre-school sweep has imported 0 series for days** (cron_logs: ~30 « déjà en base »
  + ~30 « pas dispo FR » per call, pages 1-15 every day, never past 15). The FR test
  relies on `extractProviders`, which knows neither TF1+ nor M6+ (and the catalogue
  holds 0 series tagged France TV). Decide: add TF1+/M6+ to `PROVIDER_NAME_MAP` /
  `FILTERABLE_PLATFORMS` (UI change → Age Keeper), and persist the sweep's cursor.
- 373 / 954 series have no platform at all; Saturday streaming sync should be checked.

## Open work (2026-11-07)
Branch `librarian/f05-f06` (local, not pushed) — fixes from the 7 Nov assessment:
- F05: a similarity title is stamped only when all its writes succeeded; only
  P2002 is harmless; failures → `partial` / `error` with `failedItems`, `failures`.
- Similarity age score made monotonic (`src/lib/similarity-score.ts`).
- F06: `recentReleaseVotesWhere` re-reads released titles whatever their votes —
  weekly for 90 days, every 4 weeks until 365, retired at 500 votes. First
  Saturday after deploy reads the whole year's releases once (several hundred
  TMDB calls; see `recentBatch` / `remainingRecent` in cron_logs).
- 404 end state (last commit, separable): **apply `sql/add_tmdb_not_found_count.sql`
  before deploying it** (Xavier's OK). Titles given up are listed in `gaveUp`.
- CLAUDE.md « Saturday 5:19 AM » row still describes the old 0-vote 7–60-day window.

From the 6 Nov release (#106), check after the deploy:
- `/sitemap.xml` returns a `<sitemapindex>` of four sections; sections answer
  `x-vercel-cache: PRERENDER`, `HIT` or `STALE`, never `content-disposition: …filename=`.
- Tonight's quality job should rewrite a handful of rows, not ~12 000.
- First `release-status` run should unblock most of the 56 films stuck in « Post Production ».
- First Saturday: `backfill-ratings` does its one-time catch-up of ~600 rows.
- PR #73 (July, games pillar matching): looks superseded by `src/lib/game-seed-match.ts` on
  `main` — confirm, then close.
