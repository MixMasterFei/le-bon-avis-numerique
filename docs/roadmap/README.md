# Roadmap - Totem Avisé

## Current Phase: Marketing & Growth — Site live, repositioning for visibility

---

## Phases Overview

| Phase | Name | Status | Description |
|---|---|---|---|
| 0 | Foundation & Tech Debt | **Complete** | Fix critical gaps identified in the tech audit |
| 1 | UX/UI Redesign | **Nearly Complete** | Full user experience and interface overhaul |
| A | Go-Live Blockers | **Next** | Domain, auth, legal, env vars — required before sharing URL |
| B | SEO & Social Sharing | Planned | JSON-LD, OG metadata, search console — highest ROI code work |
| C | Analytics & Monitoring | Planned | Plausible, Search Console, uptime monitoring |
| D | Social & Marketing Launch | **In Progress** | Repositioning, social accounts, press, community outreach |
| E | Growth Features | Planned | Newsletter, sharing, onboarding, content |
| F | Technical Debt | Ongoing | Sentry, Zod, tests, CNC import |

---

## Phase Details

### [Phase 0 - Foundation & Tech Debt](phase-0-foundation.md)
All P0 and P1 items completed. Remaining P2/P3 items tracked in `docs/tech-audit.md`.

### [Phase 1 - UX/UI Redesign](phase-1-ux-redesign.md)
Nearly complete. All critical fixes done. Remaining items: related content, search improvements, onboarding, typography.

### [Deployment Roadmap](deployment-roadmap.md)
Full deployment plan from domain purchase to growth. 6 phases (A-F), prioritized and estimated.

---

## Recent Completed Work (March 2026)

### Mar 4 — Marketing Repositioning & Copy Rewrite
- **Full repositioning**: "review/analysis site" → "personalized family media recommendation engine"
- **Pages rewritten**: `/a-propos`, `/nos-valeurs`, `/objectif` — all copy shifted from evaluation to discovery language
- **Homepage**: TrustBanner copy + CTAs updated to recommendation-first messaging
- **Footer**: Added Instagram, TikTok, Facebook social icons; updated tagline and nav links
- **SEO**: Layout metadata (title, description, keywords, OG) updated; Organization JSON-LD added
- **Structured data**: Organization schema with social links and contact info
- See [Marketing Repositioning (March 2026)](marketing-reposition-march2026.md) for full details

## Earlier Completed Work (Feb 2026)

### Feb 27 (latest) — Chez Vous → Profile Merge
- **Unified Profile page**: Merged `/chez-vous` dashboard into `/profil` — one page for everything
- **Ported sections**: FamilyRecommendationsSection, FamilyMovieNightSection, UserListsPreview now render on Profile page
- **Redirect**: `/chez-vous` now redirects to `/profil` (bookmarks preserved)
- **Auth redirects**: Login, signup, Google OAuth all redirect to `/profil`
- **Nav cleanup**: Removed duplicate "Chez vous" entry from header/footer, unified to "Mon profil"
- **Deleted**: WelcomeHeader component (redundant with Profile stats grid)
- **Fixed**: Broken `/profil/famille` links in recommendation components
- **French accents**: Fixed 30+ missing accents in MemberCorner, CompletionMeter, InterestsEditor, MediaSearchAdd

### Feb 26 — Family Personalization & Smart Recommendations
- **Member Corner** (`/profil/membres/[memberId]`): Dedicated per-member page with tabbed layout (Overview / Favorites / Preferences), profile completion meter, interests editor, media search to add favorites
- **Preference Quiz** (`/profil/quiz/[memberId]`): 7-step interactive wizard for genres, sensitivity, positive content, topics to avoid
- **Watch History Affinity**: Family-fit API uses MediaReaction + MediaSimilarity for personalized connection insights
- **FamilyFitCard**: Shows affinity insights + quiz prompts for members without preferences
- **Schema**: Added `interests String[]` to FamilyMember (SQL migration: `sql/add_interests_column.sql`)
- **Sort fix**: Removed confusing "Récents" sort, default to release date, exclude future-dated media from all APIs
- **Profile Completion Meter**: 8 criteria totaling 100% — encourages richer member profiles

### Feb 21 — Media Detail Page UX Overhaul
- Consolidated duplicate action buttons (favorite/watchlist/review) into single `MediaPageClient`
- Hidden "0.0/5" empty rating — shows "Aucun avis pour le moment" CTA instead
- Login redirects now preserve context via `callbackUrl` parameter
- Replaced `window.location.reload()` with `router.refresh()` (no scroll loss)
- Made review edit/delete buttons discoverable (inline instead of hidden dropdown)
- Removed TMDB rating leaks from MediaCard (internal-only data no longer shown to users)
- Fixed typo "Ma Liste a Voir" → "Ma Liste à Voir"
- Unified grid layouts for favorites & watchlist pages
- Auth-aware CTA on à propos page (different messaging for logged-in vs logged-out)
- Removed non-existent categories (Livres, Applications) from à propos "Ce que nous couvrons"
- Deleted unused `UserInteractionBar.tsx`

### Feb 21 — UX Audit & Footer Redesign
- Full UX audit: 3 research agents analyzed 18 pages, all components, 3 competitor sites
- Identified 5 critical bugs, 20+ issues, 22 prioritized recommendations
- Footer redesigned: clean 5-column layout, real links only, no fake data sources
- Expert picks scoring: surfaces recognizable family titles (Kung Fu Panda, Wonka, Paddington)
- Bright hero banner overlay (white transparency)
- Uniform media card heights
- Navigation redesign, collections poster collages, performance optimization
- SEO files (robots.ts, sitemap.ts), Vercel Analytics integration

### Feb 15 — Site Audit & Polish Pass
- Contact form connected to real Resend API (was fake setTimeout)
- Auth pages (inscription/connexion) color palette aligned: green → emerald/teal
- Placeholder pages replaced with real content: /objectif, /a-propos, /guides
- Dual age rating UX improved: "Classif. officielle" / "Recommandation experts" labels
- Homepage hero banner illustration added

### Earlier
- Weekly homepage content rotation (seeded shuffle, changes every Monday)
- TMDB ratings integration for quality-based content selection
- Family dashboard fixes (stats, recommendations diversity, missing members)
- Content tag threshold tuning (Educatif, Modeles+)
- GitHub Actions automation (import, AI enrichment, quality, streaming, similarity)
- Cron job activity logging in admin dashboard
- FilterSidebar on Films page
- 18+ content blur fix with toggle (click eye icon to reveal)
- Fix Chez Vous crash (React Hooks order violation)
- Remove redundant category buttons and "Pour votre enfant" from navigation
- ExpertPicks cascading fallback queries (always shows content)
- French/English language filter on all homepage sections
- Streaming section stale data indicator (amber warning after 7 days)
- /nos-valeurs page rewritten for broader family audience (not just children)
- Plus dropdown z-index fix (no longer goes behind hero search)

---

## Deployment Critical Path

```
Week 0:  Phase A (go-live blockers)      → Site is live on custom domain
Week 1:  Phase B (SEO) + C (analytics)   → Google starts indexing
Week 2:  Phase D (marketing launch)      → First users arrive
Month 1: Phase E (growth features)       → Retention & sharing loops
Ongoing: Phase F (tech debt)             → Stability & maintainability
```

### Budget at Launch: ~$11/month
| Item | Cost |
|------|------|
| Domain (.com + .fr) | ~20 EUR/year |
| Plausible analytics | $9/month |
| Brevo newsletter | Free (300/day) |
| Vercel hosting | Free tier |
| Resend email | Free tier (3000/month) |

See [Deployment Roadmap](deployment-roadmap.md) for the complete plan with every task.

---

## Official CSA Rating System

The site currently labels most movies "Tous publics" because TMDB lacks French CSA data for most films. Unknown defaults to "Tous publics", which is misleading.

**Source:** The CNC (Centre national du cinéma) publishes the official French visa/classification database as open data on data.gouv.fr — 95,000+ records, open license.

See **[Official Ratings Plan](official-ratings.md)** for full implementation details.

| Step | What | Impact |
|------|------|--------|
| 1 | Stop defaulting unknown → "Tous publics" | Unknown shows "Non classé" instead of false TP |
| 2 | CNC open data import (95K+ films) | Bulk-fill correct official classifications |
| 3 | TMDB re-fetch for remaining items | Catch items CNC doesn't cover (TV, recent films) |

---

## How to Use This Roadmap

1. Check this README for the current phase and deployment critical path
2. Open [deployment-roadmap.md](deployment-roadmap.md) for the full launch plan
3. Open [phase-1-ux-redesign.md](phase-1-ux-redesign.md) for remaining UX tasks
4. Reference docs: [UX Audit](../ux-audit-feb21.md), [Competitor Analysis](../competitor-analysis.md), [Tech Audit](../tech-audit.md)
5. Marketing docs: [Marketing Playbook](../marketing/claude_mkt.md), [Launch Checklist](../marketing/launch-checklist.md), [Market Analysis](../marketing/market-analysis.md)
6. Repositioning: [Marketing Repositioning (March 2026)](marketing-reposition-march2026.md)
6. CLAUDE.md references this roadmap — the AI assistant checks it before starting work
