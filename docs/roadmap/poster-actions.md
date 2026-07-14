# Poster Actions — quick per-member triage, site-wide

**Status:** PUBLIC for all logged-in users since 2026-07 (validated admin-only first). Surface: `RedesignCard` (the V2 grid card used on the homepage rails, `/films`, `/series`, `/jeux`, `/recherche`, `/age/*`, catalogue). Kill-switch: `NEXT_PUBLIC_POSTER_ACTIONS="false"`. Logged-out visitors still see nothing — the anonymous→signup gate is the next increment.
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
| Déjà vu | `WATCHED` | neutral completion — **also the dedup signal** (picks engine excludes watched titles) | +0.5 |
| Adoré | `LOVED` | positive post-watch | +2.0 |
| Pas pour nous | `NOT_FOR_ME` | dislike / not for the family | **−2.0** |

The negative is deliberate: it's the strongest filtering signal *and* the one a positive-only fast lane would never capture — without it the taste vector built at scroll speed skews positive and loses discriminative power. The picker also carries a **"Toute la famille"** one-tap apply/clear-for-everyone.

`WANTS_TO_WATCH` added to the enum (`sql/add_wants_to_watch_reaction.sql`, `ALTER TYPE`), the API allow-list (`/api/user/reaction`), and `REACTION_WEIGHTS` (`src/lib/preference-vector/index.ts`). Setting one state replaces the member's prior state (want → watched → adoré), which the unique constraint enforces for free.

> Note: the existing household-level `Favorite` / `Watchlist` (user-scoped) are untouched. Poster actions deliberately write **per-member reactions** — that's the taste signal. Reconciling the two lists (e.g. "family favoris" as a derived view) is a later decision.

---

## The core UX rule: never let "who" block the one tap

Speed is the whole value. So:

- **1 member** → one tap = done (no picker).
- **≥2 members** → tap an action opens a **bottom sheet** (portaled to `<body>`, so the poster's `overflow-hidden` can't clip it — the large-family bug); it lists "Toute la famille" + each member in a scrollable list, tapping a row writes that member's reaction immediately (optimistic). Locks background scroll and closes on backdrop tap / Escape.
- Actions sit at the poster bottom, **subtle at rest, brighten on card hover** (desktop) and **always visible on touch** (mobile — no hover). Buttons `stopPropagation` so they never trigger card navigation. Filled state + a count badge show current per-member states.

---

## Architecture

- `src/lib/poster-actions-flag.ts` — `posterActionsEnabled(isAdmin)`: admin OR `NEXT_PUBLIC_POSTER_ACTIONS==="true"`.
- `src/hooks/useFamilyMembers.ts` — module-cached fetch so a whole grid shares **one** `/api/user/family` call.
- `src/components/media/PosterActionBar.tsx` — the shared overlay (renders null when disabled). Drop `<PosterActionBar mediaId={id} />` into any card's poster div.

---

## Data integrity (the pipe)

- **One vocabulary, tested:** `src/lib/reaction-types.ts` is the single source of truth (VALID_REACTIONS + FR labels). Sync tests (`src/lib/__tests__/reaction-types.test.ts`) prove the Prisma enum, the API allow-list, `REACTION_WEIGHTS` and the UI writers (PosterActionBar, FamilyReactions) can't drift.
- **One door:** every surface writes through `/api/user/reaction` (deep handler tests in `src/app/api/user/reaction/__tests__/route.test.ts` — auth, cross-account ownership gates, allow-list, upsert state machine, note sanitization, vector recompute). The preload endpoint has its own tests.
- **Parent oversight:** the Member Corner "Historique" tab shows every reaction with its date and per-type label; the badge on each title opens a correction menu (switch to any other reaction, or remove). Wrong taps are fixable in two taps.

## State (post-launch)

- **Preload:** ✅ `GET /api/user/reactions/all` returns the user's whole (sparse) reaction set in one query, shared across the grid via `useUserReactions` — a title already marked shows its state on load. A late preload never clobbers a fresh optimistic write (`touched` ref).
- **Anonymous signup gate:** ✅ Logged-out visitors now see the bar too; tapping any action opens a benefit-led signup prompt (`SIGNUP_COPY` per action) with **S'inscrire** / **Se connecter** (`?callbackUrl=` back to the page). Content stays fully visible — only the *save* asks for an account (Google-blessed save-gate). This is the acquisition-funnel piece the study rates #1 (save-hook = 16× a newsletter). → **Next:** replay the intended action after signup (stash media+action, apply once a member exists).
- **One card** (`RedesignCard`, which covers the homepage + all V2 grids). → **Next:** drop into `ApercuMediaCard` (classic grids) + `MediaCard` if any surface still renders them for logged-in users.
- **Mobile collapse:** ✅ on small screens (<sm) the 4-button row collapses behind a single "+" toggle that expands the options (fits narrow phone posters); tablets/desktop keep the inline row. Enables covering the tiny Coin Famille cards next.
- **No "acting as member" session switcher** (Netflix "who's watching") — would make multi-member one-tap even faster. Candidate next.

---

## Rollout

1. **v1 (done):** admin-only, RedesignCard, optimistic, no preload.
2. Batch-preload initial reaction state.
3. Anonymous → signup gate (turns the bar into the acquisition funnel).
4. Roll to ApercuMediaCard + MediaCard.
5. Flip `NEXT_PUBLIC_POSTER_ACTIONS` on for everyone; instrument reactions/session as the flywheel KPI.
