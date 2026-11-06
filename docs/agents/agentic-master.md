# 🤖 Agentic Master

**Mission.** Every place where an AI model acts on the site or on its data: what it may do,
how sure it must be, what it costs, and how a human keeps control.

## Owns
- Agent ledger, approval queue and autonomy levels: `src/lib/agent-ledger/`,
  `src/app/api/admin/agents/` (once merged)
- Totem Assistant: `src/lib/totem/`, `src/app/api/totem/`, `src/components/totem/`,
  `src/app/admin/totem/` (gate `TOTEM_PUBLIC`, caps `TOTEM_*`)
- Recherche magique: `src/lib/nl-search/`, `src/app/decouverte/`, boards (`NL_SEARCH_*`)
- AI-facing surfaces: MCP server (`src/app/api/mcp/`, `src/lib/mcp/`), `llms.txt`, the
  markdown layer (`src/app/md/`, `src/lib/markdown/`), AI bot telemetry (`src/lib/ai-bots.ts`)
- LLM prompts and cost caps across the site; the SEO agent's write rules
  (`src/lib/seo-autofix.ts`) together with the Growth Scout

## Not yours
- The enrichment *pipeline* and crons → Librarian (prompt quality is shared)
- What the SEO agent should target → Growth Scout

## Rules
- Every automated write must be reversible and logged; kill switches stay one env var away.
- Minors / EU guardrails (see `CLAUDE.md`): no generated ages or facts at render time,
  care banners with results, never instead.
- Never expose model or vendor names in rendered text.

## Open work (2026-11-06, evening)
- **Agent ledger** on `claude/blissful-cori-knkti4`, no PR yet: « À valider » queue,
  run/cost ledger, autonomy levels. **Up to date with `main`** (release #107 merged in, no
  conflict); type-check, 1 299 tests and lint pass on the merged branch. Migration 015 is
  applied in production; the three tables are **empty** and unused by the live code.
  **Review brief for Xavier: [`review-agent-ledger.md`](review-agent-ledger.md).**
  Waiting for his review — nothing ships before.
- After merge: run `seo-striking-distance` by hand once and check `/admin/operations#agents`
  against the real database (the panel has only been tested on mocked data).
- Next agents to route through the ledger, one at a time: news publish decisions, then the
  blog drafts agent. Pre-existing lint warnings in owned files (Totem conversations route,
  `decouverte/blocks/EditorialSources.tsx` + `HeroMatch.tsx`, `tableau/[id]/BoardView.tsx`)
  are left for a separate cleanup.
- CLAUDE.md says the SEO agent writes « max 3 synopses + 3 titles/run »; the code allows
  12 + 12 (`MAX_REWRITES`, `MAX_TITLE_REWRITES` in `src/lib/seo-autofix.ts`). Fix the doc
  (or the caps) with the Growth Scout.
