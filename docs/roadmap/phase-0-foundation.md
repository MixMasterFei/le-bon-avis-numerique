# Phase 0 - Foundation & Tech Debt

**Status:** Complete
**Goal:** Fix critical technical gaps before starting the UX/UI redesign.
**Reference:** See `docs/tech-audit.md` for full audit details.

---

## P0 - Critical (Done)

- [x] Add `error.tsx` at app root for graceful error handling
- [x] Add `not-found.tsx` at app root for custom 404 page
- [x] Add environment variable validation at startup (`src/instrumentation.ts`)

## P1 - Important (Done)

- [x] Set up Vitest + React Testing Library (basic test infrastructure)
- [x] Add GitHub Actions workflow (lint + type-check + build on PRs)
- [x] Rate limiting: kept in-memory (Upstash removed — sufficient for serverless scale)
- [x] Add `loading.tsx` to main routes (`/films`, `/jeux`, `/series`, `/livres`, `/media/[id]`)

## P2 - Recommended (Remaining — tracked in tech-audit.md)

- [ ] Add Sentry error tracking
- [ ] Add Vercel Analytics for performance monitoring
- [ ] Resolve topics table schema conflict (blocks `prisma db push`)
- [ ] Add Zod schema validation on API request bodies
- [ ] Clean up `src/lib/mock-data.ts` if no longer needed

## P3 - Nice to Have (Remaining — tracked in tech-audit.md)

- [ ] Upgrade Prisma from 5.22 to v7
- [ ] Add E2E tests with Playwright
- [ ] Add database seeding script for dev environment

---

## Completion Criteria

Phase 0 is complete. All P0 and P1 items done. P2/P3 items carry into later phases.
