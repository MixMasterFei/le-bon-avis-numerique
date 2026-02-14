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

### Chez Vous (Personalized Hub)
- [x] Fix dashboard stats (property name mismatch)
- [x] Show all family members in recommendation tabs (not just those with reactions)
- [x] Recommendations include all media types (movies + TV + games, not just reacted types)
- [x] Quality filter: only recommend well-known titles (dataQualityScore >= 70)

### Admin Dashboard
- [x] Cron job activity log ("Jobs automatiques" section)
- [x] Per-task summary cards with error rates and last run times

### Automation
- [x] GitHub Actions cron: Mon=import+enrich, Thu=enrich+quality, Sat=ratings+streaming+similarity
- [x] ~120 items enriched per week via OpenAI
- [x] All automated routes log to cron_logs table

---

## Remaining (To Be Scoped)

### Navigation & Layout
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

### Visual Identity
- [ ] Color palette refinement (violet dominance reduced, but more work needed)
- [ ] Typography
- [ ] Component design system
- [ ] Empty states and illustrations

---

## Notes

Design direction to be defined by owner for remaining items. Current work focused on making existing features work well before visual overhaul.
