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
- Released today: TP verdict on the classic fiche, Parents / Enfants bubbles ignore reviews
  without an age, « TP » badge on similar titles, dead `ReviewCard.tsx` removed.
- In progress (cloud session « Route remaining age badges through age-label », branch
  `claude/peaceful-edison-wkebcc`): HeroSearch and homepage cards. Rebase on `main` first —
  the fixes above are now live.
