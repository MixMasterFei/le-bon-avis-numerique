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
- New cron: register it in `cron.yml`, `EXPECTED_TASKS` (with `activatedAt`),
  `KNOWN_CRON_TASKS`, `CRON_STALE_HOURS` if weekly+, and `PIPELINE_TASKS`.
- Manual SQL migrations only (`prisma db execute`), never `prisma db push`.
- `media_items` is unique on `(tmdb_id, type)` — never on bare `tmdb_id`.

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
