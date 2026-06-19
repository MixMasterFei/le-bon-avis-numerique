# Plan B — baseline: current ratings vs official + gold

_Generated 2026-06-19. Read-only DB measurement, no LLM calls. Source: `scripts/eval/age-rating-baseline.ts`._

**What this is:** how Totem's current `expertAgeRec` compares to the official answer key. This is the score any future Totem Score model must beat.

**How to read it:** official ratings are a legal *floor*, not ground truth. Totem deliberately goes stricter than lenient ratings, so **"Totem stricter" is expected/healthy**, and **"Totem more lenient than official" is the audit-worthy signal**. PEGI (games) is reliable, so those numbers read as genuine accuracy.

Total items with both a Totem age and a mappable official rating: **5069** (games 1094, films/TV 3975 — of which 2442 are "tous publics", reported separately).

### Games vs PEGI — cleanest accuracy signal

PEGI is a dependable answer key and maps directly to an age. Treat these as the headline accuracy numbers.

| Metric | Value |
|---|---|
| Items evaluated | 1094 |
| Mean absolute error (years) | 2.09 |
| Within ±1 year | 49.9% |
| Within ±2 years | 68.5% |
| Totem stricter than official (age >) | 37.3% |
| Totem equal to official | 20.2% |
| Totem more lenient than official (age <) | 42.5% |

### Rated films & TV vs CSA/CNC (official age > 0) — divergence from the legal floor

Excludes "tous publics" (reported below), so the error is meaningful. Higher Totem ages are intended; watch the **more lenient** row — titles Totem rates *below* the legal rating, the cases worth auditing.

| Metric | Value |
|---|---|
| Items evaluated | 1533 |
| Mean absolute error (years) | 1.32 |
| Within ±1 year | 50.8% |
| Within ±2 years | 81.6% |
| Totem stricter than official (age >) | 43.5% |
| Totem equal to official | 47.9% |
| Totem more lenient than official (age <) | 8.6% |

### All-audience films/TV (official = « tous publics »)

Totem never assigns 0+, so the useful question is how high it pushes these. Of **2442** "tous publics" films/TV, Totem rates **1460** (59.8%) at 10+ and **1189** (48.7%) at 12+ — the guardrail catching lenient ratings (the war-drama / Forrest Gump case). Totem age distribution for these:

| Totem age | Count |
|---|---|
| 3+ | 29 |
| 4+ | 39 |
| 5+ | 41 |
| 6+ | 443 |
| 7+ | 147 |
| 8+ | 282 |
| 9+ | 1 |
| 10+ | 271 |
| 12+ | 496 |
| 13+ | 117 |
| 14+ | 341 |
| 15+ | 152 |
| 16+ | 81 |
| 17+ | 1 |
| 18+ | 1 |

### vs Gold (hand-labeled ground truth)

_Awaiting labels — fill `data/golden-set/golden-set-v1.csv` (see `data/golden-set/RUBRIC.md`). Once rows are filled this scores Totem's current ratings against your hand-labeled family ages + content levels._

### Unmapped official ratings

- `NR` ×41

### Takeaways for Plan B

- The games/PEGI numbers show how well the current pipeline already tracks a reliable answer key — the bar a Totem Score model must clear.
- The films/TV "more lenient than official" percentage is the **risk surface**: ideally near zero (Totem should rarely sit below the legal floor).
- The **vs Gold** section above is the real target (family age, not the legal floor). Fill `data/golden-set/golden-set-v1.csv` to populate it; "too lenient vs gold" is the metric that matters most.
