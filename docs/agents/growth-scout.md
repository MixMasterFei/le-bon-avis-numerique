# 📈 Growth Scout

**Mission.** Bring French families to the site and find out what they look for: search,
AI answer engines, social, newsletter.

## Owns
- SEO strategy and measurement: Search Console data, the weekly `seo-striking-distance`
  report (its write rules are shared with the Agentic Master), structured data intent
- Marketing docs: `docs/marketing/` (`claude_mkt.md`, `launch-checklist.md`,
  `market-analysis.md`), `docs/seo-gsc-setup.md`
- The editorial calendar's *what and why* — the Blogger writes, the Scout picks topics and
  reads the results

## Rules
- French audience first; no internal service names in anything public.
- Every claim of traffic or ranking comes with its source and date.
- Query-level data: each `seo-striking-distance` run stores its top 50 opportunities in
  `cron_logs.details.topQueries` (query, page path, position, impressions, clicks) from the
  19 Nov 2026 run on. Rank and follow pages from there; compare a changed page across runs
  3–4 weeks apart, never one.

## Open work (2026-11-22) — Noël, maillage et prises de contact
Branch `claude/growth-noel-maillage` (local, not pushed).
- **Internal links, Nov–Dec only (`isChristmasSeason`)**: fiche card « Noël en famille :
  nos sélections par âge » (classic + V3 bodies, under the similar titles, in Suspense) on
  films/series matched by `isChristmasThemed` → `/noel/films-en-famille`, and on games
  listed by the gift page → `/noel/jeux-video-a-offrir` (membership = `fetchGiftGamesByBand`
  ids, `unstable_cache` 1 h, tag `noel-gift-games`); in-season block on `/jeux/quel-age`;
  the hub, both sub-pages and `/collections/films-noel-famille` now all link to one another
  (`noelCrossLinks` in `src/lib/noel/pages.ts`).
- Known gap: « La Reine des neiges » (2013) has no Christmas signal in title, genres or
  topics, so its fiche gets no card although « reine des neiges âge » is a striking-distance
  query. Not forced by hand; a « Noël » topic would be a Librarian/Age Keeper data call.
- Outreach drafts: `docs/marketing/noel-2026-outreach.md` (GTA VI note read from the DB on
  22 Nov 2026, press pitch, members' email, outlet types). **Nothing sent.** The members'
  email goes only to the consented Resend audience, on Xavier's go.
- **Xavier, 5 minutes:** in Search Console, « Inspection de l'URL » → « Demander une
  indexation » for `/noel`, `/noel/films-en-famille`, `/noel/jeux-video-a-offrir` (once
  this branch is live, so Google sees the new internal links at the same time).
- Mid-December: read « scrooge / grinch / films de noël / jeux à offrir » in `topQueries`
  and the three pages' impressions; compare with the 19 Nov run.

## Open work (2026-11-21) — Noël
Branch `claude/growth-noel-2026` (local, not pushed): `/noel` hub (cinéma ≤ 12 ans,
fiche vérifiée), `/noel/films-en-famille`, `/noel/jeux-video-a-offrir` — live DB reads,
expert-only, sitemap, promoted Nov–Dec only (homepage strip banner, /films, /jeux, footer);
the strip's 2nd slot now follows the season (`collectionHighlights`). After merge: submit
the three URLs in Search Console; read « scrooge / grinch / films de noël » queries in
`topQueries` mid-December. Part A defects (wrong versions in collections, stale pillar
editions, Chroniques de Noël date) handed to the Director as proposals — no DB write.

## Open work (2026-11-15)
- Shipped 15 Nov (#112): real 404 for missing fiches, login links nofollow, description
  without the doubled age + year, FAQ answer gives the reason, links-only pass on 120 more
  fiches. Read their effect from 3–4 weeks of `topQueries`.
- October indexed-page drop (~10k → ~6.4k): waiting on Xavier's GSC exports (Crawl stats
  Sep–Nov; « Crawled / Discovered – currently not indexed »). Leading hypothesis: crawl
  budget (every route dynamic, ~267k requests/day) plus template near-duplicates.
- GPTBot burst from 13 Nov (25k hits on 14 Nov): watch crawl cost.
- 17 Nov launch, with the Blogger: once #106 is live, `/sitemap.xml` becomes an index of
  four sitemaps — resubmit it in Search Console and watch coverage.
- Walk `docs/marketing/launch-checklist.md` and report what is still open.
