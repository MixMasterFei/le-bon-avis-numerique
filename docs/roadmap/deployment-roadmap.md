# Deployment Roadmap — Totem Avisé

**Created:** Feb 21, 2026
**Goal:** Take the site from development to full public launch.
**Timeline:** ~4 weeks from domain purchase to marketing launch.

---

## Critical Path

```
Week 0:  Phase A (go-live blockers)      → Site is live on custom domain
Week 1:  Phase B (SEO) + C (analytics)   → Google starts indexing
Week 2:  Phase D (marketing launch)      → First users arrive
Month 1: Phase E (growth features)       → Retention & sharing loops
Ongoing: Phase F (tech debt)             → Stability & maintainability
```

---

## Phase A — Go-Live Blockers (~2-3 hours, no code changes)

> Do these before sharing the URL with anyone.

| # | Task | Effort | Where |
|---|------|--------|-------|
| A1 | ~~Buy domain~~ — totemavise.com purchased ✅ | Done | Vercel |
| A2 | Set DNS on Vercel + HTTPS auto-provisioned | 10 min | Vercel dashboard |
| A3 | Update `NEXTAUTH_URL` + `NEXT_PUBLIC_APP_URL` to production domain | 5 min | Vercel env vars |
| A4 | Add Google OAuth callback for production domain | 10 min | Google Cloud Console |
| A5 | Test full auth flow on production (Google login, email signup, password reset) | 20 min | Browser |
| A6 | Fill legal page placeholders (`[À compléter]` → real SIRET, RCS, address, director name) | 15 min | `src/app/mentions-legales/page.tsx` |
| A7 | Update `FROM_EMAIL` env var from `onboarding@resend.dev` to custom domain | 10 min | Vercel env vars + Resend dashboard |
| A8 | Set up email forwarding (contact@, presse@, privacy@ → your inbox) | 15 min | Google Workspace or Zoho free |
| A9 | Seed content: ensure 50+ movies, 20+ series, 10+ games have full content metrics | 30 min | Run enrichment via admin or cron |
| A10 | Verify `SITE_URL` + `CRON_SECRET` in GitHub Secrets | 5 min | GitHub repo settings |

**After Phase A:** Site is live, auth works, emails send from your domain, content is populated.

---

## Phase B — SEO & Social Sharing (~5 hours, code changes)

> Highest-ROI technical work. Do this in the first week.

| # | Task | Effort | Files |
|---|------|--------|-------|
| B1 | Add `generateMetadata()` to media detail page — dynamic OG title, description, image (poster) | 1 hr | `src/app/media/[id]/page.tsx` |
| B2 | Add JSON-LD structured data on media pages (Movie/TVSeries/VideoGame + AggregateRating) | 2 hrs | `src/app/media/[id]/page.tsx` |
| B3 | Add `metadataBase` in layout.tsx (makes all OG URLs absolute) | 5 min | `src/app/layout.tsx` |
| B4 | Submit sitemap to Google Search Console | 15 min | Google Search Console |
| B5 | Submit to Bing Webmaster Tools | 10 min | Bing Webmaster Tools |
| B6 | Add BreadcrumbList JSON-LD site-wide | 1 hr | Layout or per-page |
| B7 | Test OG tags with Twitter Card Validator + Facebook Debugger | 15 min | Browser |

### Why this matters:
- **JSON-LD AggregateRating** = stars appear in Google search results = massive CTR boost
- **Dynamic OG metadata** = social shares show poster + title instead of blank card
- **Google Search Console** = Google knows your site exists and starts crawling

### SEO Title Template (for every media page):
```
[Titre] — À partir de quel âge ? Avis parents | Totem Avisé
```
This targets the highest-intent French parent search: "[film name] à partir de quel âge"

---

## Phase C — Analytics & Monitoring (~1 hour)

| # | Task | Effort | Cost |
|---|------|--------|------|
| C1 | Set up Plausible analytics | 30 min | $9/month |
| C2 | Set up Google Search Console (verify domain ownership) | 15 min | Free |
| C3 | Verify Vercel Analytics is enabled in dashboard | 5 min | Free (already in code) |
| C4 | Set up UptimeRobot (free tier) | 10 min | Free |

### Why Plausible over GA4:
- **CNIL-exempt** — no consent banner needed. In France, 40-60% of users refuse cookies → GA4 is blind to half your traffic.
- **EU-hosted** (Germany), no US data transfer issues
- **Cookie-free**, privacy-first
- Clean single dashboard vs GA4 complexity
- Keep Vercel Analytics as supplement for Web Vitals only

---

## Phase D — Social & Marketing Launch (~10 hours over 2 weeks, non-technical)

> Can be done in parallel with Phase B/C.

### Social Accounts
| # | Task | Effort |
|---|------|--------|
| D1 | Reserve @totemavise on Instagram, TikTok, Facebook, LinkedIn | 30 min |
| D2 | Reserve @TotemAvise or @LeBonAvisNum on X | 5 min |

### Content Creation
| # | Task | Effort |
|---|------|--------|
| D3 | Create 5 Instagram carousel posts (poster + age badge + content breakdown + verdict) | 3 hrs |
| D4 | Create 3 TikTok "À partir de quel âge ?" 30s videos | 2 hrs |
| D5 | Draft press release (200 words) — pitch: "Un Common Sense Media à la française" | 1 hr |

### Outreach
| # | Task | Effort |
|---|------|--------|
| D6 | Post on r/france, r/ParentingFR, Doctissimo, MagicMaman forums | 1 hr |
| D7 | Contact CLEMI (clemi.fr) — perfect mission alignment, potential .gouv backlink | 30 min |
| D8 | Email 10 French parenting influencers (Instamamans, Papa Positive, cool_parents_make_happy_kids) | 1 hr |
| D9 | Submit to BetaList, Product Hunt, IndieHackers, Maddyness "Lancement" | 1 hr |

### Press Targets (pitch angle for each):
| Target | Angle |
|--------|-------|
| Maddyness, French Web, Siecle Digital | French startup building the "Common Sense Media à la française" |
| Numerama, FrAndroid, 01net | French digital culture, independent media guide |
| MagicMaman, Parents Magazine, Enfant.com | Free independent guide for families |
| CLEMI, Café Pédagogique, Réseau Canopé | Educational resource for media literacy |

---

## Phase E — Growth Features (~15 hours, code + content)

| # | Task | Effort | Why |
|---|------|--------|-----|
| E1 | Newsletter signup with Brevo (French, GDPR-native, free 300/day) | 3 hrs | Retention channel |
| E2 | "Partager" (share) buttons on media detail pages | 1 hr | Organic sharing |
| E3 | New user onboarding (prompt family setup + platform preferences) | 4 hrs | Reduces bounce |
| E4 | Complete 2 remaining guides + FAQ page | 3 hrs | SEO content |
| E5 | OG images per media item (poster + age badge composite) | 3 hrs | Professional social shares |
| E6 | SEO title template on all media pages | 1 hr | Search intent capture |

### Why Brevo for newsletter (not Resend):
- **Keep Resend for transactional** (verification, password reset, contact form)
- **Add Brevo for newsletter**: French company, GDPR-native, EU data storage
- Free tier: 300 emails/day (~2,000 weekly subscribers for free)
- Superior deliverability with French ISPs (Orange, Free, SFR, Laposte.net)
- Built-in automation for welcome sequences, segmentation by child age

### Newsletter Content Ideas:
- "Cette semaine au cinéma pour les familles"
- "Les 5 meilleurs [category] du mois"
- "Guide saisonnier" (vacances, rentrée, Noël)
- "Nouveautés [streaming platform] ce mois-ci"

---

## Phase F — Technical Debt (ongoing, when convenient)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| F1 | Add Sentry error tracking | 1 hr | Know about errors before users report them |
| F2 | Add Zod validation on API request bodies | 3 hrs | Prevent malformed data, better error messages |
| F3 | Resolve Prisma topics table schema conflict | 1 hr | Unblocks `prisma db push` |
| F4 | Clean up `src/lib/mock-data.ts` | 30 min | Remove dead code |
| F5 | Add E2E tests with Playwright | 4 hrs | Catch regressions |
| F6 | CNC open data import (95K French film classifications) | 3 hrs | Fix false "Tous publics" ratings |

---

## Budget Summary

| Item | Cost | When |
|------|------|------|
| Domain (.com + .fr) | ~20 EUR/year | Phase A |
| Plausible analytics | $9/month | Phase C |
| Brevo newsletter | Free (300 emails/day) | Phase E |
| Vercel hosting | Free tier | Already active |
| Resend email | Free tier (3,000/month) | Already active |
| Buffer (social scheduling) | Free tier (3 channels) | Phase D |
| **Total at launch** | **~$11/month** | |

Scale tools when traffic justifies it:
- Vercel Pro ($20/month) for more crons + analytics
- Plausible scales with pageviews
- Brevo paid plan when >300 emails/day
- Swello ($10/month) when outgrowing Buffer
- Google Ads ($100-200/month) for targeted "avis film enfant" keywords

---

## Remaining UX Work (from Phase 1)

These are lower-priority items that can be done alongside or after deployment:

- [ ] Related content for DB items on detail page
- [ ] Search & filter experience improvements
- [ ] New user onboarding flow (see E3 above)
- [ ] Profile page redesign
- [ ] Family management UX
- [ ] Propagate user image through JWT
- [ ] Typography consistency
- [ ] Component design system
- [ ] Empty states and illustrations
- [ ] Theater movies section
- [ ] "En parler avec vos enfants" section
- [ ] Editorial one-liner on media cards

See [phase-1-ux-redesign.md](phase-1-ux-redesign.md) for the full list.

---

## Reference Documents

- [Roadmap README](README.md) — Current phase overview
- [Phase 1 - UX Redesign](phase-1-ux-redesign.md) — Remaining UX tasks
- [Marketing Playbook](../marketing/claude_mkt.md) — Brand voice, SEO strategy, social media plan
- [Launch Checklist](../marketing/launch-checklist.md) — Actionable checklist version
- [Market Analysis](../marketing/market-analysis.md) — Visibility tools, platforms, backlink strategies
- [Tech Audit](../tech-audit.md) — Technical debt items
- [Official Ratings Plan](official-ratings.md) — CNC data import plan
