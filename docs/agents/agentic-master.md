# 🤖 Agentic Master

**Mission.** Every place where an AI model acts on the site or on its data: what it may do,
how sure it must be, what it costs, and how a human keeps control.

## Owns
- Agent ledger, approval queue and autonomy levels: `src/lib/agent-ledger/`,
  `src/app/api/admin/agents/` (once merged)
- Recherche magique: `src/lib/nl-search/`, `src/app/decouverte/`, boards (`NL_SEARCH_*`)
- AI-facing surfaces: MCP server (`src/app/api/mcp/`, `src/lib/mcp/`), `llms.txt`, the
  markdown layer (`src/app/md/`, `src/lib/markdown/`), AI bot telemetry (`src/lib/ai-bots.ts`)
- LLM prompts and cost caps across the site; the SEO agent's write rules
  (`src/lib/seo-autofix.ts`) together with the Growth Scout

## Not yours
- The Totem chat assistant (`src/lib/totem/`, `src/app/api/totem/`, `src/components/totem/`,
  `src/app/admin/totem/`) and its evaluation bench → Totem Trainer (since 2026-11-07)
- The enrichment *pipeline* and crons → Librarian (prompt quality is shared)
- What the SEO agent should target → Growth Scout

## Rules
- Every automated write must be reversible and logged; kill switches stay one env var away.
- Minors / EU guardrails (see `CLAUDE.md`): no generated ages or facts at render time,
  care banners with results, never instead.
- Never expose model or vendor names in rendered text.

## Open work (2026-11-27)
- **27 Nov batch** (Director's brief, approved by Xavier) on branch
  `worktree-agent-a2dbae55c835aac38`, committed locally, not pushed:
  - SEO agent: `seoTitle` fully deterministic (`decideSeoTitle`, no model call, no
    keyword gate, canonical human titles kept, > 52 chars left alone as `too-long`);
    `META_SEO_PATTERNS` widened (« familles cherchant / à la recherche » without
    article, « trouveront ici »); `details.refusalsDetail` (≤ 30, draft ≤ 300 chars);
    empty model answers are `ai-failed`. **To do:** read the next Thursday row —
    expect 0 « réponse vide » / « mot-clé toujours absent » on titles, and judge the
    synopsis refusals from `refusalsDetail`.
  - homepage-watch: 16+ slots only go to titles the interleave reaches (GTA VI
    regression test with the 27 Nov inputs); a new season dated by its premiere
    (`newSeasonTiming`); `titles[]` now logs `releasedDaysAgo` / `signal` / `isNew` /
    `priority`. B1 finding: the release date WAS carried to the pin choice; the
    « null » came from the log never writing it. GTA VI is an admin pin until 11 Dec
    (counted in the 16+ cap). **To do:** next odd-day run — check `priority` and that
    no 16+ slot is left unused.
  - Games row « Sortis récemment en jeux vidéo »: news row, no age cap, ranked by
    notability × recency (`sortBy=notable`, `src/lib/games-notable.ts`); « Switch 2 »
    added to `CONSOLE_PLATFORMS` (the Zelda remake was missing from the row because
    of it, not because of its age). The FilterSidebar console list
    (`src/components/media/FilterSidebar.tsx`, Age Keeper) still has no « Switch 2 »
    — flagged to the Director.
- **Homepage « À ne pas manquer » + `homepage-watch` agent** (Xavier's request, 21 Nov):
  - V2 band right after « Pour ce week-end », informational and NOT age-capped (GTA VI
    shows with its 18); pure selection in `src/lib/homepage-spotlight.ts`.
  - Cinema rail ranked by French relevance (`rankCinemaForFrance`), 6 now_playing pages,
    anime kept.
  - Cron `homepage-watch` every 2 days (05:41 UTC, odd days), fully registered
    (activatedAt 2026-11-21); writes ON in production, kill switch `HOMEPAGE_WATCH_AUTOFIX`.
  - Merged in #121 (21 Nov 2026). `sql/016_homepage_spotlight.sql` applied in production
    the same day. First real run 23 Nov: 8 imports, 8 watch pins (the whole band), which
    pushed out Zelda: Ocarina of Time and VisionQuest — the Director re-added both as
    `admin` pins (expire 7 Dec).
  - **Band rules v2 (approved by Xavier 23 Nov)** on branch
    `worktree-agent-adbea46e40999d0a1`, committed locally, not pushed: watch pins capped
    at 6 (fallback keeps 2), reserved slots (a game out ≤ 30 days, a film in French
    cinemas), launches ranked by notability × recency (`gameLaunchScore`,
    `launchRecencyFactor`), at most 2 titles rated 16+ (admin pins counted, never
    removed; the skipped 16+ launches are listed in the report). Zelda root cause: the IGDB
    « jeux sortis récemment » source ranked by lifetime rating count only (Enshrouded 69 >
    Zelda 61) and 8 interleaved pins left 2 game slots. **To do:** after merge, read the
    next run's report (odd day) and check `titles[].matureCapSkipped` in `cron_logs`.
  - Overwatch seed (Librarian scope, same branch): `releasedFrom: "2022-10-01"`, so the 2016
    « Overwatch » can never satisfy the seed; the pillar settles a same-title tie with the
    window. **To do:** read the next Monday `games-top-names` report — expect « Importé :
    Overwatch… » or « Introuvable » (never « déjà présent »); if the successor lands as plain
    « Overwatch », check the pillar card shows it.
  - Switch 2 (IGDB platform 508) added to `CONSOLE_PLATFORM_IDS` by the Director in #121 —
    every Switch 2-only game (the Zelda: Ocarina of Time remake) was invisible to search,
    fresh-release import and games-top-names. Confirm on the Monday import that the id
    matches (a wrong id would only match nothing).
- **SEO agent guards** (approved by Xavier 21 Nov, merged in #116): synopsis keyword-stuffing refusal (`synopsisStuffingReason`), canonical
  `seoTitle` « <Titre> — âge conseillé : dès N ans », year for homonyms. Existing
  overrides in the old forms are left as they are (still valid for `seoTitleMatchesAge`);
  a deterministic one-off normalisation was approved by Xavier on 21 Nov (to do). After the first
  Thursday run, read `outcomes.refusals` in `cron_logs` to check the guard isn't
  refusing clean drafts.
- **Game « augmentation » pilot** (approved by Xavier 19 Nov 2026, under the Age Keeper's
  rules) on `claude/agentic-master-game-facts-pilot`, no PR yet, nothing applied or deployed:
  - Migration `sql/add_game_facts.sql` (12 nullable `game_*` columns; the ten visible facts
    move `content_updated_at`, bookkeeping columns don't). **Applied in production on
    21 Nov 2026** (verified: 12 columns + trigger).
  - Dispatch-only task `game-facts` (Actions › Scheduled Maintenance, `dry_run=true` first):
    writes the facts of the 100 treated games only; control games are refused.
  - Pilot lists frozen in `src/lib/game-pilot.ts` (100 treated weighted toward Totem > PEGI
    and shared quick-answer wording, 100 controls matched on age band × popularity quintile ×
    PEGI gap). Selection query in the file's comment.
  - Pilot V3 fiches: « Fiche pratique » (hidden until the facts were read once), visible
    « Pourquoi cet âge ? » + PEGI comparison, every parent point, younger alternatives.
    Classic body unchanged. Controls get nothing.
  - Xavier's decisions (21 Nov 2026): « Oui » for online play / in-game purchases when the
    stored PEGI descriptors are the only source (kept, pinned by
    `game-practical-sheet.test.ts`); younger alternatives on pilot games under 14 kept; the
    PEGI comparison sentence is ALSO a FAQPage Q/A on treated fiches only
    (`src/lib/game-pilot-faq.ts`, emitted only with the V3 body and a content analysis —
    hidden when the analysis is hidden, restates the stored age only).
  - **Pilot length: 6 weeks** before comparing treated vs control in Search Console.
    Start = the day the `game-facts` backfill runs: **start date: 22 Nov 2026** (100/100
    written, second run idempotent) → comparison due start + 6 weeks: **3 Jan 2027**.
    One hand fix on day 0: Crash Bandicoot's duration (36.5 h from the source, real ≈ 6 h)
    set to null by the Director. No widening, re-draw or list edit before.
  - Next: Xavier reviews → apply migration → dry run → write (= day 0, fill the date above)
    → deploy → compare treated vs control in Search Console at week 6 before widening.
- **Agent ledger** on `claude/blissful-cori-knkti4` (25 files, no PR yet): « À valider »
  queue, run/cost ledger, autonomy levels. Migration 015 is **already applied in
  production** (tables `agent_runs`, `agent_actions`, `agent_autonomy` exist, unused by the
  live code). **Not released** — waiting for Xavier's review. Before review: rebase on
  `main`, re-run checks, and write a plain-language brief: which existing agents change
  behaviour on merge, the default autonomy level of each action type, and how to roll back.
