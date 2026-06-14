# Technical Audit — Totem Avisé

**Date:** 2026-05-31 (this supersedes the 2026-02 audit, archived at the bottom)
**Codebase:** Next.js 16.2 / React 19 / Tailwind v4 / Prisma / Supabase / Vercel

---

## Overall: ~85/100 — solid production base

| Category | Score | Notes |
|---|---|---|
| Security | 14 / 15 | Strong for a consumer app; CSP + distributed rate-limit are the gaps before scale |
| Ops / CI | 15 / 15 | Mature: CI, GH-Actions crons + Vercel heartbeat, supervisor, debt digest, prod smoke, weekly dep audit |
| Performance | 3 / 5 | Deliberate trade-offs penalise Lighthouse (unoptimized images, temp source maps) |
| Code quality | 16 / 20 | Clear architecture; some god-objects (600–1100 lines) and duplicated rate-limit/auth |
| Tests | 6 / 10 | ~16 Vitest + ~20 Playwright; thin on API routes + news pipeline |
| SEO / product | 9 / 10 | Sitemap, JSON-LD, age-intent metadata, /age, /md, llms.txt |
| Observability | 5 / 5 | Sentry + Vercel Analytics + Speed Insights + Plausible + prod smoke |
| **Total** | **68 / 80 → 85%** | Production-ready; gaps are assumed trade-offs + complexity debt, not critical flaws |

> 68/80 is exactly 85% (a May external "Composer" audit rounded it to 86).

---

## Recent hardening (May 2026)

- **Security**: `next` bumped 16.1.1 → 16.2.6 (clears ~20 advisories incl. App-Router middleware-bypass). `/api/db/health` gated — public callers get a bare `{ ok: true }`; catalog counts + Prisma error detail are cron/admin-only.
- **CI/ops**: `prod-health-smoke.yml` (12 URLs, daily + post-deploy, authenticates past Vercel Deployment Protection via `VERCEL_AUTOMATION_BYPASS_SECRET`). `dependency-audit.yml` (weekly `npm audit`, fails on critical). Retired 3 legacy remote "report" agents (smoke/seo/health) that were blocked at the Vercel edge and spamming branches; pruned ~47 stale branches.
- **Product**: movie pages gained an "Au cinéma" badge (TMDB now_playing) + merged rent/buy availability row; age-led meta descriptions across media pages.

---

## Known issues by priority

### P0 — quick, low-risk
- **`productionBrowserSourceMaps: true`** ([next.config.ts](../next.config.ts)) — only on to debug an unresolved **React #418 hydration crash on `/apercudecouverte-v3`**. Fix the hydration crash first, then remove the maps. (v3 is admin-only, so low urgency.) Likely cause is a relative-time / `Date.now()` render path in `src/components/home-v2/` — needs a focused pass, not a blind change.
- **Images `unoptimized: true`** ([next.config.ts](../next.config.ts)) — **do NOT blind-flip to `false`.** On Vercel this meters per-image Image-Optimization billing across ~10k catalog items; and the app already does responsive sizing via TMDB CDN sizes (w92/w342/w500). Real LCP gain is the AVIF/WebP + srcset delta only. **Measure first**, then decide; if flipped, watch the Vercel image meter.

### P1 — before scaling / before the Totem AI assistant goes public
- **No CSP** — middleware sets the other security headers but no `Content-Security-Policy`. Inline theme/JSON-LD/Plausible scripts need a nonce-based `script-src`.
- **In-memory rate limiting** ([middleware.ts](../src/middleware.ts) + [security.ts](../src/lib/security.ts), duplicated) — per-serverless-instance, bypassable across regions/instances. Move to one shared store (Vercel WAF rate rules or Upstash) — important once `totem/chat` is public.
- **Validation** — Zod on only ~4 routes; the rest rely on manual checks. Prioritise auth / user / `totem/chat` / contact / reviews.

### P2 — quality / debt
- God-objects to split: `media/[id]/page.tsx`, `SiteHeader.tsx`, `MemberCorner.tsx`, `apercudecouverte-v3/page.tsx` (~900–1100 lines each).
- `mock-data.ts` still imported in `media/[id]/page.tsx`.
- Error boundaries: only a root `error.tsx`; no per-section boundaries.
- API tests for ~10–15 critical routes (auth, family-fit, recommendations).

### P3 — long-term
- `topics` table schema conflict blocks `prisma db push` (manual SQL migrations).
- OpenAPI for the ~140 API routes.

---

## Deep-dive: `/apercudecouverte-v3` news staleness (diagnosed + fixed 2026-05-31)

**Symptom:** the (admin-only) v3 discovery page showed stories 10–16 days old.

**Root cause — a chain, not a single bug:**
1. The news pipeline is healthy (fresh briefs daily, cron `success` 4×/day).
2. But since ~May 15, **~100% of stories carry no reachable direct photo**: about half the RSS items have no image at all, and many that do are **hotlink-protected** (200 to a server-side HEAD, 403 to the browser GET). Verified live: extraction code + feeds are fine (Le Monde 5/5, France Info 5/5 from a residential IP), but production yields 0 — the difference is the datacenter-IP fetch.
3. A prior change flipped `news-discover` from *card image-less items* → *drop them* (and same at the image-mirror step), pushing persistence toward "0 stories produced" cycles.
4. v3 ran the **`asStored` "direct-photo-only"** policy, which *hides* every photo-less story → the page fell through to the last stories that still had real photos (16 days old).

**Signal that nailed it:** `resolveImagesMs` per cron run — `99ms` (zero network = extraction finding nothing) before the late-May `news-image.ts` fix, `3089ms` (real probing) after. Extraction is fixed; persistence + display were the remaining gaps.

**Fix (hybrid), commit `fce5ab9`:**
- `news-discover` — restored the branded category-card safety net at both drop points, so valid briefs always persist.
- `apercudecouverte-v3` — `imagePolicy` `asStored` → **`safeFallback`**: show the real photo when present, a branded card otherwise, never hide a story.

**Follow-up (not yet done) — "news-image V2":** raise real-photo coverage so the feed leans on actual photos, not cards. Options: (a) ensure the **discover-time Supabase image mirror** (`uploadNewsImage`) is enabled + reliable (it already exists to defeat hotlinking — downloads then re-serves from our storage), (b) re-add an **OG:image tier** (removed in the May-6 2-tier simplification) to find images RSS feeds omit. The mirror is higher-leverage: it fixes both the no-image and the hotlink-403 problems at once.

---

## Search & filters audit (June 2026 — "Composer" review)

Usability review of the search/filter surfaces. Each claim was verified against code; fixes shipped in branch `fix/search-ux-honesty`. Deferred items tracked below.

### Fixed
- 🔴 **TMDB fallback on empty `/films/recherche`** — an empty DB result now shows an honest "Aucun film trouvé" instead of falling back to `/api/movies/popular`/`family`, which ignored every active filter (platform/age/topics/members) and surfaced unrated TMDB titles.
- 🟠 **Misleading "Adapté pour X"** on `/films` / `/series` / `/jeux` — these only narrow the age band (the full smart filter lives on `/films/recherche`). Label is now "Tranche d'âge pour X".
- 🟠 **`/recherche` (header) → `/api/db/media`** now applies the public gate (poster + `dataQualityScore` ≥30 + no manga), same bar as the sitemap — no more incomplete/age-less fiches in global search + recommendations.
- 🟡 **FilterSidebar desync** on "Effacer les filtres" — sidebar remounts (reset key) so its controls actually clear.
- 🟡 **Platform list** — both sidebars now derive from `FILTERABLE_PLATFORMS` (single source in `streaming-providers.ts`); Arte / Max / Paramount+ / OCS / Crunchyroll / ADN are now filterable.
- 🟡 **Smart filter search** now matches `originalTitle` too ("Spirited Away" → "Le Voyage de Chihiro").
- 🟢 **Dead code** — `ClientFilmsPage` / `ClientSeriesPage` / `ClientGamesPage` deleted (unmounted since the Aperçu rewrite).

### Deferred (open)
- 🟡 **Autocomplete is page-scoped** (`/films/recherche`): suggestions come from the current page of results, not the whole catalogue. Needs a dedicated title-suggestions endpoint. (P2)
- 🟡 **Smart filter caps at 500** (`/api/filter/smart` takes 500 then paginates in memory): pages past the window can be empty with no message. Needs DB-side scoring or at least a "résultats limités" notice. Rare in practice (per-member queries are narrow). (P2)
- 🟡 **Genre FR/EN mismatch**: topic/genre filtering is exact `hasSome`; the DB sometimes stores TMDB English names ("Comedy" vs "Comédie"), so some filters under-return. Needs normalization at import + a backfill. (P2)
- 🟢 **Cinéma + platform filter**: `/films?sort=cinema` titles have `platforms: []`, so a platform filter yields an empty grid (correct but confusing). A "filtre plateforme non applicable en salle" note would help. (P3)
- **Full personalization on `/films`**: wiring the smart filter (sensitivity + disliked-genre exclusion) into the category browse pages — currently age-only there. A real feature, deserves its own pass. (P2)

---

<details>
<summary>Archived: 2026-02 audit (historical — most items since resolved)</summary>

The Feb audit rated the project 82/100 and flagged, among others: no external error tracking (now: Sentry), weak testing 2/10 (now: ~16 Vitest + ~20 Playwright + CI), minimal CI/CD (now: full GitHub Actions CI + cron pipeline), no Vercel Analytics (now: Analytics + Speed Insights). Those gaps are closed; see the current scores above. Remaining Feb items still open: `topics` schema conflict (P3), broader Zod validation (P1), `mock-data.ts` cleanup (P2), OpenAPI docs (P3).

</details>
