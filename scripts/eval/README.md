# Plan B eval harness

Tools to measure Totem's age-rating quality and compare model providers, for the
proprietary "Totem Score" effort. See [docs/roadmap/totem-model.md](../../docs/roadmap/totem-model.md)
and [docs/roadmap/vivatech-positioning.md](../../docs/roadmap/vivatech-positioning.md).

All scripts are **read-only on the catalog** and need `DATABASE_URL` (already in
`.env.local`). They write reports to `docs/reports/eval/`.

## Scripts

| Script | What it does | Cost | Run |
|---|---|---|---|
| `age-rating-baseline.ts` | Scores current `expertAgeRec` vs the official answer key (PEGI / CSA). The "score to beat". | Free (DB only) | `npx tsx scripts/eval/age-rating-baseline.ts` |
| `provider-ab.ts` | Re-rates a sample with **GPT vs Mistral**, scored with the same metric — the sovereignty A/B. | Paid (LLM calls) | needs `OPENAI_API_KEY` + `MISTRAL_API_KEY`, then `npx tsx scripts/eval/provider-ab.ts` |
| `rating-map.ts` / `metrics.ts` | Shared: official-rating→age mapping, scoring functions. | — | (imported) |

## Reading the numbers

Official ratings are a legal **floor**, not ground truth — Totem intentionally
goes stricter than lenient ratings. So:
- **PEGI (games)** is reliable → those numbers read as genuine accuracy.
- **Films/TV**: "Totem stricter" is expected; "Totem more lenient than official"
  is the audit-worthy signal.

## Next step

Hand-label a small **golden set** (a few hundred titles) to define the
family-age target, add it as a reference here, then this same harness scores both
a future Totem Score model and the provider A/B against it.
