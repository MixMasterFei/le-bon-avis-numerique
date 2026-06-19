# Plan B — Step 2: provider A/B (GPT vs Mistral)

_Generated 2026-06-19. Sample of 57 catalog items; each provider re-rated them from title/genres/synopsis. Scored with the same metric as the baseline, bucketed by type._

> Note: skipped (no key set): GPT (gpt-4o-mini).

| Provider | Games vs PEGI: MAE / ±2 | Rated film·TV vs CSA: MAE / ±2 | vs Totem (agreement): MAE / ±2 | unparseable |
|---|---|---|---|---|
| Mistral (mistral-small-latest) | 2.23 / 69.2% (n=13) | 2.7 / 56.5% (n=23) | 1.32 / 88% | 7 |

**Reference — current Totem pipeline (from the baseline):** games vs PEGI MAE 2.09 / ±2 68.5%; rated film·TV vs CSA MAE 1.32 / ±2 81.6%.

**How to read:** lower MAE / higher ±2 vs the answer key = closer to the reference. 'vs Totem' = agreement with the current pipeline. A provider that matches/beats the baseline numbers is a safe swap on quality; if Mistral does, the sovereignty switch is low-risk.

## Findings (2026-06-19, first directional run)

- **Games (vs PEGI): on par.** Mistral-small 2.23 / ±2 69.2% ≈ current pipeline 2.09 / 68.5%.
- **Films/TV (vs CSA): weaker.** Mistral-small ±2 56.5% vs the pipeline's 81.6% — it tracks the legal floor less closely. (Caveat: official ratings are a floor, not ground truth, so some divergence is expected — but the gap vs the current pipeline is real.)
- **Agreement with current pipeline: high.** 88% within ±2 years — Mistral broadly "thinks like" the existing ratings.

**Verdict:** promising, not a drop-in win at the small tier. Sovereignty is viable on quality, but needs a stronger test before any switch.

## Caveats (why this is directional, not conclusive)

- **No GPT side yet** — `OPENAI_API_KEY` is blank locally, so this is "Mistral vs answer key + vs current pipeline", not a clean GPT-vs-Mistral head-to-head. (The current pipeline is GPT-4o-mini + guardrails, so the baseline is a rough GPT proxy only.)
- **Small sample** — n=13 games, n=23 rated films/TV; single run.
- **`mistral-small-latest` only** — `mistral-medium`/`large` would likely close the films/TV gap.
- **7/57 unparseable** (free-tier rate-limits / occasional non-JSON), excluded from scoring.

## Next test (to make it conclusive)

1. Add a real `OPENAI_API_KEY` locally (or run where prod keys exist) → true GPT-vs-Mistral head-to-head.
2. Add `mistral-medium-latest` to the provider list.
3. Larger sample (e.g. `EVAL_SAMPLE=150`) and ideally against the hand-labeled **golden set** rather than the legal floor.
