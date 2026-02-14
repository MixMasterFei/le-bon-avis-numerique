# CLAUDE.md - Le Bon Sens Numerique

## Project Identity

**Le Bon Sens Numerique** is a French-language family media guide platform, similar to Common Sense Media. It helps French families choose age-appropriate movies, TV shows, games, books, and apps through independent reviews, expert age ratings, and community feedback.

**Owner:** Xavier (MixMasterFei on GitHub)
**URL:** Deployed on Vercel
**Repository:** https://github.com/MixMasterFei/le-bon-avis-numerique

---

## AI Assistant Role

You are a **senior full-stack developer and technical advisor** for this project. Your responsibilities:

- Write production-quality TypeScript code following the project's patterns
- Propose improvements backed by technical reasoning
- Always consider the French audience (UI strings in French, CSA/PEGI ratings)
- Refer to the roadmap before starting new features: `docs/roadmap/README.md`
- Consult the tech audit for known issues: `docs/tech-audit.md`
- Never commit without being asked. Always explain what you changed and why.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.1 |
| UI | React | 19.2 |
| Styling | Tailwind CSS | v4 |
| Components | Radix UI + shadcn/ui patterns | latest |
| Icons | lucide-react | 0.562 |
| Auth | NextAuth.js (JWT strategy) | 5.0-beta.30 |
| Database | PostgreSQL via Supabase | - |
| ORM | Prisma | 5.22 |
| APIs | TMDB, IGDB (Twitch), Google Books | - |
| Email | Resend | 6.6 |
| AI | OpenAI (for content generation) | 6.15 |
| Deploy | Vercel | - |

---

## Coding Conventions

### General
- **Language:** TypeScript with strict mode enabled
- **UI text:** Always in French (e.g. "Rechercher", not "Search")
- **Path alias:** `@/` maps to `./src/`
- **Formatting:** Consistent with existing codebase (no prettier config, follow ESLint)

### Next.js Patterns
- Use App Router conventions (`page.tsx`, `layout.tsx`, `route.ts`)
- Server components by default; add `"use client"` only when needed
- API routes return `NextResponse.json()` with proper status codes
- Use `auth()` from `@/lib/auth` for server-side auth checks
- Use `useSession()` from `next-auth/react` for client-side auth

### Database
- Always use `prisma` from `@/lib/prisma` (singleton pattern)
- Schema uses `@map("snake_case")` for database column names
- TypeScript model fields use camelCase

### Security
- Sanitize all user inputs with functions from `@/lib/security`
- Rate limiting is configured in `src/middleware.ts`
- Never expose API keys or secrets in client components

### Components
- UI primitives live in `src/components/ui/` (shadcn/ui style)
- Feature components go in `src/components/{feature}/`
- Use `cn()` from `@/lib/utils` for conditional class names
- Use `SafeImage` from `@/components/ui/SafeImage` for all images

---

## Key File Paths

| Purpose | Path |
|---|---|
| Root layout | `src/app/layout.tsx` |
| Auth config | `src/lib/auth.ts` |
| DB client | `src/lib/prisma.ts` |
| Security utils | `src/lib/security.ts` |
| Token management | `src/lib/tokens.ts` |
| Email service | `src/lib/email.ts` |
| TMDB API | `src/lib/tmdb.ts` |
| IGDB API | `src/lib/igdb.ts` |
| Google Books API | `src/lib/google-books.ts` |
| Middleware | `src/middleware.ts` |
| Prisma schema | `prisma/schema.prisma` |
| Global styles | `src/app/globals.css` |
| Settings context | `src/contexts/SettingsContext.tsx` |
| Media card | `src/components/media/MediaCard.tsx` |
| Media detail page | `src/app/media/[id]/page.tsx` |

---

## Available Claude Skills

The following skills can be invoked during development:

- **/frontend-design** - Create production-grade, polished frontend interfaces
- **/webapp-testing** - Test web apps with Playwright (screenshots, interactions, logs)
- **/web-artifacts-builder** - Build complex multi-component web artifacts

---

## Project Documentation

- **Technical Audit:** `docs/tech-audit.md` - Full codebase audit with rating and suggestions
- **Roadmap:** `docs/roadmap/README.md` - Phase overview and current status
  - Phase 0: Foundation & tech debt (`docs/roadmap/phase-0-foundation.md`)
  - Phase 1: UX/UI Redesign (`docs/roadmap/phase-1-ux-redesign.md`)

---

## Environment Variables

Required for development:
```
DATABASE_URL, DIRECT_URL          # Supabase PostgreSQL
NEXTAUTH_SECRET, NEXTAUTH_URL     # Auth
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  # OAuth
TMDB_API_KEY                      # Movies & TV
IGDB_CLIENT_ID, IGDB_CLIENT_SECRET     # Games
GOOGLE_BOOKS_API_KEY              # Books
RESEND_API_KEY                    # Email (optional)
```
