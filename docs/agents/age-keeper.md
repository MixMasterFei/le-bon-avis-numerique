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

## Open work (2026-11-06)
- Released (#107): TP verdict on the classic fiche, Parents / Enfants bubbles ignore reviews
  without an age, « TP » badge on similar titles, dead `ReviewCard.tsx` removed.
- Ready, no PR yet (branch `claude/peaceful-edison-wkebcc`, `main` merged in): every card,
  rail, chip and admin view that wrote an age by hand now goes through `src/lib/age-label.ts`
  — homepage V2 / redesign, profile recommendations, hero search, Découverte articles, the
  Recherche magique board and ballot, the Totem chat card, collections, `/jeux/quel-age`,
  game guides, the V3 family panel, the game PEGI panel, admin. New `ageInlineLabel` for
  mid-sentence use (« pour tous publics » / « dès 10 ans »).
- Waiting for Xavier's wording: the shared text builders still treat 0 as « âge à confirmer »
  — `buildQuickAnswer` (fiche FAQ JSON-LD, `/jeux/quel-age`, `/md`), `media-md`,
  `selection-md`, `mcp/totem-tools`, the `/md/jeux/quel-age` route, `fiche-title`, the OG
  image, the fiche meta description, `seo-autofix`. Crosses Agentic Master (md / MCP) and
  Growth Scout (titles, OG); `seo-autofix` is a cron file. Once fixed, drop the 0 special
  case in `HeroMatch`'s pill.
- Dead code: `src/components/home/FamilyRecommendations.tsx` has no importer (fixed anyway,
  can be deleted).
