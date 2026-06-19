# Plan B eval harness

Tools to measure Totem's age-rating quality, build the ground-truth reference, and
compare model providers — for the proprietary "Totem Score" effort. See
[docs/roadmap/totem-model.md](../../docs/roadmap/totem-model.md) and
[docs/roadmap/vivatech-positioning.md](../../docs/roadmap/vivatech-positioning.md).

All scripts are **read-only on the catalog** and need `DATABASE_URL` (already in
`.env.local`). Reports are written to `docs/reports/eval/`.

## Logical order

1. **Golden set (ground truth)** — `golden-set-generate.ts` builds a labeling
   sheet; you hand-label the *correct family age + content levels*; the harness
   reads it back. This is the real target (family age, not the legal floor).
2. **Measurement** — `age-rating-baseline.ts` and `provider-ab.ts` score the
   current pipeline and the LLM providers against the official floor **and** the
   golden set.

## Scripts

| Script | What it does | Cost | Run |
|---|---|---|---|
| `golden-set-generate.ts` | Generates the stratified ~150-title labeling sheet (CSV) at `data/golden-set/golden-set-v1.csv`. Deterministic (seeded). | Free (DB only) | `npx tsx scripts/eval/golden-set-generate.ts` |
| `age-rating-baseline.ts` | Scores current `expertAgeRec` vs the official answer key (PEGI / CSA) **and vs the golden set** (age + per-axis) once filled. | Free (DB only) | `npx tsx scripts/eval/age-rating-baseline.ts` |
| `provider-ab.ts` | Re-rates a sample with **GPT vs Mistral** vs official / Totem / **gold** — the sovereignty A/B. | Paid (LLM calls) | needs `OPENAI_API_KEY` + `MISTRAL_API_KEY`, then `npx tsx scripts/eval/provider-ab.ts` |
| `golden-set.ts` | Golden-set CSV read/write + `loadGoldenSet()` (skips unlabeled rows). | — | (imported) |
| `rating-map.ts` / `metrics.ts` | Shared: official-rating→age mapping, scoring functions. | — | (imported) |

## Labeling the golden set

1. `npx tsx scripts/eval/golden-set-generate.ts` → writes the blank sheet.
2. Open `data/golden-set/golden-set-v1.csv` in Excel/Sheets and fill the `gold_*`
   columns per [`data/golden-set/RUBRIC.md`](../../data/golden-set/RUBRIC.md).
   Blank rows are skipped, so label in waves (start with ~30 to validate the rubric).
3. Re-run the baseline (and, with keys, the provider A/B) — the **vs Gold**
   sections populate automatically.

## Reading the numbers

- **vs Official** — official ratings are a legal *floor*, not ground truth. PEGI
  (games) is reliable; for films/TV "Totem stricter" is expected and "Totem more
  lenient than official" is the audit-worthy signal.
- **vs Gold** — the real target. Here **both directions are errors**, and
  **too lenient (below gold) is the family-risk signal** — do not read it with the
  "stricter = good" lens used for the official floor.
