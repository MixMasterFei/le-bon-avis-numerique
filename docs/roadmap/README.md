# Roadmap - Le Bon Sens Numerique

## Current Phase: Phase 1 - UX/UI Redesign (+ ongoing automation)

---

## Phases Overview

| Phase | Name | Status | Description |
|---|---|---|---|
| 0 | Foundation & Tech Debt | **Complete** | Fix critical gaps identified in the tech audit |
| 1 | UX/UI Redesign | **In Progress** | Full user experience and interface overhaul |
| 2 | Content & Features | Planned | Expand content, recommendations, community features |
| 3 | Growth & Scale | Planned | Performance, SEO, analytics, marketing pages |

---

## Phase Details

### [Phase 0 - Foundation & Tech Debt](phase-0-foundation.md)
All P0 and P1 items completed. Remaining P2/P3 items tracked in `docs/tech-audit.md`.

### [Phase 1 - UX/UI Redesign](phase-1-ux-redesign.md)
Visual and interaction overhaul in progress. Homepage rotation, quality selection, and dashboard fixes completed.

---

## Recent Completed Work (Feb 2026)

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

## Next Steps: Official CSA Rating System

The site currently labels most movies "Tous publics" because TMDB lacks French CSA data for most films. Unknown defaults to "Tous publics", which is misleading for a platform dedicated to accurate ratings.

**Source:** The CNC (Centre national du cinéma) publishes the official French visa/classification database as open data on data.gouv.fr — 95,000+ records, open license.

See **[Official Ratings Plan](official-ratings.md)** for full implementation details.

| Step | What | Impact |
|------|------|--------|
| 1 | Stop defaulting unknown → "Tous publics" | Unknown shows "Non classé" instead of false TP |
| 2 | CNC open data import (95K+ films) | Bulk-fill correct official classifications |
| 3 | TMDB re-fetch for remaining items | Catch items CNC doesn't cover (TV, recent films) |

---

## How to Use This Roadmap

1. Check this README for the current phase
2. Open the current phase doc for specific tasks and status
3. Each task has a checkbox - mark as done when complete
4. CLAUDE.md references this roadmap - the AI assistant checks it before starting work
