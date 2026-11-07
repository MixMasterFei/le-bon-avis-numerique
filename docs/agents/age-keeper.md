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
