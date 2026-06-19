# Totem Score — Proprietary Rating Model (Phase 0/1 Feasibility)

**Status:** Phase 0/1 — feasibility / corpus inventory
**Author:** Technical advisor
**Date:** 2026-06-18
**Scope:** Read-only assessment of whether Totem can train a first-pass, ownable age-recommendation model on data it already holds. No code changed; counts pulled live from the production database (Prisma, SELECT/count only).

---

## 1. Objective — "AI as a strength, not a liability"

Today the rating pipeline leans on a general-purpose LLM for enrichment. That is fast to ship but easy to dismiss ("it's just ChatGPT"). **Plan B** is to build a **proprietary "Totem Score"** model — a family-recommended-age predictor (plus per-axis content metrics) trained on data Totem owns and curates: PEGI/official classifications, a hand-labeled golden set, and the existing enriched catalog as distillation targets. The model becomes a *defensible asset*: a reproducible, auditable, Totem-specific judgment that the LLM merely seeds, rather than the product itself. The deterministic age-floor guardrail (`src/lib/age-floor.ts`) is the embryo of this — a rule layer that already overrides the LLM when it is too lenient. The Totem Score generalizes that idea into a learned model.

---

## 2. Corpus inventory (live counts)

**Method:** one-off Prisma script against production (`DATABASE_URL` in `.env.local`), `groupBy`/`count` only, since deleted. **Confidence: high** (exact counts, not estimates). BOOK and APP types have **zero rows** — the catalog is MOVIE / TV / GAME / MANGA.

| Signal | MOVIE | TV | GAME | MANGA | Total |
|---|--:|--:|--:|--:|--:|
| **Total MediaItem** | 7,241 | 651 | 1,842 | 517 | **10,251** |
| Has `officialRating` | 3,650 | 366 | 1,094 | 0 | 5,110 |
| Has `expertAgeRec` | 7,241 | 651 | 1,842 | 517 | 10,251 |
| `isEnriched = true` | 7,203 | 651 | 1,842 | 517 | 10,213 |
| Has `ContentMetrics` row | 7,203 | 651 | 1,842 | 517 | 10,213 |
| **Silver** (`isEnriched` ∧ metrics) | 7,203 | 651 | 1,842 | 517 | **10,213** |
| Has `synopsisFr` | 7,241 | 651 | 1,842 | 517 | 10,251 |
| Has `communityAgeRec` | 3 | 0 | 1 | 0 | **4** |

**`officialRating` value distribution** (raw stored strings — formats are inconsistent and need normalization before use as a feature):

- **All-audiences (lower bound 0):** `TP` 1,052 · `TOUS_PUBLICS` 787 · `U` 597 (movies) — three encodings of the same thing.
- **Movie restriction bands:** numeric `12` 541 / `16` 203 / `10` 30 / `18` 21, plus `CSA_12` 233 · `CSA_16` 124 · `CSA_18` 36 · `CSA_10` 26. (Numeric vs `CSA_*` are again two encodings of one scale.)
- **TV:** `12` 122 · `16` 88 · `10` 57 · `18` 31 · `NR` 41 · small `CSA_*` + `TP` tails.
- **GAME (PEGI — clean, reliable):** `PEGI_12` 281 · `PEGI_16` 280 · `PEGI_18` 252 · `PEGI_7` 150 · `PEGI_3` 131. **1,094 / 1,842 games carry PEGI.**
- **MANGA:** no official rating at all (0).

**`enrichmentSource` on ContentMetrics:** `AI_BASIC` 7,972 · `METADATA_ONLY` 1,389 · `AI_DEEP` 852. So ~8.8k rows are LLM-derived, ~1.4k are metadata-only heuristics (weaker silver).

**`expertAgeRec` is fully populated** (every item has one) but most are provisional/AI-derived, not human-verified. Distribution is healthy across bands (e.g. MOVIE: age 6 ≈ 741, 8 ≈ 611, 10 ≈ 716, 12 ≈ 1,474, 14 ≈ 1,284, 16 ≈ 709; GAME peaks at 12/16; TV spread 10–16). No single band dominates pathologically — usable for stratified sampling.

### Community ground truth — effectively zero (confirmed)

- **AgeVote table:** **4 total votes** across 4 distinct titles. **0 titles** reach the ≥5-votes / 70%-agreement consensus rule referenced in `CLAUDE.md`.
- **`communityAgeRec`:** set on **4** items total.
- **UserContentMetrics** (community per-axis): **1 row**.
- **`MediaCorrection` of type `AGE_RATING`:** 0.
- **`dataSource = EXPERT`:** 0. **`enrichedBy` non-null:** 0 — i.e. no human-attributed enrichment exists yet; all enrichment is automated.

**Conclusion: B-v1 must not depend on community signals.** They are statistically absent today. They are the basis for **B-v2**, later.

---

## 3. Target variable — recommended family age ≠ legal rating

The model predicts **`recommendedAge`** (the Totem family-recommended minimum age, the same concept as `expertAgeRec`), an ordinal in the ~3–18 range. This is **deliberately distinct from the legal/official rating**:

- Official French classifications are frequently **too lenient** for family-guidance purposes — many acclaimed adult films are "Tous Publics"/`TP` (1,839 such movie rows here), and the age-floor module exists precisely because the LLM, anchored to that rating, was under-rating mature war dramas and violent live-action.
- Therefore official ratings are a **feature and a lower bound** (a `TP` film is *at least* all-audiences-legal, but Totem may still recommend 12+), **never the training label by itself**.
- **PEGI is the exception:** for games it is a reliable, content-descriptor-backed age band and can serve as a near-label (with the existing PEGI→age mapping in `src/lib/igdb.ts`), not merely a floor.

So the target is a **Totem-specific judgment** that can be *stricter* than the law — which is the whole product promise.

---

## 4. Ground-truth strategy

Three tiers, combined:

### Tier 1 — Hard labels / strong priors (buildable now)
- **PEGI (games):** 1,094 titles with a reliable age band. Treat as **labels** for the game head of the model (or a strong prior the model may only override upward, mirroring the age-floor philosophy).
- **Official film/TV ratings as a FLOOR feature:** restriction bands (`12/16/18`, `CSA_*`) give a *minimum*; all-audiences encodings (`TP/U/TOUS_PUBLICS`) give weak signal only. Requires a **normalization pass** first (collapse the duplicate encodings into one ordinal scale + an "unknown" flag).

### Tier 2 — Golden set (the key Phase-1 deliverable)
A **hand-labeled gold standard** is the missing piece — there is currently **no human-verified age label** in the DB. Propose:

- **Size: 400–600 titles** (enough to (a) calibrate/validate B-v1, (b) measure where the silver labels are wrong, (c) anchor the mature-content gates). Start with **~150 as a fast pilot**, expand to ~500.
- **Selection — stratified** so every region of the problem is covered:
  - **By type:** MOVIE / TV / GAME / MANGA proportional-ish but with MANGA and TV over-sampled (they're under-served: MANGA has *no* official rating, TV is small).
  - **By age band:** even cells across 3 / 6 / 8 / 10 / 12 / 14 / 16 / 18 so the model isn't only good at the crowded 12–16 middle.
  - **By genre / disagreement:** deliberately include titles where `officialRating` (floor) and current `expertAgeRec` **disagree by ≥2 years**, and lenient-rated mature titles (the Forrest Gump case) — these are the highest-value labels.
- **Process:** one rubric, two labelers per title where feasible, adjudicate disagreements; store the gold label in a dedicated field/table (a `goldAgeRec` + `goldMetrics` column or small `ExpertLabel` table — note the schema has **no** human-override field today, only `enrichedBy`, which is unused).

### Tier 3 — Silver corpus / distillation
- **~10,213 enriched titles** with `expertAgeRec` + full `ContentMetrics` (violence, sexNudity, language, consumerism, substanceUse, positiveMessages, roleModels on a 0–5 scale, + v2 fields). These are LLM-generated, so they are **silver, not gold** — use them to **distill** a smaller, owned model (the model learns the LLM's mapping from cheap features → age/metrics, then the golden set + PEGI + floor correct its biases).
- Weight by `enrichmentSource`: `AI_DEEP` (852) > `AI_BASIC` (7,972) > `METADATA_ONLY` (1,389). The `enrichmentConfidence` field can weight per-row.

---

## 5. B-v1 (build now) vs B-v2 (community-supervised, later)

| | **B-v1 — buildable today** | **B-v2 — later** |
|---|---|---|
| **Label source** | PEGI (games) + official ratings as floor-feature + golden set (~500) + silver distillation (~10k) | Community age-vote consensus (≥5 votes / 70%) retargets the label |
| **Blocked on** | Golden-set labeling + rating normalization | Vote volume scaling (today: 4 votes total) |
| **Output** | `recommendedAge` + content-axis predictions, calibrated; respects age-floor as a hard post-rule | Same, but target re-grounded on real families' judgments + per-axis community metrics |
| **Risk** | Silver inherits LLM bias → mitigated by gold + floor | Cold-start until votes accumulate |

**Readiness verdict:** **Yes for B-v1.** There is enough *non-community* ground truth to train and — critically — to **calibrate/validate** a first model now: a clean PEGI label set (1,094), official-rating floors on ~4k film/TV titles, a fully-featured 10k silver corpus, and rich input features. **The one real gap is the golden set** (zero human labels today) and **rating-encoding normalization**. Neither is large; both are Phase-1-sized.

---

## 6. Available features (per item)

From `MediaItem` + `ContentMetrics` (all already populated for the silver corpus):

- **Text:** `synopsisFr` (100% coverage), `title` / `originalTitle`.
- **Categorical:** `type`, `genres[]`, `topics[]` (themes), `originalLanguage`, `director`, `demographic` (manga shounen/seinen/…), `status`.
- **Content axes (0–5):** `violence`, `sexNudity`, `language`, `consumerism`, `substanceUse`, `positiveMessages`, `roleModels` — both as model *inputs* (for the age head) and as *secondary prediction targets*.
- **Enrichment-v2 tags:** `toneTags[]`, `pacing`, `visualStyle` (drives the age-floor animation discount), `emotionalThemes[]`, `sensitiveWarnings[]`.
- **Floor / prior signals:** `officialRating` (normalized), `pegiDescriptors[]`, PEGI band.
- **Popularity / context (optional):** `tmdbRating`, `tmdbVoteCount`, `duration`, `releaseDate`.
- **Quality gating:** `dataQualityScore`, `enrichmentSource`, `enrichmentConfidence` — for sample weighting and filtering weak silver rows.

This is more than enough feature surface for a gradient-boosted ordinal model (or a small fine-tune) over structured features + a synopsis embedding.

---

## 7. Recommended immediate next steps (ordered)

1. **Normalize the rating encodings.** Collapse `TP`/`U`/`TOUS_PUBLICS` → one "all-audiences" value and `12`/`CSA_12` (etc.) → one ordinal scale, with an explicit "unknown/NR" flag. Read-only audit first, then a one-time backfill. (Prereq for using official ratings as a clean floor feature.)
2. **Add a gold-label home in the schema.** A `goldAgeRec` column (or small `ExpertLabel` table) + provenance — there is none today (`enrichedBy`/`dataSource=EXPERT` are unused). Use manual SQL migration per `CLAUDE.md`.
3. **Build the golden set — pilot 150, target ~500**, stratified by type × age-band × disagreement (Section 4, Tier 2). Prioritize lenient-rated mature titles and high type/band gaps (MANGA, TV).
4. **Export the silver training table** (features + `expertAgeRec` + metrics + `enrichmentSource`/confidence weights) for offline experimentation. Read-only.
5. **Train B-v1 baseline:** ordinal age model on structured features + synopsis embedding; PEGI as label for games; official rating as floor feature; apply the age-floor rule as a hard post-step. Validate against the golden set; report MAE / within-1-band accuracy and where silver labels diverge from gold.
6. **Instrument B-v2 readiness:** confirm the age-vote consensus query (≥5 / 70%) and start surfacing the vote CTA more aggressively so the community label set can grow toward the B-v2 retarget.

---

*Counts captured 2026-06-18 from production via Prisma count/groupBy (temp script removed). Re-run before any modeling sprint, as the catalog grows daily via automated import/enrichment.*
