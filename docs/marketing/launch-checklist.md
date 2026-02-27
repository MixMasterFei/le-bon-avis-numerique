# Launch Checklist — Totem Avisé

> See also: [Deployment Roadmap](../roadmap/deployment-roadmap.md) for the full phased plan.

## CRITICAL (Before going live) — Phase A

### 1. Domain & Email
- [x] Purchase domain (totemavise.com)
- [x] Set up DNS on Vercel (auto-provisions SSL)
- [x] Configure custom email domain with Resend (noreply@, contact@)
- [x] Create professional inbox (contact@totemavise.com)
- [x] Update FROM_EMAIL env var to custom domain
- [x] Set up email forwarding: presse@, privacy@, dpo@ → main inbox

### 2. Auth & Environment
- [x] Update NEXTAUTH_URL to production domain
- [x] Update NEXT_PUBLIC_APP_URL to production domain
- [x] Add Google OAuth callback URL for production domain in Google Cloud Console
- [x] Test Google OAuth login end-to-end on production
- [x] Test email/password signup + verification email flow
- [x] Test password reset flow
- [x] Verify all env vars are in Vercel project settings (not just .env)
- [x] Verify `SITE_URL` + `CRON_SECRET` in GitHub Secrets (needed for cron workflows)

### 3. Legal
- [x] Fill in Mentions Légales: directeur de publication (Xavier Manzanares), personal project format (no company yet)
- [x] Verify Politique de Confidentialité email addresses match actual domain (all use contact@totemavise.com)
- [x] Ensure cookie consent banner works (check /cookies page)

### 4. SEO (Technical)
- [x] Add robots.ts (allow all, block /admin, /api)
- [x] Add sitemap.ts (dynamic from DB media items)
- [x] Add `metadataBase` to layout.tsx for absolute OG URLs + twitter card config
- [ ] Verify OG metadata on homepage (test with https://cards-dev.twitter.com/validator)
- [x] Submit sitemap to Google Search Console
- [x] Submit site to Bing Webmaster Tools

### 5. Analytics
- [x] Vercel Web Analytics integrated (`@vercel/analytics` in layout.tsx)
- [x] Verify Vercel Analytics is enabled in dashboard
- [x] Set up Google Search Console (verify domain ownership)
- [ ] Set up Plausible ($9/month) — CNIL-exempt, no cookie consent needed in France

### 6. Content Seeding
- [x] Ensure 50+ movies have full content metrics (enriched by AI) — check via `/api/admin/health`
- [x] Ensure 20+ series have full content metrics
- [x] Ensure 10+ games have full content metrics
- [x] Verify collections show poster collages (not empty)
- [ ] Run weekly-import cron manually once to populate latest content

---

## SEO & SOCIAL SHARING (First week) — Phase B

### 7. Dynamic Metadata (highest ROI code work)
- [x] Add `generateMetadata()` to `/media/[id]/page.tsx` — dynamic OG title, description, image (poster)
- [x] Add JSON-LD structured data: Movie/TVSeries/VideoGame + AggregateRating on media pages
- [x] Add BreadcrumbList JSON-LD on media pages
- [x] Add FAQPage JSON-LD on guide pages
- [ ] Test OG tags with Twitter Card Validator + Facebook Debugger
- [x] SEO title template: "[Titre] — À partir de quel âge ? Avis parents | Totem Avisé"

---

## SOCIAL & MARKETING (Weeks 1-2) — Phase D

### 8. Social Media Accounts
- [ ] Instagram: @totemavise
- [ ] TikTok: @totemavise
- [ ] Facebook: Totem Avisé
- [ ] Twitter/X: @TotemAvise (or @LeBonAvisNum)
- [ ] LinkedIn: company page (for press/credibility)

### 9. First Marketing Push
- [ ] Prepare 5 Instagram carousel posts (poster + age badge + content breakdown + verdict)
- [ ] Prepare 3 TikTok "À partir de quel âge ?" 30s videos
- [ ] Draft press release (200 words) — pitch: "Un Common Sense Media à la française"
- [ ] Post on r/france, r/ParentingFR, Doctissimo, MagicMaman forums
- [ ] Contact CLEMI (clemi.fr) — perfect mission alignment, potential .gouv backlink
- [ ] Email 10 French parenting influencers (Instamamans, Papa Positive)
- [ ] Submit to BetaList, Product Hunt, IndieHackers, Maddyness "Lancement"

---

## GROWTH FEATURES (First month) — Phase E

### 10. User Engagement
- [ ] Newsletter signup with Brevo (French, GDPR-native, great deliverability to Orange/Free/SFR) — placeholder UI removed, needs full implementation (DB model + email sending)
- [ ] "Partager" (share) buttons on media detail pages — **not yet implemented**
- [ ] New user onboarding (prompt family setup + platform preferences) — **not yet implemented**
- [ ] Complete 2 remaining guides + FAQ page
- [ ] OG images per media item (poster + age badge composite)

### 11. Monitoring
- [ ] Set up UptimeRobot (free tier) — health endpoint exists at `/api/admin/health`
- [ ] Set up Vercel alerts for build failures
- [ ] Monitor API response times in Vercel dashboard
- [ ] Review rate limiting thresholds after real traffic data

---

## TECHNICAL DEBT (When convenient) — Phase F

- [ ] Add Sentry error tracking — **not installed**
- [x] Add Zod validation on API request bodies — partial (3 routes: content-metrics, content-requests, admin/content-requests)
- [x] Resolve Prisma topics table schema conflict (removed orphaned Topic model + TopicCategory enum)
- [x] Clean up `src/lib/mock-data.ts` — reduced from 19 importers to 3 (apps, livres, media/[id] fallback). Type extracted to `src/lib/types.ts`.
- [x] Add E2E tests with Playwright — 8 test files, ~46 smoke tests (homepage, nav, listings, detail, search, auth guards, static pages, responsive)

---

## Already Complete

| Item | Status |
|------|--------|
| Vercel hosting + vercel.json (cron configured) | Done |
| GitHub Actions CI (lint, typecheck, test, build) | Done |
| GitHub Actions cron (import, enrich, quality, streaming, similarity) | Done |
| Authentication (NextAuth + Google OAuth + email/password) | Done |
| Security (middleware, rate limiting, headers, CRON_SECRET) | Done |
| Admin dashboard (9 tools: import, enrich, dedupe, quality, tags, corrections, requests, streaming, logs) | Done |
| Email (Resend: verification, password reset, contact form) | Done |
| Legal pages (mentions légales, confidentialité, cookies) | Done (templates need business details) |
| robots.ts + sitemap.ts (dynamic from DB) | Done |
| Contact form (working with Resend + rate limiting + sanitization) | Done |
| Guides (3 complete, 2 in progress) | Done |
| Full UX overhaul (Phase 0 + Phase 1 + Phase 2) | Done |
| Media detail page (consolidated actions, empty rating CTA, callbackUrl, router.refresh) | Done |
| Age filter with min+max range slider on all listing pages | Done |
| Release date display on media cards + sort-by filter (date, title) | Done |
| Homepage FamilyImageSection text overlap fix | Done |
| Family Fit assessment card on media detail pages (per-member scoring) | Done |
| Similar Media section on detail pages (pre-computed + genre fallback) | Done |
| Family movie night recommendation algorithm fix (multi-factor scoring) | Done |
| Mobile responsive audit (grid cols, gaps, hero spacing) | Done |
| "Chez Vous" dashboard redesign (modern, warm aesthetic matching homepage) | Done |
| Removed non-functional notification settings from profile page | Done |
| Zod validation on select API routes (content-metrics, content-requests) | Done (partial) |
| Dynamic SEO metadata (generateMetadata, JSON-LD, title template) | Done |
| Share button on media detail pages (Web Share API + clipboard fallback) | Done |
| Prisma topics schema conflict resolved (removed orphaned Topic model) | Done |
| Mock-data cleanup (19 → 3 importers, type extracted to `src/lib/types.ts`) | Done |
| Playwright E2E tests (8 files, ~46 smoke tests covering key flows) | Done |
