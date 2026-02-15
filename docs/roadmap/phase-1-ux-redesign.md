# Phase 1 - UX/UI Redesign

**Status:** In Progress
**Goal:** Complete visual and interaction overhaul of the platform.

---

## Completed

### Homepage
- [x] Weekly content rotation (seeded shuffle — changes every Monday)
- [x] Featured content selection using TMDB audience ratings (not data completeness)
- [x] ExpertPicks, FeaturedMovies, StreamingSection rotate weekly
- [x] NewArrivals stays recency-based (intentional)
- [x] Content tag tuning (Educatif/Modeles+ thresholds raised to avoid false positives)

### Content Pages
- [x] FilterSidebar on `/films` page
- [x] 18+ content blur fix (violence >= 5 trigger)
- [x] Blur toggle: click eye icon to reveal content without navigating away
- [x] French/English language filter on all homepage sections (no more Japanese titles)
- [x] /nos-valeurs page rewritten for broader family audience

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

---

## Remaining (To Be Scoped)

### Homepage
- [x] Remove redundant category buttons (Films/Series/Jeux/Livres/Apps)
- [x] ExpertPicks cascading fallback queries (never shows empty section)
- [x] Streaming section stale data indicator (amber warning >7 days)
- [x] Plus dropdown z-index fix (header always above hero content)

### Navigation & Layout
- [x] Remove "Pour votre enfant" from top nav (redundant with Chez Vous)
- [ ] Header/navigation redesign
- [ ] Mobile navigation experience
- [ ] Footer redesign
- [ ] Page layout consistency

### Content Pages
- [ ] Media listing pages (`/jeux`, `/series`, `/livres`) — FilterSidebar parity with `/films`
- [ ] Media detail page redesign (`/media/[id]`)
- [ ] Search & filter experience improvements

### User Features
- [ ] Profile page redesign
- [ ] Family management UX
- [ ] Favorites & watchlist UX
- [ ] Review experience

### Site Audit & Polish (Feb 15)
- [x] Contact form connected to real Resend API (was fake setTimeout)
- [x] Auth pages (inscription/connexion) color palette aligned: green → emerald/teal
- [x] Placeholder pages replaced with real content: /objectif, /a-propos, /guides
- [x] Dual age rating UX improved: "Classif. officielle" / "Recommandation experts" labels
- [x] Homepage hero banner illustration added

### Visual Identity
- [x] Color palette refinement — auth pages aligned to emerald/teal palette
- [ ] Typography
- [ ] Component design system
- [ ] Empty states and illustrations

### Performance
- [ ] Media detail page loading optimization (TMDB response caching, Suspense boundaries)

### Future Features (from feedback)
- [ ] Theater movies section (currently in French cinemas via Pathe + TMDB)

---

## Notes

Design direction to be defined by owner for remaining items. Current work focused on making existing features work well before visual overhaul.
