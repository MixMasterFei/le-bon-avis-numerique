# Technical Audit - Le Bon Sens Numerique

**Date:** 2026-02-14
**Auditor:** Claude (AI Technical Advisor)
**Codebase:** Next.js 16 / React 19 / Prisma / Supabase

---

## Overall Rating: 70/100

| Category | Score | Max | Status |
|---|---|---|---|
| Architecture & Structure | 18 | 20 | Excellent |
| Security | 15 | 15 | Excellent |
| Type Safety | 14 | 15 | Very Good |
| Database Design | 13 | 15 | Very Good |
| Error Handling | 4 | 10 | Needs Work |
| Testing | 0 | 10 | Missing |
| CI/CD & DevOps | 2 | 10 | Minimal |
| Performance | 4 | 5 | Good |
| **Total** | **70** | **100** | **Solid foundation, gaps in reliability** |

---

## Detailed Findings

### Architecture & Structure (18/20)

**Strengths:**
- Clean App Router structure with 34 page directories and clear French URL slugs (`/films`, `/jeux`, `/series`, `/livres`)
- 79 API routes organized by domain (`/api/movies/`, `/api/games/`, `/api/admin/`)
- 82 React components well-organized: `ui/`, `media/`, `home/`, `profile/`, `admin/`, `layout/`
- Clear separation: server components by default, `"use client"` only where needed
- Shared utilities in `src/lib/` (auth, security, db, API wrappers)
- Context providers properly nested in root layout (Session > Settings > UI)

**Minor issues:**
- Some components are large (MediaCard.tsx handles 3 variants in one file)
- `src/lib/mock-data.ts` still exists alongside real DB data - potential confusion

---

### Security (15/15)

**Strengths:**
- Input sanitization for all vectors: XSS (`sanitizeInput`), search queries (`sanitizeSearchQuery`), IGDB injection (`escapeIGDBQuery`), number bounds (`sanitizeNumber`)
- Rate limiting in middleware with per-route configs (auth: 5/min, search: 30/min, API: 100/min)
- JWT session strategy with proper token refresh
- Password hashing with bcryptjs (cost 12)
- Email verification required before login
- One-time-use verification tokens with expiration
- Admin route protection in middleware
- GDPR cookie consent implementation
- No secrets exposed in client code
- Remote image domains whitelisted in next.config.ts

**Note:** Rate limiting is in-memory (see CI/CD section for production concern).

---

### Type Safety (14/15)

**Strengths:**
- TypeScript strict mode enabled
- NextAuth types properly extended (`src/types/next-auth.d.ts`)
- Prisma generates typed client from schema
- Path alias `@/` configured
- All API integrations have typed interfaces (TMDBMovie, IGDBGame, etc.)

**Minor issues:**
- Some `any` types may exist in older API routes (not systematically verified)
- No runtime type validation on API request bodies (e.g. Zod)

---

### Database Design (13/15)

**Strengths:**
- 27 well-normalized Prisma models
- Proper foreign key relationships with cascade deletes where appropriate
- Indexes on frequently queried fields (type, expertAgeRec, dataQualityScore, tmdbId)
- Composite unique constraints where needed (`[tmdbId, type]`, `[userId, mediaId]`)
- Snake_case database columns mapped to camelCase TypeScript fields
- Enum types for all categorizations (MediaType, UserRole, ReactionType, etc.)
- Data quality tracking (dataQualityScore, isEnriched, lastVerifiedAt)
- FamilySettings model for per-user preferences

**Issues:**
- Using `prisma db push` instead of `prisma migrate` - no migration history for production
- Prisma 5.22 is outdated (current is 7.2) - missing features and performance improvements
- No database seeding script for development setup

---

### Error Handling (4/10)

**Issues found:**
- **No `error.tsx`** in any route - unhandled errors show Next.js default error page
- **No `not-found.tsx`** - 404s show generic page
- **No `loading.tsx`** in most routes - no loading states for server components
- **No global error boundary** for client-side errors
- API routes have try/catch but inconsistent error response format
- No centralized error logging service (Sentry, LogRocket, etc.)
- Console.error is the only error reporting mechanism

**What works:**
- API routes do have try/catch blocks
- Auth errors redirect to `/connexion`
- Rate limit errors return proper 429 status with headers

---

### Testing (0/10)

**Critical gap:**
- Zero test files in the entire codebase
- No test runner configured (no jest.config, vitest.config)
- No test dependencies in package.json
- No testing utilities (React Testing Library, etc.)
- No E2E test setup (Playwright, Cypress)

---

### CI/CD & DevOps (2/10)

**What exists:**
- Vercel deployment (auto-deploy from GitHub)
- `postinstall` script runs `prisma generate`
- Build script: `prisma generate && next build`

**What's missing:**
- No GitHub Actions workflows
- No automated linting on PRs
- No automated type checking on PRs
- No automated build verification
- No preview deployments configured
- No health check endpoint
- In-memory rate limiting won't work across Vercel's serverless instances
- No environment variable validation at startup
- No database backup strategy documented

---

### Performance (4/5)

**Strengths:**
- TMDB API responses cached for 1 hour (`revalidate: 3600`)
- Proper `sizes` attribute on all Next.js Image components
- Remote images served from CDNs (TMDB, IGDB, Google Books)
- AbortController timeouts (10s) on all external API calls
- Rate limiting prevents API abuse
- Prisma singleton prevents connection pool exhaustion

**Minor concern:**
- No Vercel Analytics or Web Vitals monitoring configured
- No image optimization beyond Next.js defaults

---

## Priority Action Items

### P0 - Do immediately (blocks production reliability)

| # | Action | Effort |
|---|---|---|
| 1 | Add `error.tsx` at app root and key routes | 30 min |
| 2 | Add `not-found.tsx` at app root | 15 min |
| 3 | Add env variable validation at startup | 30 min |

### P1 - Do before next feature work

| # | Action | Effort |
|---|---|---|
| 4 | Set up Vitest + React Testing Library | 2 hrs |
| 5 | Add GitHub Actions (lint + type-check + build) | 1 hr |
| 6 | Move rate limiting to Upstash Redis or Vercel KV | 2 hrs |
| 7 | Add `loading.tsx` to main routes | 1 hr |

### P2 - Do when convenient

| # | Action | Effort |
|---|---|---|
| 8 | Add Sentry for error tracking | 1 hr |
| 9 | Add Vercel Analytics | 15 min |
| 10 | Migrate from `db push` to `prisma migrate` | 2 hrs |
| 11 | Add Zod validation on API request bodies | 3 hrs |
| 12 | Clean up mock-data.ts if no longer needed | 30 min |

### P3 - Future improvements

| # | Action | Effort |
|---|---|---|
| 13 | Upgrade Prisma to v7 | 2 hrs |
| 14 | Add API documentation (OpenAPI/Swagger) | 4 hrs |
| 15 | Add E2E tests with Playwright | 4 hrs |
| 16 | Add database seeding script | 2 hrs |

---

## Codebase Statistics

| Metric | Count |
|---|---|
| TypeScript/TSX files | 222 |
| React components | 82 |
| API routes | 79 |
| Prisma models | 27 |
| Dependencies | 44 |
| Dev dependencies | 6 |
| Test files | 0 |
| Lines of Prisma schema | ~690 |
