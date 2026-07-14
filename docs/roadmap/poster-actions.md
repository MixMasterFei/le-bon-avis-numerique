# Poster Actions — quick per-member triage, site-wide

**Status:** v1 shipped behind an admin-only flag (2026-07). Prototype surface: `RedesignCard` (the V2 grid card admins see on `/films`, `/series`, `/jeux`, `/recherche`, `/age/*`, catalogue).
**Owner idea:** Xavier — "let a user mark love / à voir / déjà vu directly on the poster while scrolling, pick *who* per action, without opening the fiche."

---

## Why this matters (the strategic case)

This is the **"log" primitive** that made Letterboxd and Goodreads sticky: mark what you've seen / want to see / love at *scroll speed*. Site-wide, one small component does three things the market study (`docs/marketing/market-study-2026-07.md`) flags as critical, at once:

1. **The signup gate.** A logged-out visitor tapping "à voir" is the *save/favorite* prompt — the single most effective registration driver on record (beat a newsletter form **16×**; Leaky Paywall / Salem Reporter A/B). *(Anonymous → signup is a later increment; see Roadmap.)*
2. **The flywheel starter.** Per-member reactions harvested at browse speed attack the study's worst number (48 reactions all-time). Each reaction feeds `recomputeMemberVector` → better picks → visible improvement → retention.
3. **Habit texture.** Speed + a sense of accomplishment is what makes a product feel alive.

The moat isn't the component — it's the **per-child data** it accumulates, which no answer box can replicate.

---

## Data model

Reactions are **one-per-member-per-title** (`MediaReaction` unique `[familyMemberId, mediaId]`). So the three actions are a per-member **state machine**, not three independent flags:

| Action | `ReactionType` | Meaning | Vector weight |
|---|---|---|---|
| À voir | `WANTS_TO_WATCH` *(new)* | pre-watch declared interest | +0.75 |
| Déjà vu | `WATCHED` | neutral completion | +0.5 |
| Adoré | `LOVED` | positive post-watch | +2.0 |

`WANTS_TO_WATCH` added to the enum (`sql/add_wants_to_watch_reaction.sql`, `ALTER TYPE`), the API allow-list (`/api/user/reaction`), and `REACTION_WEIGHTS` (`src/lib/preference-vector/index.ts`). Setting one state replaces the member's prior state (want → watched → adoré), which the unique constraint enforces for free.

> Note: the existing household-level `Favorite` / `Watchlist` (user-scoped) are untouched. Poster actions deliberately write **per-member reactions** — that's the taste signal. Reconciling the two lists (e.g. "family favoris" as a derived view) is a later decision.

---

## The core UX rule: never let "who" block the one tap

Speed is the whole value. So:

- **1 member** → one tap = done (no picker).
- **≥2 members** → tap an action reveals a member multi-select *under the poster*; tapping a chip writes that member's reaction immediately (optimistic). "Toute la famille" quick-apply is a planned addition.
- Actions sit at the poster bottom, **subtle at rest, brighten on card hover** (desktop) and **always visible on touch** (mobile — no hover). Buttons `stopPropagation` so they never trigger card navigation. Filled state + a count badge show current per-member states.

---

## Architecture

- `src/lib/poster-actions-flag.ts` — `posterActionsEnabled(isAdmin)`: admin OR `NEXT_PUBLIC_POSTER_ACTIONS==="true"`.
- `src/hooks/useFamilyMembers.ts` — module-cached fetch so a whole grid shares **one** `/api/user/family` call.
- `src/components/media/PosterActionBar.tsx` — the shared overlay (renders null when disabled). Drop `<PosterActionBar mediaId={id} />` into any card's poster div.

---

## v1 limitations (deliberate — validate the feel first)

- **No preload of existing state.** A grid card starts blank even if the admin reacted before (avoids N fetches). → **Next:** a batch endpoint (`POST /api/user/reactions/batch` with visible media ids) to hydrate initial state.
- **Logged-out users** see nothing yet. → **Next:** show the bar to anonymous users; tap → signup gate (the 16× hook, the study's #1 acquisition lever).
- **One card only** (`RedesignCard`). → **Next:** drop into `ApercuMediaCard` (public grids) + `MediaCard` once the interaction is validated.
- **No "acting as member" session switcher** (Netflix "who's watching") — would make multi-member one-tap even faster. Candidate v2.

---

## Rollout

1. **v1 (done):** admin-only, RedesignCard, optimistic, no preload.
2. Batch-preload initial reaction state.
3. Anonymous → signup gate (turns the bar into the acquisition funnel).
4. Roll to ApercuMediaCard + MediaCard.
5. Flip `NEXT_PUBLIC_POSTER_ACTIONS` on for everyone; instrument reactions/session as the flywheel KPI.
