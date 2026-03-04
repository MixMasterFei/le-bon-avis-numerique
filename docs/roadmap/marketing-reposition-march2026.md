# Marketing Repositioning & Growth Strategy — March 2026

## Summary

Full repositioning of Totem Avisé from "review/analysis site" to **"personalized family media recommendation engine"**. Rewrote all website copy, updated SEO metadata, added social presence, and added structured data.

## Positioning Change

| Before | After |
|--------|-------|
| "Avis et recommandations médias" | "Trouvez les films, séries et jeux parfaits pour votre famille" |
| "Analyse détaillée", "critères d'évaluation" | "Recommandations personnalisées", "Comment ça marche" |
| "Le guide média de confiance" | "Moteur de recommandation pour les familles" |
| Problem-first framing ("parents naviguent à l'aveugle") | Solution-first framing ("trouvez le contenu parfait") |
| CTAs: "Rejoindre la communauté", "Nos critères" | CTAs: "Créer mon profil famille", "Découvrir les films" |

**Core identity:** "Find the perfect content for your family"
**Tone:** Trusted parenting tool x Fun family companion (future: Pinterest-like discovery)

## Code Changes (March 4, 2026)

### Pages Rewritten
- **`/a-propos`** — Full rewrite. "Pourquoi ce projet?" → "L'histoire de Totem Avisé". Steps: "Analyse détaillée → Enrichissement → Recommandation" → "Créez votre profil → Recevez des recommandations → Découvrez ensemble". Stats updated to 8,000+. Coverage now shows 4 types with proper icons.
- **`/nos-valeurs`** — Title changed to "Comment ça marche". Philosophy section reframed from evaluation to recommendation engine. Community section: "évaluez les contenus" → "partagez les réactions de votre famille". FAQ rewritten.
- **`/objectif`** — Title changed to "Notre mission". "Le constat / Notre réponse" → "Ce que nous croyons / Ce que nous proposons". Pillars: "Analyse détaillée" → "Recommandations personnalisées". Differences list rewritten.

### Homepage Updates
- **TrustBanner** — "Votre guide de confiance" → "Trouvez le contenu parfait pour chaque membre de votre foyer". Trust points updated: "Évaluations objectives" → "Recommandations libres de toute influence". CTA: "Créer mon profil famille".
- **Layout metadata** — Title, description, keywords all updated from review/analysis language to recommendation/discovery language. Keywords now target discovery queries ("quoi regarder en famille", "film pour enfant", "recommandation par âge").

### SEO & Structured Data
- **Organization JSON-LD** added to root layout (name, logo, description, social links, contact)
- **FAQPage JSON-LD** already existed on /guides (confirmed)
- **OG metadata** updated: description now recommendation-focused
- **Keywords** shifted from review terms ("avis", "critiques", "CSA", "PEGI") to discovery terms ("recommandation film famille", "quoi regarder en famille")

### Social Presence
- **Footer social icons** added: Instagram, TikTok, Facebook (links to @totemavise accounts)
- **Footer tagline** updated: "Le guide indépendant..." → "Trouvez les films, séries et jeux parfaits..."
- **Footer nav** updated: "Nos valeurs" → "Comment ça marche"

### Files Modified
| File | Change |
|------|--------|
| `src/app/a-propos/page.tsx` | Full rewrite |
| `src/app/nos-valeurs/page.tsx` | Intro, philosophy, community, FAQ rewritten |
| `src/app/objectif/page.tsx` | Full rewrite |
| `src/components/home/TrustBanner.tsx` | Copy + CTAs updated |
| `src/components/layout/Footer.tsx` | Social icons + tagline + nav link |
| `src/app/layout.tsx` | Title, description, keywords, OG, Organization JSON-LD |

## Non-Code Actions Completed
- [x] Plausible analytics setup
- [x] Google Search Console indexing requests submitted
- [x] Sitemap submitted (5,019 pages discovered)
- [x] Bing Webmaster Tools verification

## Non-Code Actions Pending

### Immediate (This Week)
- [ ] Create @totemavise accounts: Instagram, TikTok, Facebook
- [ ] Post 5 recommendation-focused carousel posts on Instagram
- [ ] Post to r/france, r/ParentingFR, Doctissimo, MagicMaman forums

### Short-term (2-4 Weeks)
- [ ] Contact CLEMI (clemi.fr) for potential .gouv backlink
- [ ] Email 10 French parenting influencers
- [ ] Write press release ("moteur de recommandation famille")
- [ ] Submit to Product Hunt, BetaList, IndieHackers, Maddyness "Lancement"
- [ ] Test OG tags with Twitter Card Validator + Facebook Sharing Debugger

### Medium-term (1-3 Months)
- [ ] Launch blog with 5-10 SEO articles targeting discovery queries
- [ ] Newsletter infrastructure (Brevo API + footer/homepage signup form)
- [ ] Create 10 SEO blog posts (see keyword targets below)
- [ ] Complete or remove 2 unfinished guides
- [ ] Add founder bio to /a-propos

## SEO Keyword Targets

| Query | Intent | Priority |
|-------|--------|----------|
| "quoi regarder ce soir en famille" | Discovery | HIGH |
| "film pour enfant [age] ans" | Age-based | HIGH |
| "meilleur film animation famille" | Best-of | HIGH |
| "série netflix pour enfant [age]" | Platform + age | HIGH |
| "jeu vidéo en famille ce weekend" | Occasion | MEDIUM |
| "à partir de quel âge [titre]" | Title-specific | MEDIUM |
| "recommandation film famille" | Generic | MEDIUM |

## Business Model (Future)

### Phase 1: Free (Month 0-6) — Current
- Monthly cost: ~$11/month (Plausible + domain)

### Phase 2: Soft Monetization (Month 6-12)
- **Affiliate streaming links** on media pages (Amazon Associates, Apple TV+, Canal+)
- Estimated: $50-300/month at 10K-30K monthly visitors

### Phase 3: Premium (Month 12-18)
- **Freemium model** ($4.99/month or $39.99/year)
- Free: browse + 1 family profile + basic age filtering
- Premium: unlimited profiles, smart filters, movie night planner, personalized weekly email
- Estimated: $300-2,500/month depending on user base

### Phase 4: B2B (Month 18+)
- Educational licenses for schools/libraries
- API licensing for parental control apps
- Sponsored curated lists from streaming platforms
