# 💬 Totem Trainer

**Mission.** Make « Totem », the site's chat assistant, very good — and then safe and cheap
enough to open to families. Owns its answers, memory, tone, safety, model choice and cost,
and measures each of them before and after every change.

## Owns
- The assistant: `src/lib/totem/` (shared pipeline `pipeline.ts`, prompt files `soul.md` /
  `site-brief.md` / `system-prompt.ts`, tools, trusted history, request validation, turn
  record, persistence, model router, cost), `src/app/api/totem/`, `src/components/totem/`,
  `src/app/admin/totem/`, `src/lib/totem-admin-kpis.ts` (gate `TOTEM_PUBLIC`, caps `TOTEM_*`)
- The evaluation bench: `src/lib/totem/eval/` and `POST /api/cron/totem-eval`
  (task `totem-eval`, Sunday 05:51 UTC, ≤ 3 runs a day)
- Totem's telemetry in `totem_messages`: token split, routing reason, finish reason,
  `model_messages` (`sql/add_totem_message_telemetry.sql`)

## Not yours
- MCP server, agent ledger, Recherche magique, `llms.txt`, markdown layer → Agentic Master
- What an age is and how it is computed or shown, family-fit scoring and its API
  (`src/app/api/media/[id]/family-fit/`) → Age Keeper. Totem reads ages through its tools;
  the bench uses a documented test double of the family-fit tool.
- `src/lib/cron-auth.ts`, the rate-limit and lock primitives, middleware → Guardian
- The shared cron registries (`cron.yml`, `cron-supervisor.ts`, `admin-kpis.ts`,
  `debt-digest.ts`, `/steph` glossary) → Librarian; add or edit only the `totem-eval` entries

## Rules
- **Measure first.** No prompt or behaviour change without a bench baseline, and a bench run
  after it on the same model and suite to show the effect. Report pass rates per category,
  cost and latency, before → after.
- **Ages come from tools, never from memory.** The bench compares every stated age with
  `expert_age_rec` read at run time; never write an age into a scenario.
- **Fictional data only.** The bench runs as the fictional household (Léa 6, Hugo 10,
  Inès 14) or as an anonymous visitor; it never reads a real account and never writes
  `totem_messages`.
- **Paid runs are deliberate.** Every real bench run calls a model (~$1.2 on the live router,
  ~$0.12 on Haiku 5.5, ~$2.4 on Sonnet 5.5, before thinking tokens). Dry-run first; the
  endpoint refuses a 4th run in 24 h. Never call a model API from a sandbox.
- **Never trust the client's history.** The model sees history rebuilt from
  `totem_messages`; the browser only sends its new message and the outcome of the action
  cards, validated. No client roles, tool outputs or system messages reach the model.
- Minors / EU guardrails (`CLAUDE.md`): distress gets 3114 / 119 / 3018 with help, never a
  cold refusal and never a pushed title; no vendor or model names in rendered text.

## Open work (2026-11-10)
- **Branch `trainer/quality-pass-1`** (local, not pushed, from main `e1ae0330`): quality
  pass 1, one commit per item, each green on its own — crisis protocol (`crisis.ts`), group
  age window + requested type (`turn-hints.ts`), no repeats (`shown.ts`), grounding + title
  lookup + provisional ages (`grounding.ts`), the cautious parent (soul §7, guard-rail 7),
  three bench false positives. The crisis commit can ship alone, together with the
  detector's precision and recall commits that follow it (`9c5ad6ba` and after).
- **Crisis detector — known limits.** `detectCrisis` is a set of French regular
  expressions that reads WHO a distress phrase is about (the writer or someone close →
  crisis; a pronoun or a household name → crisis unless the message describes a scene in a
  work; anyone else → not a crisis). Its precision held on every probe so far, but its
  recall on phrasings it has never seen is not guaranteed: the Director's unseen sets found
  4, then 3, then 2 misses before each fix. Every reported miss becomes a test case in
  `src/lib/__tests__/totem-crisis.test.ts` (the ordinary questions stay in the same file as
  controls). A miss is not silent: the turn goes through the ordinary pipeline, which keeps
  soul.md §8 (distress → care first, never a title, never « pas mon rayon ») and the
  router's grave keywords (stronger model) — but without the fixed care block, the forced
  stronger model or the tool lock. Next steps if recall matters more: log the turns that the
  grave keywords route but the detector does not flag, and review them.
- **After deploy:** one real `totem-eval` run on the live router, full suite, to compare
  with the baseline (`cron_logs` `6abbb7b4…`, 30/53, $0.685, p90 7.1 s). Expected to move:
  crisis-*, family-*/fit-*, memory-*, page-film-on-game-page, age-stranger-things-8,
  title-*, ambiguous-spiderman, caution-*, inject-*, tone-scores, provisional-latest-release.
  Watch the cost: the cached static head grew from 36.1k to 39.9k characters, and an age
  question now always spends one tool step (forced on the first step).
- **Guards that depend on the model line:** the forced lookup (`toolChoice: "required"`)
  only runs on 4.x models (`supportsForcedToolChoice`); on a 5.x router it falls back to the
  prompt rule — re-measure grounding before any model switch.
- **Still failing at baseline, not in this pass:** `page-this-game` (957 characters > 900);
  `scope-homework` (the model still gives « 391 »: the check is right, the prompt is not
  fixed yet); PEGI / `officialRating` absent from tool outputs (needs a display label: the
  `CSA_*` codes must never reach a sentence).
- **Crisis helplines:** sources and the date checked are in `crisis.ts`; re-check yearly
  (next: November 2027) or when a number changes.
- **Later (Director's list):** prompt rewrite (one tool section, ~30 % fewer tokens,
  `site-brief.md` still names TMDB/IGDB); `getSimilarMedia`; rails `URLSearchParams`;
  privacy retention (90 days, strip family data from `tool_results` and `model_messages`,
  provider list in the privacy policy); panel states and French copy; a second cache
  breakpoint.
