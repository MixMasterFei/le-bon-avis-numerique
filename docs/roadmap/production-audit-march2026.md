# Production Audit & Hardened Action Plan — March 2026

**Date:** 2026-03-03
**Source:** GPT-5 production audit + code analysis
**Status:** Implementation in progress

---

## Audit Summary

The project has solid foundations (Next/Prisma architecture, security middleware, structured cron, rich APIs), but several issues are blocking data quality and SEO before the site can scale.

**Production state observed:**
- Site public and accessible (totemavise.com) with clear value proposition
- Robots.txt OK — admin/api/profil correctly blocked
- DB health OK — 8,225 media items, 50,868 streaming items
- Admin APIs properly protected (401 without auth)

---

# PRIORITY 0 — Production Blockers

## P0-A: JWT Resilience for Onboarding

**Status:** SQL applied — code hardening needed

**Root cause:** The JWT callback in `src/lib/auth.ts` queries `onboardingCompleted` from the `users` table. If the DB query fails for any reason (timeout, schema mismatch, cold start), the entire JWT creation fails and login breaks.

**Fix:** Wrap each `onboardingCompleted` DB lookup in try-catch with fallback to `true` (safe default for existing users).

**Files:** `src/lib/auth.ts`

### Pre-checklist
- [x] SQL migration applied: `ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false; UPDATE users SET onboarding_completed = true;`
- [x] Middleware already has try-catch at lines 146-156

### Implementation
- Wrap JWT callback DB queries (lines 137-147, 149-157, 159-169) in try-catch
- Default `onboardingCompleted` to `true` on DB failure

### Post-checklist
- [ ] Local build passes (`npm run build`)
- [ ] Login works with correct DB
- [ ] Login doesn't crash if DB is temporarily slow

---

## P0-B: Sitemap Error Visibility

**Impact:** SEO indexation potentially blocked — sitemap errors are silently swallowed.

**Root cause:** The catch block in `src/app/sitemap.ts` swallows all errors with no logging.

**Files:** `src/app/sitemap.ts`

### Pre-checklist
- [x] Current sitemap query confirmed (lines 34-57)

### Implementation
- Add `console.error("[sitemap]", error)` to the catch block
- Log the error class and message for Vercel log visibility

### Post-checklist
- [ ] Sitemap still returns static pages on DB failure
- [ ] Errors are visible in Vercel logs

---

## P0-C: Enrichment Pass 1 → Pass 2 Chain Fix

**Problem:** Pass 1 (`src/app/api/admin/enrich/route.ts`) creates ContentMetrics but **never sets `isEnriched = true`** on the MediaItem. Pass 2 and backfill scripts query `WHERE isEnriched = true` → find 0 items → never run.

**Files:**
- `src/app/api/admin/enrich/route.ts`
- `scripts/backfill-enrichment.ts`

### Pre-checklist
- [x] Confirmed: `isEnriched` never set to `true` after enrichment
- [x] Backfill script queries `isEnriched: true` in all three modes

### Implementation
1. In `enrich/route.ts`: add `isEnriched: true` to the `prisma.mediaItem.update()` at line 411
2. In `backfill-enrichment.ts` `fullReenrich()`: add `isEnriched: true` to the `prisma.mediaItem.update()` at line 300

### Post-deploy SQL
```sql
-- Run after code deploys to fix existing enriched items
UPDATE media_items SET is_enriched = true
WHERE id IN (SELECT media_id FROM content_metrics WHERE enrichment_source != 'METADATA_ONLY');
```

### Post-checklist
- [ ] New enrichments set `isEnriched = true`
- [ ] Pass 2 (`enrich-deep`) can find items to process
- [ ] Backfill script works with corrected data

---

## P0-D: CI Environment Variable Mismatch

**Problem:** `.github/workflows/ci.yml` injects `NEXTAUTH_SECRET` but runtime validation requires `AUTH_SECRET` (NextAuth v5 migration).

**Files:** `.github/workflows/ci.yml`

### Implementation
- Change `NEXTAUTH_SECRET: "ci-secret-placeholder"` → `AUTH_SECRET: "ci-secret-placeholder"`

### Post-checklist
- [ ] CI build passes on next push

---

# PRIORITY 1 — Data Quality & Search

## P1-A: Topic Taxonomy Validation

**Problem:** Topics stored as `String[]` on MediaItem with zero validation. The enrichment AI generates whatever it wants:
- Mixed casing: "Noël" vs "noël"
- Temporal labels: "Meilleur 2026", "meilleur-2025"
- Studio names as topics, slug variants: "comedie-ado"

**Root cause:** V2 enrichment fields (toneTags, pacing, emotionalThemes) use `filterToValidList()`. **Topics don't.**

**Files:**
- `src/app/api/admin/enrich/route.ts`
- `src/app/api/admin/enrich-deep/route.ts`
- `scripts/backfill-enrichment.ts`

### Implementation (3 parts)

#### 1. Canonical topics whitelist
Create a shared `VALID_TOPICS` constant matching the prompt's allowed tags:
```typescript
const VALID_TOPICS = [
  // Genres/themes
  "Animation", "Aventure", "Comédie", "Fantastique", "Science-Fiction",
  "Famille", "Éducatif", "Super-héros", "Magie", "Sport", "Musique",
  "Histoire", "Amitié",
  // Emotional/social
  "Émotions", "Courage", "Différence", "Handicap", "Deuil", "Divorce",
  "Harcèlement", "Premiers amours",
  // Life stages
  "École", "Adolescence",
  // Worlds/imagination
  "Espace", "Aviation", "Mythologie", "Contes", "Pirates", "Chevaliers",
  "Dinosaures", "Robots", "Enquête/Mystère", "Espionnage",
  // Nature/environment
  "Animaux", "Nature", "Écologie", "Mer/Océan", "Montagne", "Voyage",
  // Arts/culture
  "Cuisine", "Art", "Danse", "Théâtre",
  // History/society
  "Guerre", "Résistance", "Seconde Guerre mondiale",
  // Studios
  "Disney", "Pixar", "DreamWorks", "Studio Ghibli",
  // Seasonal
  "Noël", "Halloween",
  // Games
  "Nintendo", "PlayStation", "Xbox", "PC",
]
```

#### 2. Validate on all write paths
Apply `filterToValidList()` to topics before DB write in all three files.

#### 3. Remove year labels from prompt
Delete the `"Meilleur ${releaseYear}"` line from enrichment prompts in:
- `enrich/route.ts` (line 157)
- `backfill-enrichment.ts` (line 503)

### Post-deploy SQL
```sql
-- Clean up existing year labels and common drift
UPDATE media_items SET topics = array_remove(topics, 'Meilleur 2025');
UPDATE media_items SET topics = array_remove(topics, 'Meilleur 2026');
UPDATE media_items SET topics = array_remove(topics, 'meilleur-2025');
UPDATE media_items SET topics = array_remove(topics, 'meilleur-2026');
```

### Post-checklist
- [ ] New enrichments only produce whitelisted topics
- [ ] Year labels no longer generated
- [ ] Existing data cleaned via SQL

---

## P1-C: Tones Not Wired in Search

**Problem:** HomepageV2 generates links like `?tones=Doux et chaleureux`, but the movies API doesn't handle the `tones` parameter.

**Files:** `src/app/api/db/movies/route.ts`

### Implementation
Add `tones` parameter handling after the existing `topics` handler (~line 159):
```typescript
const tones = searchParams.get("tones")
if (tones) {
  const toneList = tones.split(",").map(t => t.trim())
  where.AND = [
    ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
    { contentMetrics: { toneTags: { hasSome: toneList } } }
  ]
}
```

### Post-checklist
- [ ] `/api/db/movies?tones=Doux%20et%20chaleureux` returns filtered results
- [ ] Build passes

---

# FEATURE — Media Page Hero Redesign

## Problem
FamilyFitCard — the site's unique moat — is buried in the sidebar. On mobile, users scroll past all main content to see it.

## Solution
Restructure the media page hero from 2 columns to 3 columns, placing Family Fit at the same visual level as poster and synopsis.

**Desktop layout:**
```
┌──────────────────────────────────────────────────────┐
│  HERO (dark gradient)                                │
│  ┌──────────┬─────────────────────┬────────────────┐ │
│  │ Poster   │ Title, Synopsis     │ Adapté à ma    │ │
│  │ 1/4      │ Age, Genres, Rating │ famille ?      │ │
│  │          │ Actions, Providers  │                │ │
│  │          │                     │ Emma    ✅ 85  │ │
│  │          │                     │ Léo     ✅ 72  │ │
│  │          │                     │ Mia     ⚠️ 58  │ │
│  └──────────┴─────────────────────┴────────────────┘ │
└──────────────────────────────────────────────────────┘
```

**Mobile:** Poster → Info → Family Fit (stacked vertically)

**New component:** `src/components/media/FamilyFitHero.tsx` — dark-themed variant with glass/frosted styling (`bg-white/10 backdrop-blur-md`), score pills adapted for dark background.

**Files:**
- `src/components/media/FamilyFitHero.tsx` (new)
- `src/app/media/[id]/page.tsx` (restructure hero grid, remove FamilyFitCard from sidebar)

### Pre-checklist
- [x] FamilyFitCard component understood (sidebar version stays for fallback)
- [x] Hero layout understood (2-col: poster + info)

### Post-checklist
- [ ] Desktop: 3-column hero with Family Fit visible
- [ ] Mobile: stacked layout (poster → info → Family Fit)
- [ ] Not-logged-in state shows CTA with dark theme styling
- [ ] Build passes

---

# PRIORITY 2 — Cosmetic

## P2-A: README Drift
README badges, stack versions, and instructions are outdated. Low priority.

---

# Implementation Order

| Step | Item | Effort | Impact |
|------|------|--------|--------|
| 1 | P0-A: Resilient JWT | 10 min | Prevents login crashes |
| 2 | P0-B: Sitemap logging | 2 min | Diagnose SEO issues |
| 3 | P0-C: isEnriched fix + SQL | 10 min | Unblocks Pass 2 |
| 4 | P0-D: CI env var | 1 min | Prevents CI breakage |
| 5 | P1-A: Topics validation | 30 min | Clean taxonomy |
| 6 | P1-C: Tones in search API | 10 min | Enables tone-based browsing |
| 7 | Feature: 3-col hero | 1-2 hours | Family Fit front and center |

---

# SQL Migrations

**After P0-C code deploys:**
```sql
UPDATE media_items SET is_enriched = true
WHERE id IN (SELECT media_id FROM content_metrics WHERE enrichment_source != 'METADATA_ONLY');
```

**After P1-A code deploys:**
```sql
UPDATE media_items SET topics = array_remove(topics, 'Meilleur 2025');
UPDATE media_items SET topics = array_remove(topics, 'Meilleur 2026');
UPDATE media_items SET topics = array_remove(topics, 'meilleur-2025');
UPDATE media_items SET topics = array_remove(topics, 'meilleur-2026');
```
