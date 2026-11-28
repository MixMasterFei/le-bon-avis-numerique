# 🧒 Age Keeper

**Mission.** Everything a parent reads about a title: the age verdict, how it is shown, and
how well it fits each child in the family.

## Owns
- Age display: `src/lib/age-label.ts` (0 = « TP »), badges on every card and rail,
  provisional ages (`ProvisionalBadge`)
- Blur rules: `src/lib/should-blur-media.ts`
- Family fit: `src/lib/family-fit-score.ts`, `src/app/api/media/[id]/family-fit/`,
  `src/components/media/FamilyFitCard.tsx`
- Fiches: `src/app/media/[id]/`, `src/components/media/`, `src/components/media-v3/`
- Families: profiles, quiz, member corner, reactions, age votes, recommendations UI
  (`src/components/profile/`, `src/components/chez-vous/`)

## Not yours
- How ages are *computed* at import (`import-helpers.ts`, age-floor sweep) → Librarian;
  coordinate on any change to what « TP » means.

## Rules
- `expertAgeRec: 0` is a rating (« Tous publics »), never a blank badge.
- A TP certification may never be more permissive than no certification (see `CLAUDE.md`).
- Curated surfaces stay expert-only; provisional titles never lead a family rail.

## Open work (2026-11-28) — enrichment age calibration for gpt-6.1-terra
- Why: gpt-6.1-terra (replacement of gpt-5-mini, shut down 11 Dec 2026) rated stricter than the
  catalogue (12/20 ages identical to stored on the 27 Nov comparison, 6 titles +2 years or more,
  always upward). Root cause: the enrichment prompt never defined what an age means on Totem (no
  bands, no anchor titles), only « relève l'âge si un axe atteint 3 » and « classification =
  indice FAIBLE »; terra filled the gap with its own stricter standard (series judged on their
  worst season, 18 for adult series, PEGI 3 karting at 5, every axis a notch higher).
- Change (`src/lib/enrichment-analysis.ts`, `buildAgeCalibrationBlock`, films / series / games;
  MANGA unchanged): house age bands, catalogue reference titles with their stored age and scores
  (`AGE_REFERENCE_SCREEN`, `AGE_REFERENCE_GAMES`), series judged on their usual level, official
  rating = neither floor nor ceiling, PEGI rules, anchored 0-5 axis scales. Safety floors untouched.
  Tests: `src/lib/__tests__/enrichment-calibration.test.ts` (no reference may be a test-set title).
- Measured with `scripts/compare-text-models.ts` (ages after the floors, vs stored; inputs and
  outputs in the session scratchpad, not in the repo):

  | Set (20 titles) | Model | Identical | ±1 | ±2+ | JSON failures | Mean drift V / S / L / Sub |
  |---|---|---|---|---|---|---|
  | A (tuning) — old prompt | terra | 12 | 2 | 6 | 0 | +0.45 / +0.65 / +0.35 / +0.45 |
  | A — final prompt | terra | 18 | 0 | 2 | 0 | +0.25 / +0.25 / +0.05 / −0.05 |
  | A — final prompt | gpt-5-mini | 19 | 0 | 1 | 0 | +0.05 / −0.05 / −0.15 / −0.05 |
  | B (held out, 2 iterations) | terra | 17 | 2 | 1 | 0 | +0.20 / +0.55 / +0.25 / +0.30 |
  | C (fresh) — old prompt | terra | 8 | 5 | 7 | 0 | +0.25 / +0.85 / +0.10 / +0.65 |
  | C (fresh) — final prompt | terra | 12 | 3 | 5 | 0 | +0.25 / +0.40 / −0.10 / +0.05 |

  Target (≥ 17/20 identical, 0 at ±2+) met on A apart from Harry Potter 2 (8 → 12, the live-action
  violence-3 floor, which also fires with gpt-5-mini — kept on purpose), met on B except Seul sur
  Mars (10 → 12), **not met on C**: terra still puts live-action epics / historical violence one
  band higher (Titanic and La Communauté de l'anneau 12 → 14, Gladiator and Vikings 14 → 16) and
  La Pat' Patrouille : Le Film at 6 (stored 4). gpt-5-mini behaviour is not degraded.
- **Not ready to switch on ages alone.** Next round (Agentic Master / Librarian): anchors for the
  live-action 12 / 14 / 16 boundary and the preschool band, measured on a FRESH set D (A, B, C are
  burnt: `CALIBRATION_HELD_OUT_TITLES`). terra has no temperature control here, so single runs
  move ±1 on borderline titles (Les Simpson, One Piece, Inception went 10/12, 10/12, 12/13).

## Open work (2026-11-07)
- Released: #107 (TP verdict on the classic fiche, Parents / Enfants bubbles, « TP » on similar
  titles) and #108 (every badge, chip and admin view goes through `src/lib/age-label.ts`).
- Ready, no PR yet — branch `claude/age-keeper-f04-f02`:
  - **F04, one known-age contract** (`isKnownAge`): 0 = « Tous publics » in the quick answer,
    « Pourquoi tous publics ? », `/md`, MCP (`age: 0`, never null), age selections (TP
    eligible again), SERP title, meta description, OG card, `typicalAgeRange` and the Totem
    page context. Unknown age → no content claim; estimate → « à confirmer ». End-to-end
    test: `src/lib/__tests__/age-contract.test.ts`.
  - **F02, « Ce qui peut marquer »**: three states (`aiWarningsState`) — « Pas encore de
    données », « Rien de relevé par l'analyse automatique · ce n'est pas une garantie »,
    flags. Root cause and reference set: `docs/reports/eval/warning-recall-baseline.md`.
- Waiting for Xavier: apply `sql/correct_amelie_metaphysique_des_tubes_warnings.sql` (prepared,
  tested on PGlite, NOT applied; re-read the BBFC page verbatim first). Amélie's 8+ is
  unchanged — his call.
- Hand-offs: **Librarian** — the basic enrichment pass stores a confident empty warnings list
  for titles the model can't know (Amélie, 2025, synopsis only); see the recommendations in
  the baseline report. **Agentic Master** — expected one-line conflict in
  `src/lib/mcp/totem-tools.ts` (`searchRowLine`): keep their « · fiche : … », use
  `${ageText(m)}`; one sentence added to `src/lib/totem/site-brief.md` (0 = tous publics).
- Not touched: `seo-autofix` (cron) still skips TP when it writes « Âge conseillé ».
- Dead code: `src/components/home/FamilyRecommendations.tsx` and
  `src/components/media/SimilarMedia.tsx` (no importer).
