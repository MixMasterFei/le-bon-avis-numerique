# CLAUDE.md - Totem Avisé

## Project Identity

**Totem Avisé** (totemavise.com) is a French-language family media guide platform, similar to Common Sense Media. It helps French families choose age-appropriate movies, TV shows, games, books, and apps through independent reviews, expert age ratings, and community feedback.

**Owner:** Xavier (MixMasterFei on GitHub)
**URL:** https://totemavise.com (Deployed on Vercel)
**Repository:** https://github.com/MixMasterFei/le-bon-avis-numerique

---

## AI Assistant Role

You are a **senior full-stack developer and technical advisor** for this project. Your responsibilities:

- Write production-quality TypeScript code following the project's patterns
- Propose improvements backed by technical reasoning
- Always consider the French audience (UI strings in French, CSA/PEGI ratings)
- Refer to the roadmap before starting new features: `docs/roadmap/README.md`
- Consult the tech audit for known issues: `docs/tech-audit.md`
- For marketing, growth, SEO, or content tasks, refer to: `docs/marketing/claude_mkt.md`
- For launch readiness and action items: `docs/marketing/launch-checklist.md`
- For visibility tools and market research: `docs/marketing/market-analysis.md`
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
| Database | PostgreSQL via Supabase (pooler mode) | - |
| ORM | Prisma | 5.22 |
| APIs | TMDB, IGDB (Twitch), Google Books | - |
| Email | Resend | 6.6 |
| AI | OpenAI GPT-4o-mini (content enrichment) | 6.15 |
| Deploy | Vercel | - |
| CI/CD | GitHub Actions | - |

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
- Always use `prisma` from `@/lib/prisma` (singleton pattern with connection pooler)
- Schema uses `@map("snake_case")` for database column names
- TypeScript model fields use camelCase
- **Migrations:** Project uses manual SQL migrations (not `prisma migrate dev`). Apply schema changes via `prisma db execute` with raw SQL, then `prisma generate`. The `topics` table has a schema conflict that blocks `prisma db push` — always use raw SQL for new columns/tables.

### Security
- Sanitize all user inputs with functions from `@/lib/security`
- Rate limiting is configured in `src/middleware.ts` (in-memory, no Upstash)
- Never expose API keys or secrets in client components
- Cron/automated routes use `CRON_SECRET` Bearer token via `@/lib/cron-auth`

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
| Cron auth helper | `src/lib/cron-auth.ts` |
| Cron activity logger | `src/lib/cron-log.ts` |
| Seeded shuffle (homepage rotation) | `src/lib/seeded-shuffle.ts` |
| TMDB API | `src/lib/tmdb.ts` |
| IGDB API | `src/lib/igdb.ts` |
| Google Books API | `src/lib/google-books.ts` |
| Middleware | `src/middleware.ts` |
| Prisma schema | `prisma/schema.prisma` |
| Global styles | `src/app/globals.css` |
| Settings context | `src/contexts/SettingsContext.tsx` |
| Media card | `src/components/media/MediaCard.tsx` |
| Media detail page | `src/app/media/[id]/page.tsx` |
| SEO robots | `src/app/robots.ts` |
| SEO sitemap (dynamic) | `src/app/sitemap.ts` |
| Marketing playbook | `docs/marketing/claude_mkt.md` |
| Launch checklist | `docs/marketing/launch-checklist.md` |
| Market analysis | `docs/marketing/market-analysis.md` |

---

## Automation & Cron Jobs

### Vercel Cron (1 free job)
- **Monday 3:00 AM UTC** — Weekly import (`/api/cron/weekly-import`)

### GitHub Actions (`.github/workflows/cron.yml`)
Automated maintenance across 3 days/week. All jobs use `CRON_SECRET` Bearer auth.

| Day | Time (UTC) | Tasks |
|---|---|---|
| Monday | 3:00 AM | Import new movies/TV from TMDB + Enrichment batch 1 (30 movies + 20 TV + 10 games) |
| Thursday | 4:00 AM | Enrichment batch 2 (30 movies + 20 TV + 10 games) + Quality score recompute |
| Saturday | 5:00 AM | TMDB ratings backfill + Streaming platform updates + Similarity scores |

**Total enrichment:** ~120 items/week via OpenAI GPT-4o-mini (~$0.20-0.50/week)

**Manual trigger:** Actions tab > "Scheduled Maintenance" > Run workflow (select specific task)

**Activity monitoring:** All cron runs are logged to the `cron_logs` table and visible in the admin dashboard under "Jobs automatiques".

### Required GitHub Secrets (environment: Production)
- `SITE_URL` — Vercel production URL (e.g. `https://your-app.vercel.app`)
- `CRON_SECRET` — Same value as Vercel env var

**Important:** Secrets are scoped to the `Production` environment. Each job in `cron.yml` must declare `environment: Production` to access them. All `curl` commands use `-L` flag to follow Vercel HTTP→HTTPS redirects.

---

## Homepage Content Rotation

Homepage sections (ExpertPicks, FeaturedMovies, StreamingSection) use **week-seeded deterministic shuffling** so content rotates every Monday without manual intervention.

- `src/lib/seeded-shuffle.ts` — Mulberry32 PRNG + Fisher-Yates + ISO week seed
- `shuffle=weekly` query param on `/api/db/movies` and `/api/db/streaming`
- **NewArrivals** stays recency-sorted (no shuffle)

---

## "En ce moment au cinéma" (Now Playing)

The homepage cinema section and `/films?sort=cinema` use the **TMDB `now_playing` API** (`region=FR`) as the source of truth for French theater listings.

- **API route:** `/api/cinema` — Calls TMDB live (1-hour cache), cross-references with DB for age recommendations
- **Component:** `src/components/home/NowInCinema.tsx` — Shows 7 items (1 row)
- **Important:** Do NOT use `releaseDate` filtering as a proxy for "now playing". TMDB's `now_playing` endpoint with `region=FR` is the only accurate source.
- Movies in TMDB now_playing but not yet in the DB still show (with TMDB poster) — they just lack age recommendations until the next cron import.

---

## "Voir tout" Link Pattern

All homepage "Voir tout" links must pass the relevant filters to the target page so the user sees consistent content. Pattern:

| Section | Target | Key Params |
|---|---|---|
| Derniers Ajouts | `/films?sort=newest` | `sort` read by films page |
| En ce moment au cinéma | `/films?sort=cinema` | Uses `/api/cinema` (TMDB now_playing) |
| Films pour les enfants | `/films?maxAge=7` | `maxAge` read by films page, passed to FilterSidebar |
| Streaming section | `/films/recherche?platforms=...&maxAge=10` | Params read by recherche page |
| Expert Picks | `/recherche` | General browse (no specific filter) |

When creating new homepage sections with "Voir tout", always ensure the target page reads and applies the URL params.

---

## Quality & Featured Content

- **`dataQualityScore`** — Measures data completeness (poster, synopsis, genres, age rating, content metrics). Used for filtering, NOT for ranking.
- **`tmdbRating` / `tmdbVoteCount`** — TMDB audience ratings stored internally. Used for quality sorting and featured selection. Never displayed to users (not the site's purpose).
- **Featured criteria:** `tmdbRating >= 6.5`, `tmdbVoteCount >= 200`, has poster, has age rating, French/English language, `dataQualityScore >= 50`
- **Tag thresholds:** Educatif requires `positiveMessages >= 5`, Modeles+ requires `roleModels >= 5` (raised from 4 to avoid false positives)

---

## Admin Dashboard

Located at `/admin`. Key sections:
- **Action items** — Pending corrections, content requests, low quality items, reports
- **Quick actions** — Search & add media, import presets
- **Stats** — Media counts, quality scores, language distribution
- **Jobs automatiques** — Cron job history with per-task stats, error rates, durations
- **Activity feed** — Recent admin actions
- **User analytics** — Top contributors, recent reviews
- **Advanced actions** — DB sync, backfill, quality recompute, streaming, similarity, screenshots

---

## Environment Variables

Required for development:
```
DATABASE_URL, DIRECT_URL          # Supabase PostgreSQL (pooler mode)
AUTH_SECRET                       # NextAuth (was NEXTAUTH_SECRET)
NEXTAUTH_URL                      # Auth callback URL
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  # OAuth
TMDB_API_KEY                      # Movies & TV
IGDB_CLIENT_ID, IGDB_CLIENT_SECRET     # Games
GOOGLE_BOOKS_API_KEY              # Books
OPENAI_API_KEY                    # AI enrichment
CRON_SECRET                       # Automated job auth
RESEND_API_KEY                    # Email (optional)
```
