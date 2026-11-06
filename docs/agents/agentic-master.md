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

## Open work (2026-11-06)
- **Agent ledger** on `claude/blissful-cori-knkti4` (25 files, no PR yet): « À valider »
  queue, run/cost ledger, autonomy levels. Migration 015 is **already applied in
  production** (tables `agent_runs`, `agent_actions`, `agent_autonomy` exist, unused by the
  live code). **Not released** — waiting for Xavier's review. Before review: rebase on
  `main`, re-run checks, and write a plain-language brief: which existing agents change
  behaviour on merge, the default autonomy level of each action type, and how to roll back.
