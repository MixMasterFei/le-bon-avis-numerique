# Phase 1 - UX/UI Redesign

**Status:** In Progress
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
- [x] Fix brand identity split: unified to "Le Bon Avis Numérique" (BA) across all pages
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

### P2 — Navigation redesign (Step 2 — planned)
- [ ] Add Livres to header primary nav
- [ ] Move BD from primary nav to "Plus" dropdown (coming soon)
- [ ] Add age-based browsing to header (key differentiator — CSM puts it front and center)
- [ ] Add Collections to header navigation
- [ ] Remove "coming soon" label from Guides (3 of 5 guides are live)
- [ ] Add favorites/watchlist/family settings to logged-in user dropdown
- [ ] Mobile navigation improvements (animation, collapsible search, aria labels)

### P3 — Remaining cleanup
- [ ] Fix HeroSearch popular links (point to wrong routes)
- [ ] Add all auth-required routes to middleware protection (`/ma-liste`, `/mes-favoris`, `/chez-vous`)
- [ ] Standardize grid columns across listing pages

---

## Remaining (from original scope)

### Content Pages
- [ ] Media listing pages (`/jeux`, `/series`, `/livres`) — FilterSidebar parity with `/films`
- [ ] Media detail page redesign (`/media/[id]`)
- [ ] Related content for DB items on detail page (currently only works for mock data)
- [ ] Search & filter experience improvements
- [ ] Hide rating section when 0 reviews (show "Pas encore d'avis" instead of 0.0/5)

### User Features
- [ ] New user onboarding flow (prompt to set up family, select platforms)
- [ ] Profile page redesign (use `<Image>` instead of raw `<img>`, add link to family settings)
- [ ] Family management UX
- [ ] Favorites & watchlist UX (standardize grid layouts between the two)
- [ ] Review experience
- [ ] Propagate user image through JWT (emoji avatars don't show in header)

### Visual Identity
- [ ] Typography consistency
- [ ] Component design system
- [ ] Empty states and illustrations

### Performance
- [ ] Media detail page loading optimization (TMDB response caching, Suspense boundaries)
- [ ] Recommendations: add pagination instead of fetching 200 items at once

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
