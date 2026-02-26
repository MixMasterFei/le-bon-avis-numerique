# Phase 1 - UX/UI Redesign

**Status:** Nearly Complete
**Goal:** Complete visual and interaction overhaul of the platform.
**Audit:** Full UX audit completed Feb 21 — see [ux-audit-feb21.md](../ux-audit-feb21.md) and [competitor-analysis.md](../competitor-analysis.md)

---

## Completed

### Homepage
- [x] Weekly content rotation (seeded shuffle — changes every Monday)
- [x] Featured content selection using TMDB audience ratings (not data completeness)
- [x] ExpertPicks, FeaturedMovies, StreamingSection rotate weekly
- [x] NewArrivals stays recency-based (intentional)
- [x] Content tag tuning (Educatif/Modeles+ thresholds raised to avoid false positives)
- [x] Remove redundant category buttons (Films/Series/Jeux/Livres/Apps)
- [x] ExpertPicks cascading fallback queries (never shows empty section)
- [x] Streaming section stale data indicator (amber warning >7 days)
- [x] Plus dropdown z-index fix (header always above hero content)
- [x] Expert picks scoring algorithm (surfaces recognizable titles like Kung Fu Panda, Wonka)
- [x] Bright hero banner overlay (white transparency instead of dark)
- [x] Uniform card heights across all sections

### Content Pages
- [x] FilterSidebar on `/films` page
- [x] 18+ content blur fix (violence >= 5 trigger)
- [x] Blur toggle: click eye icon to reveal content without navigating away
- [x] French/English language filter on all homepage sections (no more Japanese titles)
- [x] /nos-valeurs page rewritten for broader family audience
- [x] TMDB community ratings shown on media cards (fallback when no user reviews)
- [x] Removed TMDB rating leaks from MediaCard (tmdbRating is internal-only, never shown to users)
- [x] Removed non-existent categories (Livres, Applications) from à propos "Ce que nous couvrons"
- [x] Auth-aware CTA on à propos page (logged-in: "Explorez nos contenus", logged-out: "Rejoignez la communauté")

### Navigation & Layout
- [x] Remove "Pour votre enfant" from top nav (redundant with Chez Vous)
- [x] Footer redesign — clean 5-column layout, real links only, no fake data sources

### Chez Vous (Personalized Hub)
- [x] Fix dashboard stats (property name mismatch)
- [x] Show all family members in recommendation tabs (not just those with reactions)
- [x] Recommendations include all media types (movies + TV + games, not just reacted types)
- [x] Quality filter: only recommend well-known titles (dataQualityScore >= 70)
- [x] Fix React Hooks order violation causing page crashes
- [x] Language filter on recommendations (French/English only)

### Admin Dashboard
- [x] Cron job activity log ("Jobs automatiques" section)
- [x] Per-task summary cards with error rates and last run times

### Automation
- [x] GitHub Actions cron: Mon=import+enrich, Thu=enrich+quality, Sat=ratings+streaming+similarity
- [x] ~120 items enriched per week via OpenAI
- [x] All automated routes log to cron_logs table

### Site Audit & Polish (Feb 15)
- [x] Contact form connected to real Resend API (was fake setTimeout)
- [x] Auth pages (inscription/connexion) color palette aligned: green → emerald/teal
- [x] Placeholder pages replaced with real content: /objectif, /a-propos, /guides
- [x] Dual age rating UX improved: "Classif. officielle" / "Recommandation experts" labels
- [x] Homepage hero banner illustration added

### Visual Identity
- [x] Color palette refinement — auth pages aligned to emerald/teal palette

---

## Next: Critical Fixes (from Feb 21 audit)

### P0 — Bugs & broken things (ALL COMPLETED Feb 21)
- [x] Fix brand identity split: unified to "Totem Avisé" (TA) across all pages
- [x] Fix broken `/chez-vous` redirect (`/auth/signin` → `/connexion`)
- [x] Fix dead link to `/conditions` on signup page (now links to `/mentions-legales`)
- [x] Remove admin checkbox from public login page
- [x] Fix collections empty state (user-friendly message instead of admin link)
- [x] Fix series page filter dependencies (useEffect now includes searchQuery/platforms/topics)

### P1 — French accent pass (ALL COMPLETED Feb 21)
- [x] Fix missing accents in Series page
- [x] Fix missing accents in Age page
- [x] Fix missing accents in TrustBanner
- [x] Fix missing accents in Inscription page
- [x] Fix missing accents in Connexion page
- [x] Fix missing accents in Profil page
- [x] Fix missing accents in Collections page
- [x] Fix missing accents in MediaCard (FamilyGauge labels, content tags)
- [x] Fix missing accents in Header (Déconnexion)
- [x] Fix missing accents in FilterSidebar (préférences, sélectionner)
- [x] Fix missing accents in CookieConsent (confidentialité)
- [x] Fix missing accents in CuratedCollections (découvertes, expéditions)
- [x] Fix missing accents in layout.tsx metadata (séries, médias, françaises, etc.)
- [x] Fix missing accents in FamilyMembers (paramètres)
- [x] Fix missing accents in MemberPreferencesModal (sélectionné, enregistré)
- [x] Fix missing accents in FamilyMovieNightSection (sélectionnez)
- [x] Fix missing accents in TalkToYourKids, UserMetricsModal (modèles)

### P1.5 — Developer cleanup (ALL COMPLETED Feb 21)
- [x] Remove "Base locale" badges from all user-facing pages (Films, Series, Jeux, Search, Age, Films/recherche)
- [x] Standardize ITEMS_PER_PAGE across listing pages (24 everywhere: was 12 for series/jeux, 20 for age, 35 for films/recherche)
- [x] Post-login redirect to `/chez-vous` instead of homepage (connexion, inscription, NextAuth callback)

### P2 — Navigation redesign (ALL COMPLETED Feb 21)
- [x] Add Livres to header primary nav
- [x] Move BD from primary nav to "Plus" dropdown (coming soon)
- [x] Add age-based browsing to header ("Par âge" dropdown with 6 age ranges)
- [x] Add Collections to header navigation (moved to "Plus" menu)
- [x] Remove "coming soon" label from Guides (now active link)
- [x] Add favorites/watchlist/family settings to logged-in user dropdown (Mes favoris, Ma liste, Ma famille)
- [x] Mobile navigation improvements (age grid, user links in mobile menu)

### P3 — Remaining cleanup (ALL COMPLETED Feb 21)
- [x] Fix HeroSearch popular links (now route to /age/5-7 and /recherche?q=...)
- [x] Add all auth-required routes to middleware protection (`/ma-liste`, `/mes-favoris`, `/chez-vous`)
- [x] Standardize grid columns across listing pages (already consistent by card variant)

---

## Remaining (from original scope)

### Content Pages
- [x] Media listing pages (`/jeux`, `/series`, `/livres`) — FilterSidebar parity with `/films` (all filter params forwarded to API)
- [x] Streaming availability: DB-first lookup with TMDB fallback + 5s timeout on detail pages
- [x] Media detail page UX overhaul — consolidated actions, hide empty rating, callbackUrl, router.refresh
- [x] Hide rating section when 0 reviews (shows "Aucun avis pour le moment" CTA instead of 0.0/5)
- [ ] Related content for DB items on detail page (currently only works for mock data)
- [ ] Search & filter experience improvements

### User Features
- [x] Favorites & watchlist UX (standardized grid layouts: `grid-cols-2 sm:3 md:4 lg:5 xl:6`)
- [x] Review experience — consolidated review button in hero, inline edit/delete, router.refresh
- [x] Login redirects preserve context via `callbackUrl` parameter (MediaActions, FamilyReactions, ReviewCard)
- [x] Fixed typo "Ma Liste a Voir" → "Ma Liste à Voir"
- [x] Deleted unused `UserInteractionBar.tsx`
- [x] **Family personalization system** — Member Corner (`/profil/membres/[id]`), Preference Quiz (`/profil/quiz/[id]`), watch history affinity scoring, profile completion meter, interests editor, media search favorites
- [x] **Family fit scoring** — Weighted formula (age 40%, sensitivity 35%, genre 10%, avoid 5%, affinity 10%) with personal connection insights from MediaSimilarity
- [x] **Sort & filter fixes** — Simplified sort (release date default), excluded future-dated media from all APIs
- [x] **Chez Vous → Profile merge** — Unified `/chez-vous` and `/profil` into single page with recommendations, family members, movie night, lists preview, and account settings
- [ ] New user onboarding flow (prompt to set up family, select platforms)
- [ ] Propagate user image through JWT (emoji avatars don't show in header)

### Visual Identity
- [ ] Typography consistency
- [ ] Component design system
- [ ] Empty states and illustrations

### Performance
- [x] Media detail page: ISR caching (revalidate=3600) replaces force-dynamic
- [x] Media detail page: TMDB provider fetch with 5s timeout to prevent slow loads
- [x] Recommendations: reduced to 100 items + client-side "Voir plus" pagination (24 per page)

### Future Features
- [ ] Theater movies section (currently in French cinemas via Pathé + TMDB)
- [ ] "En parler avec vos enfants" section on detail pages (inspired by CSM)
- [ ] Editorial one-liner on media cards (inspired by CSM)
- [ ] Streaming availability on detail pages with branded platform icons (inspired by Allocine)

---

## Reference Documents

- [UX Audit — Feb 21, 2026](../ux-audit-feb21.md) — Full findings with 20 issues
- [Competitor Analysis](../competitor-analysis.md) — CSM, Allocine, Filmages comparison
- [Tech Audit](../tech-audit.md) — Original technical audit (Phase 0)
