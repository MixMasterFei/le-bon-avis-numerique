# Launch Checklist — Le Bon Avis Numerique

## CRITICAL (Before going live)

### 1. Domain & Email
- [ ] Purchase domain (lebonavisnumerique.com + .fr)
- [ ] Set up DNS on Vercel
- [ ] Configure custom email domain with Resend (noreply@, contact@)
- [ ] Create professional inbox (contact@lebonavisnumerique.com) — use Google Workspace or Zoho free
- [ ] Update FROM_EMAIL env var from `onboarding@resend.dev` to custom domain
- [ ] Set up email forwarding: presse@, privacy@, dpo@ -> main inbox

### 2. Auth & Environment
- [ ] Update NEXTAUTH_URL to production domain
- [ ] Update NEXT_PUBLIC_APP_URL to production domain
- [ ] Add Google OAuth callback URL for production domain in Google Cloud Console
- [ ] Test Google OAuth login end-to-end on production
- [ ] Test email/password signup + verification email flow
- [ ] Test password reset flow
- [ ] Verify all env vars are in Vercel project settings (not just .env)

### 3. Legal
- [ ] Fill in Mentions Legales: capital social, adresse, RCS, SIRET, nom du directeur
- [ ] Verify Politique de Confidentialite email addresses match actual domain
- [ ] Ensure cookie consent banner works (check /cookies page)

### 4. SEO (Technical)
- [ ] Add robots.ts (allow all, block /admin, /api)
- [ ] Add sitemap.ts (dynamic from DB media items)
- [ ] Verify OG metadata on homepage (test with https://cards-dev.twitter.com/validator)
- [ ] Submit sitemap to Google Search Console
- [ ] Submit site to Bing Webmaster Tools

### 5. Analytics
- [ ] Enable Vercel Web Analytics (dashboard toggle, zero code)
- [ ] Set up Google Search Console (verify domain ownership)
- [ ] Optional: Add Plausible or GA4 for deeper insights

## IMPORTANT (First week)

### 6. Content Seeding
- [ ] Ensure 50+ movies have full content metrics (enriched by AI)
- [ ] Ensure 20+ series have full content metrics
- [ ] Ensure 10+ games have full content metrics
- [ ] Verify collections show poster collages (not empty)
- [ ] Run weekly-import cron manually once to populate latest content

### 7. Social Media Accounts
- [ ] Instagram: @lebonavisnumerique
- [ ] TikTok: @lebonavisnumerique
- [ ] Facebook: Le Bon Avis Numerique
- [ ] Twitter/X: @BonAvisNum (or @LeBonAvisNum)
- [ ] LinkedIn: company page (for press/credibility)

### 8. First Marketing Push
- [ ] Prepare 5 Instagram carousel posts (new release reviews)
- [ ] Prepare 3 TikTok "A partir de quel age?" videos
- [ ] Write 1 blog-style guide (even if blog page is stub, use social)
- [ ] Draft press release (200 words, for French tech/parenting press)
- [ ] Identify 10 French parenting influencers to contact

## NICE TO HAVE (First month)

### 9. Performance & Monitoring
- [ ] Set up Vercel alerts for build failures
- [ ] Monitor API response times in Vercel dashboard
- [ ] Set up uptime monitoring (UptimeRobot free tier)
- [ ] Review rate limiting thresholds after real traffic data

### 10. Growth
- [ ] Set up newsletter signup (Resend audience or Buttondown)
- [ ] Add "Partager" (share) buttons on media detail pages
- [ ] Add structured data (JSON-LD Review schema) for Google rich results
- [ ] Create OG images per media item (poster + age badge composite)
