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
- **No Co-Authored-By in commits.** Do not add `Co-Authored-By: Claude` or any AI attribution to commit messages.
- **No tool/service leaks in source.** Never expose third-party service names (TMDB, IGDB, OpenAI, Claude, Anthropic) in user-facing HTML, meta tags, or rendered text. These are internal implementation details. Backend code comments and variable names are fine.

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
| Family fit API (scoring) | `src/app/api/media/[id]/family-fit/route.ts` |
| Family fit card (UI) | `src/components/media/FamilyFitCard.tsx` |
| Profile page | `src/app/profil/page.tsx` |
| Family recommendations | `src/components/chez-vous/FamilyRecommendationsSection.tsx` |
| Family movie night | `src/components/chez-vous/FamilyMovieNightSection.tsx` |
| User lists preview | `src/components/chez-vous/UserListsPreview.tsx` |
| Member corner page | `src/app/profil/membres/[memberId]/page.tsx` |
| Member corner component | `src/components/profile/MemberCorner.tsx` |
| Preference quiz page | `src/app/profil/quiz/[memberId]/page.tsx` |
| Preference quiz component | `src/components/profile/PreferenceQuiz.tsx` |
| Completion meter | `src/components/profile/CompletionMeter.tsx` |
| Media search add | `src/components/profile/MediaSearchAdd.tsx` |
| Interests editor | `src/components/profile/InterestsEditor.tsx` |
| Family member API | `src/app/api/user/family/[id]/route.ts` |
| Member preferences API | `src/app/api/user/family/[id]/preferences/route.ts` |
| Reaction API | `src/app/api/user/reaction/route.ts` |
| Age vote API | `src/app/api/media/[id]/age-vote/route.ts` |
| Click tracking API | `src/app/api/track/click/route.ts` |
| Recommendations API | `src/app/api/recommendations/route.ts` |
| Family recommendations API | `src/app/api/recommendations/family/route.ts` |
| Similarity compute | `src/app/api/admin/similarity/compute/route.ts` |
| CNC ratings import | `src/app/api/admin/import-cnc-ratings/route.ts` |
| AI enrichment | `src/app/api/admin/enrich/route.ts` |
| Age vote button | `src/components/media/AgeVoteButton.tsx` |
| Media route helper | `src/lib/media-route.ts` |
| SQL migrations | `sql/*.sql` |
| SEO robots | `src/app/robots.ts` |
| SEO sitemap (dynamic) | `src/app/sitemap.ts` |
| AI discovery (llms.txt) | `src/app/llms.txt/route.ts` |
| Markdown layer for AI agents | `src/app/md/` + `src/lib/markdown/` (media-md, media-md-data, selection-md — single-source builders shared with fiche JSON-LD and MCP) |
| MCP server (public, read-only) | `src/app/api/mcp/[transport]/route.ts` + `src/lib/mcp/totem-tools.ts` — streamable HTTP at `/api/mcp/mcp`; anonymous tools describe media only, per-child fit stays behind accounts |
| AI bot/referrer telemetry | `src/lib/ai-bots.ts` + `src/app/api/track/ai-bot/route.ts` (fed by middleware; `scripts/check-ai-bots.ts` to inspect) |
| Marketing playbook | `docs/marketing/claude_mkt.md` |
| Launch checklist | `docs/marketing/launch-checklist.md` |
| Market analysis | `docs/marketing/market-analysis.md` |
| Blog .docx drop folder | `blog/` |
| Sanity config | `sanity.config.ts` |
| Sanity CLI config | `sanity.cli.ts` |
| Sanity env constants | `src/sanity/env.ts` |
| Sanity client | `src/sanity/client.ts` |
| Sanity image helper | `src/sanity/image.ts` |
| Blog post schema | `src/sanity/schemas/post.ts` |
| Sanity Studio page | `src/app/studio/[[...tool]]/page.tsx` |
| Blog listing page | `src/app/blog/page.tsx` |
| Blog post page | `src/app/blog/[slug]/page.tsx` |
| Blog card component | `src/components/blog/BlogCard.tsx` |
| Portable Text renderers | `src/components/blog/PortableTextComponents.tsx` |

---

## Blog (Sanity CMS)

The blog lives at `totemavise.com/blog` and covers family digital wellness topics (screen time, movies, games, parenting). Content is managed via **Sanity CMS**.

**Sanity project:** `9cylu9mu` (dataset: `production`)

### Content workflow
1. Writer drops `.docx` files in the `blog/` folder at project root
2. Claude reads the `.docx`, extracts content (headings, text, images, formatting)
3. Claude publishes to Sanity via API using `SANITY_API_WRITE_TOKEN`
4. Blog pages auto-update via ISR (5-min revalidate)

Alternative: write directly in Sanity Studio at `totemavise.com/studio`

### Blog post schema (Sanity)
- `title`, `slug`, `author`, `publishedAt`, `category`, `excerpt`, `mainImage`, `body` (Portable Text), `seoTitle`, `seoDescription`
- Categories: "Temps d'écran", "Films & séries", "Jeux vidéo", "Parentalité numérique", "Guides pratiques", "Actualités"

### Blog SEO
- Each post has JSON-LD `Article` structured data
- `generateMetadata()` for dynamic title/description/OG image
- Blog posts included in sitemap (published only, no drafts)
- ISR with `revalidate = 300` (5 min)

### Required env vars (Sanity)
```
NEXT_PUBLIC_SANITY_PROJECT_ID=9cylu9mu
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_SANITY_API_VERSION=2024-01-01
SANITY_API_WRITE_TOKEN=xxx          # For publishing via API (not needed for public reads)
```

---

## Automation & Cron Jobs

### Vercel Cron (1 free job) — `vercel.json`
- **Daily 8:00 AM UTC — Heartbeat** (`/api/cron/heartbeat`). Watchdog for the GitHub-Actions pipeline below. Runs on Vercel's own infra so it survives a total GH-Actions outage (the daily supervisor can't — it *is* a GH-Actions job). Checks whether the daily "canary" jobs (`cron-supervisor`, `enrich`, `import`, `news-discover`) have logged a run in the last 30h; if none have, it logs `status:"error"` which fires the failure email. This is the only free Vercel cron slot — don't add a second.

### GitHub Actions (`.github/workflows/cron.yml`)
Automated maintenance, all jobs use `CRON_SECRET` Bearer auth.

| When (UTC) | Tasks |
|---|---|
| Daily 3:00 AM | Import new movies/TV from TMDB (`weekly-import`) + new games from IGDB (`weekly-games-import`, popularity-floored) + CNC ratings import. TMDB dedup keeps actual new items per run to ~10-20. |
| Daily 4:00 AM | Enrichment (10 movies + 10 TV + 10 games) + Deep enrichment (3 items) + Quality score recompute (all items) |
| 4×/day (:17 past 00/06/12/18) | News discovery (`news-discover`) — synthesized news briefs |
| Saturday 5:00 AM | TMDB ratings backfill (loops until drained) + Streaming platform updates + Similarity scores (full mode, 50/batch ×20) + **Age-floor sweep** (`age-floor`) — deterministic, idempotent, re-floors any title whose age drifted below its content-justified minimum since last write (zero LLM cost). Manual dry-run review via the standalone `age-floor` dispatch task. |
| Tue + Fri 5:00 AM | Weekly dossier (`weekly-dossier`) — long-read synthesis |
| Monday 6:00 AM | Family content editorial agent (`family-content-agent`) — priorities email |
| **Wed 6:13 AM** | **Debt digest (`debt-digest`)** — weekly tech/data-debt email: cron health, catalog gaps (unenriched / no poster / no age rec / low quality / no topics, manga excluded), editorial queue. Read-only. |
| **Thu 6:23 AM** | **SEO striking distance (`seo-striking-distance`)** — pulls GSC pos. 8–20 queries + emails them. **Write-side ON by default** (since 2026-07-10; kill-switch `SEO_AGENT_AUTOFIX="false"`, per-run `?dryRun=1`): per target fiche, creates internal-link maillage (`source:"EXPERT"` `MediaSimilarity` edges — fills thin pages AND guarantees top-of-rail EXPERT presence on popular pages; protected from the Saturday recompute), rewrites `synopsisFr` when the query keyword is absent (enriched fiches only), and sets the `seoTitle` `<title>` override (also on provisional fiches with an age). Display name (H1/cards) never auto-edited. `src/lib/seo-autofix.ts`, gpt-5-mini, max 3 synopses + 3 titles/run. **The email reports the top 25 queries, but the write-side works from a deeper pool** (`MAX_ACTIONABLE` = 150 queries → `MAX_TARGETS` = 60 fiches/run): the top ~20 fiches saturate after a few weeks (maillage at ceiling, keyword covered in synopsis + `seoTitle`) and the agent must reach past them to keep finding work. A run with 0 writes is normal once the target set is saturated — the email and `cron_logs.details.outcomes` now report `targetsExamined` / `saturated` / per-lever tallies so "rien à faire" is distinguishable from "toutes les écritures refusées". |
| Daily 7:00 AM | Cron supervisor (`supervisor`) — health check + limited safe auto-remediation + digest email when anomalies |

**Total enrichment:** ~210 items/week via OpenAI GPT-4o-mini (~$0.35-0.90/week)

**Manual trigger:** Actions tab > "Scheduled Maintenance" > Run workflow (select specific task — includes `debt-digest`)

**Activity monitoring & feedback loop:** Every cron logs to the `cron_logs` table (`logCronRun`), visible in the admin dashboard at `/admin/operations` ("Jobs automatiques"). On `status:"error"` an immediate failure email is sent (`sendCronFailureAlert`, suppressible via `CRON_ALERT_MODE=digest`). The daily **supervisor** (`src/lib/cron-supervisor.ts`) detects missing/stale/error/repeated-partial tasks against `EXPECTED_TASKS`, attempts up to 3 safe remediations (`CRON_SUPERVISOR_REMEDIATE=false` to disable), and emails one digest. The weekly **debt digest** (`src/lib/debt-digest.ts`) covers the slower-moving data/content debt the supervisor doesn't. `scripts/check-cron-health.ts` dumps recent `cron_logs` from the CLI (`npx tsx scripts/check-cron-health.ts [task]`). When adding a new cron: register it in `cron.yml`, in `EXPECTED_TASKS` (cron-supervisor.ts), in `KNOWN_CRON_TASKS` (admin-kpis.ts), and — if it has a weekly+ cadence worth surfacing — in `CRON_STALE_HOURS` (debt-digest.ts).

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
- Movies in TMDB now_playing but not yet in the DB still show (with TMDB poster) and now carry a **provisional age** estimated from TMDB `genre_ids` (so the cinema age filter isn't empty), badged "à confirmer" until imported/enriched. See "Provisional age ratings".

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

### Provisional ("WIP") age ratings

Imported films get an estimated `expertAgeRec` immediately (French CSA → foreign cert → genre heuristic — `src/lib/import-helpers.ts` `estimateProvisionalAge`), so recent/theatrical titles are visible without waiting for AI enrichment. A film is **provisional** when `!isEnriched && expertAgeRec != null` (surfaced as `isProvisional` on `TransformedMediaItem`/`MockMediaItem`, badged "Âge provisoire · à confirmer" via `ProvisionalBadge`).

- **Curated surfaces stay expert-only.** `fetchMovies`/`fetchSeries` keep the `isEnriched: true` gate by default; pass `includeProvisional: true` (API: `?includeProvisional=1`) to also surface provisional films. Enabled only on **search** (`/films/recherche`), **`/films?sort=newest`**, and the **cinema** view (off-DB now_playing films get an age estimated from TMDB `genre_ids` in `src/lib/cinema.ts`). Homepage rails, recommendations, and family-fit remain expert-only.
- **Smart filter (`/api/filter/smart`) is expert-only** (`isEnriched: true` in `buildSmartFilterWhere`): provisional films have no `ContentMetrics`, so per-member sensitivity scoring can't include them safely.
- **Imports populate platforms day-one** (`createMovieFromTmdb` calls watch-providers) so a freshly-imported Netflix film is filterable before the Saturday streaming cron. Provider strings are normalized via the shared `src/lib/streaming-providers.ts` (`"Netflix"`, not `"Netflix France"` — filter UIs must match).
- **Backfill** old null-age films via `POST /api/admin/backfill-provisional-age` (admin "Backfill âges provisoires" preset), estimating from stored `officialRating`/`genres` only. Theatrical top-ups: admin "Cinéma (sorties en salle)" preset (`source=now_playing`).

---

## Family Profiles & Personalization System

Each user can have up to 10 **FamilyMember** profiles. Members accumulate data through multiple channels that feed into the recommendation engine.

### Data Model (`FamilyMember`)
- **Identity:** name, birthYear, avatarEmoji, interests[]
- **Genre prefs:** favoriteGenres[], dislikedGenres[]
- **Sensitivity (0-3):** violence, scary, sexual, language, substances
- **Positive content prefs (0-3):** positiveMessages, roleModels, educational
- **Avoid:** avoidTopics[]
- **Flag:** useCustomSettings (true = member-specific, false = inherit family defaults)

### Data Entry Points
1. **Preference Quiz** (`/profil/quiz/[memberId]`) — 7-step interactive wizard covering genres, sensitivity, positive content, and topics to avoid. Saves via `PUT /api/user/family/[id]/preferences`.
2. **Member Corner** (`/profil/membres/[memberId]`) — Tabbed page (Overview / Favorites / Preferences) where parents can edit identity, add interests, search & add media as LOVED reactions, and view reaction history.
3. **Preferences Modal** — Quick access from profile page (3-tab modal: Sensitivity, Genres, Topics).
4. **Reactions** — On every media detail page, parents record per-member reactions (WATCHED, LOVED, LIKED, OK, SCARED, BORED, TOO_YOUNG, TOO_OLD) via `FamilyReactions` component. WATCHED items are excluded from recommendations.
5. **Age Votes** — Thumbs up/down on expert age recommendations via `AgeVoteButton`. Shows community consensus badge at >5 votes and >70% agreement.

### Family Fit Scoring (`/api/media/[id]/family-fit`)
Computes a 0-100 fit score per family member for any media item. The weights are the **Phase-2 set** (canonical source: `FIT_WEIGHTS` in `src/lib/family-fit-score.ts` — sum = 1.0, pinned by a test):
```
finalScore =
    (ageScore         × 0.28)
  + (sensitivityScore × 0.22)
  + (genreScore       × 0.10)
  + (interestsScore   × 0.08)
  + (affinityScore    × 0.08)
  + (toneScore        × 0.05)
  + (positiveScore    × 0.04)
  + (avoidScore       × 0.05)
  + (personalizedScore× 0.10)
```
- **Age:** compares expertAgeRec vs member's age (dominant signal; mature gates live here)
- **Sensitivity:** compares media content metrics vs member tolerance
- **Genre:** overlap between media genres and member favorites
- **Interests:** overlap between media topics/themes and member interests
- **Affinity:** uses `MediaReaction` + `MediaSimilarity` table to find personal connections (e.g., "loved Paw Patrol TV → will love the movie")
- **Tone / Positive:** tone-tag fit and positive-content (messages, role models, educational) match
- **Avoid:** checks media topics against avoidTopics
- **Personalized:** cosine similarity vs the member's behavioral vector (reactions). Starts at 10% — enough to differentiate similar quiz answers, not enough to rescue a disliked-genre title (the hard gate runs first).

> **Hard gates run before the weighted sum:** a disliked genre or avoided topic floors the score (`genreScore === 0 || avoidScore === 0` ⇒ score clamps to ~10), and a mature-content penalty multiplier is applied for minors. The weights only rank candidates that already cleared the gates.

### Profile Completion Meter
Displayed on the Member Corner overview tab. Tracks 8 criteria totaling 100%: birth year (10%), custom avatar (5%), quiz completed (25%), sensitivity customized (15%), avoid topics (5%), 3+ reactions (15%), 5+ reactions (10%), interests (15%).

### Key Patterns
- Adding a media favorite = creating a LOVED reaction (reuses existing `POST /api/user/reaction`)
- Removing a favorite = deleting the reaction (`DELETE /api/user/reaction`)
- Interests are stored as `String[]` on FamilyMember (max 20, saved via `PATCH /api/user/family/[id]`)
- Quiz completion is detected by `useCustomSettings === true && favoriteGenres.length > 0`

---

## Profile Page (`/profil`)

The unified authenticated user hub. `/chez-vous` redirects here (kept for bookmarks). All auth callbacks and nav links point to `/profil`.

**Page sections (in order):**
1. Profile header — avatar, name, email, "Modifier le profil" dialog
2. Stats grid — reviews, favorites, watchlist, reactions
3. `FamilyRecommendationsSection` — per-member personalized recommendations (tabbed)
4. `FamilyMembers` — family member CRUD, links to member corners and quiz
5. `FamilyMovieNightSection` — multi-member movie night finder with match %
6. `UserListsPreview` — poster grid previews of favorites + watchlist (6 each)
7. Account settings — blur 18+ toggle, cookie prefs, delete account

**Note:** Recommendation components live in `src/components/chez-vous/` (historical, imported from Profile page).

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

### Admin Operations (Operations Center)
| Operation | Endpoint | Notes |
|---|---|---|
| CNC Ratings Import | `POST /api/admin/import-cnc-ratings` | Case-sensitive API, filters European-lang films 6+ months old |
| AI Enrichment | `POST /api/admin/enrich` | GPT-4o-mini, ~60 topic tags, `force=true` to re-enrich |
| Similarity Compute | `POST /api/admin/similarity/compute` | `mode=full` recommended, batch=5 for 60s limit |
| Quality Recompute | `POST /api/admin/quality/recompute` | Recalculates dataQualityScore |
| Fix faux TP | `POST /api/admin/fix-default-tp` | Cleans false "Tous Publics" ratings |

### Known Gotchas
- **SimilaritySource enum**: Must be PascalCase `"SimilaritySource"` in PostgreSQL (Prisma expects this). Fix: `sql/fix_similarity_source_type.sql`
- **Similarity timeout**: Full mode limited to batch=5 items to stay under Vercel 60s serverless limit
- **Dashboard safeQuery**: `MediaCorrection`, `ReviewReport`, `ContentRequest`, `AdminActivity` tables may not exist — all wrapped in `safeQuery` fallbacks

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
RESEND_NEWSLETTER_AUDIENCE_ID     # Resend audience ID for the /apercudecouverte-v5 newsletter signup (optional)
NEWSLETTER_PUBLIC                 # Set to "true" to open newsletter signup to all authenticated users. Default: admin-only beta.
TOTEM_PUBLIC                      # Totem Assistant rollout: unset = admin-only alpha (dock + /api/totem/* gated by ADMIN role) · "auth" = all logged-in users · "true"/"1" = fully public · "off"/"0" = KILL SWITCH (disabled for everyone, admins included — the cost emergency brake). "false" keeps meaning admin-only (historical). Mirrors NEWSLETTER_PUBLIC.
TOTEM_DAILY_USER_CAP              # Totem chat: max messages/day per authenticated user (default 50). Counted from persisted totem_messages rows → accurate across Vercel instances. The hourly limits (5/h anon, 30/h auth) are separate, in-memory.
TOTEM_GLOBAL_DAILY_CAP            # Totem chat: max messages/day across ALL users (default 1000) — global circuit breaker; when hit the chat answers 503 « Totem se repose » until UTC midnight. Cost telemetry: per-message token usage in totem_messages (sql/add_totem_message_token_usage.sql) + « Coût estimé » tile in /admin/totem.
HOMEPAGE_V2_PUBLIC                # Set to "true" to flip the V2 visual system (home-redesign homepage + catalogue layouts, site-wide V2 typography via [data-v2-type] in globals.css, and the monogram avatars) ON for everyone. Default: admin-only. Single switch with instant rollback — gate lives in src/lib/v2-flag.ts (v2Enabled). Mirrors TOTEM_PUBLIC. `?v=classic` still forces the classic page per-request.
SEO_AGENT_AUTOFIX                 # KILL-SWITCH (inverted since 2026-07-10): the weekly seo-striking-distance cron WRITES by default IN PRODUCTION ONLY (maillage + synopsis rewrites + seoTitle overrides; fail-closed on previews/local via VERCEL_ENV guard). Set to "false" to fall back to report-only. ?dryRun=1 forces report-only for one run. See Automation notes.
PEXELS_API_KEY                    # DEPRECATED (May 2026). Stock-photo fallback removed from news-image.ts in the news-pipeline simplification. Safe to remove from Vercel env. Stock-image cache table left in place for now.
UNSPLASH_ACCESS_KEY               # DEPRECATED (May 2026). Same as PEXELS_API_KEY — stock-photo tier removed.
```

### Deprecated env vars (kept for reference, no longer read by code)

After the May 2026 news-pipeline simplification, the following env vars
are no longer used by the active code paths:

- `PEXELS_API_KEY`, `UNSPLASH_ACCESS_KEY` — stock-photo tier removed from `src/lib/news-image.ts`. Image tiers are now: AGENCY → PUBLISHER_RSS → FALLBACK. **FALLBACK** = a branded "zen card" rendered on the fly by `/api/news/fallback-card?cat=<NewsCategory>` (`next/og`, 1200×630 PNG, warm site-palette gradient + section label). The news pipeline assigns it instead of *dropping* an article when the article has no usable photo (or only a sub-`MIN_IMAGE` thumbnail) — that's what stopped the "0 stories produced" runs. Fallback cards are not Supabase-mirrored (the route is permanent) and are exempt from the cross-story image-dedup. `news-discover` stats now include `itemsFellBackToCard` / `storiesUsingFallbackCard`. Low-quality-image publishers (Geek Junior) are still dropped, not card-substituted.
- `DEEPSEEK_API_KEY`, `NEWS_PROVIDER` — DeepSeek removed from synthesis, moderation, research, quality-judge, and catalog-verify paths. All news LLM calls now go through Claude Sonnet 4.6 (synthesis) / Haiku 4.5 (everything else). The `src/lib/deepseek.ts` client file is left in the repo as dormant code.
- `OPENAI_API_KEY` for vision moderation — `gpt-5-mini` is no longer called from `news-moderate.ts`. The key may still be used by other features (catalog enrichment).
