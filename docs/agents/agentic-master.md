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

## Open work (2026-11-21)
- **Homepage « À ne pas manquer » + `homepage-watch` agent** (Xavier's request, 21 Nov) on
  `claude/agentic-master-homepage-watch`, committed locally, not pushed, no PR:
  - V2 band right after « Pour ce week-end », informational and NOT age-capped (GTA VI
    shows with its 18); pure selection in `src/lib/homepage-spotlight.ts`.
  - Cinema rail ranked by French relevance (`rankCinemaForFrance`), 6 now_playing pages,
    anime kept.
  - Cron `homepage-watch` every 2 days (05:41 UTC, odd days), fully registered
    (activatedAt 2026-11-21); writes ON in production, kill switch `HOMEPAGE_WATCH_AUTOFIX`.
  - Merged in #121 (21 Nov 2026). `sql/016_homepage_spotlight.sql` applied in production
    the same day (table empty until the first run). **To do:** one manual `homepage-watch`
    dispatch with `dry_run`, then read the first scheduled report (23 Nov).
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
    Start = the day the `game-facts` backfill runs: **start date: _à remplir_** →
    comparison due start + 6 weeks: **_à remplir_**. No widening, re-draw or list edit before.
  - Next: Xavier reviews → apply migration → dry run → write (= day 0, fill the date above)
    → deploy → compare treated vs control in Search Console at week 6 before widening.
- **Agent ledger** on `claude/blissful-cori-knkti4` (25 files, no PR yet): « À valider »
  queue, run/cost ledger, autonomy levels. Migration 015 is **already applied in
  production** (tables `agent_runs`, `agent_actions`, `agent_autonomy` exist, unused by the
  live code). **Not released** — waiting for Xavier's review. Before review: rebase on
  `main`, re-run checks, and write a plain-language brief: which existing agents change
  behaviour on merge, the default autonomy level of each action type, and how to roll back.
