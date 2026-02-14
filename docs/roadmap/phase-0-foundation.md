# Phase 0 - Foundation & Tech Debt

**Status:** Complete
**Goal:** Fix critical technical gaps before starting the UX/UI redesign.
**Reference:** See `docs/tech-audit.md` for full audit details.

---

## P0 - Critical (Do First)

- [x] Add `error.tsx` at app root for graceful error handling
- [x] Add `not-found.tsx` at app root for custom 404 page
- [x] Add environment variable validation at startup (fail fast if missing)

## P1 - Important (Before Feature Work)

- [x] Set up Vitest + React Testing Library (basic test infrastructure)
- [x] Add GitHub Actions workflow (lint + type-check + build on PRs)
- [x] Move rate limiting from in-memory to Upstash Redis / Vercel KV
- [x] Add `loading.tsx` to main routes (`/films`, `/jeux`, `/series`, `/livres`, `/media/[id]`)

## P2 - Recommended (When Convenient)

- [ ] Add Sentry error tracking
- [ ] Add Vercel Analytics for performance monitoring
- [ ] Migrate from `prisma db push` to `prisma migrate` for production safety
- [ ] Add Zod schema validation on API request bodies
- [ ] Clean up `src/lib/mock-data.ts` if no longer needed

## P3 - Nice to Have (Future)

- [ ] Upgrade Prisma from 5.22 to v7
- [ ] Add API documentation (OpenAPI/Swagger)
- [ ] Add E2E tests with Playwright
- [ ] Add database seeding script for dev environment

---

## Completion Criteria

Phase 0 is complete when all P0 and P1 items are done. P2/P3 items can carry into later phases.
