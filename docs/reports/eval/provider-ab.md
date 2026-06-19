# Plan B — Step 2: provider A/B (GPT vs Mistral)

_Generated 2026-06-19. Sample of 85 catalog items; each provider re-rated them from title/genres/synopsis. Scored with the same metric as the baseline, bucketed by type._


| Provider | Games vs PEGI: MAE / ±2 | Rated film·TV vs CSA: MAE / ±2 | vs Totem (agreement): MAE / ±2 | unparseable |
|---|---|---|---|---|
| GPT (gpt-4o-mini) | 2.1 / 70% (n=30) | 2.24 / 60.6% (n=33) | 1.06 / 94.1% | 0 |
| Mistral (mistral-small-latest) | 2.23 / 69.2% (n=13) | 2.61 / 54.5% (n=33) | 1.18 / 91.2% | 17 |
| Mistral (mistral-medium-latest) | 2.04 / 73.9% (n=23) | 2.36 / 53.6% (n=28) | 1.08 / 89% | 12 |

**Reference — current Totem pipeline (from the baseline):** games vs PEGI MAE 2.09 / ±2 68.5%; rated film·TV vs CSA MAE 1.32 / ±2 81.6%.

**How to read:** lower MAE / higher ±2 vs the answer key = closer to the reference. 'vs Totem' = agreement with the current pipeline. A provider that matches/beats the baseline numbers is a safe swap on quality; if Mistral does, the sovereignty switch is low-risk.

## Findings — three-way (2026-06-19, GPT vs Mistral-small vs Mistral-medium)

- **Raw model quality is a near-tie: Mistral-medium ≈ GPT-4o-mini.** On games (vs PEGI) Mistral-medium is actually *best* (2.04 / ±2 73.9%), edging GPT (2.1 / 70%). On films/TV GPT is marginally ahead (2.24 vs 2.36). On agreement with the current pipeline GPT leads (94.1% vs 89%) — expected, since the pipeline is built on GPT-4o-mini.
- **The big gap is raw-LLM vs the pipeline, not GPT vs Mistral.** Every raw model scores ~2.2–2.6 MAE on films/TV vs CSA, while the current pipeline scores **1.32**. That gap is the **scaffolding** — deterministic guardrails, age/metric clamps, the tuned French rubric — not the base model. **→ The moat is the scaffolding + data you own, not the model vendor.**
- **Reliability:** GPT 0 failures; Mistral-medium 12, small 17 (free-tier rate-limits / occasional non-JSON). A paid Mistral tier + retries would be needed for production.

**Verdict:** the sovereignty switch is **viable on quality**. Mistral-medium is competitive with GPT-4o-mini (better on games, a hair behind on films/TV), and rating quality lives in the pipeline you own rather than the engine — so swapping GPT→Mistral-medium is low-risk *as long as the scaffolding stays*. Reliability is the main thing to harden.

## Caveats

- Modest per-bucket samples (games n=13–30, films/TV n=28–33), single run, and official ratings are a legal *floor*, not ground truth.
- Numbers will firm up against the hand-labeled **golden set** (the cleaner reference for the family-age target).
