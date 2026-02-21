# UX & Visual Audit — Le Bon Avis Numérique

**Date:** February 21, 2026
**Scope:** Full site review — 18 pages, all components, navigation, auth flow, competitor comparison

---

## CRITICAL — Must fix

### 1. Brand identity split: "Le Bon Avis" vs "Le Bon Sens"

The site uses two different names across pages:

| Location | Monogram | Name |
|----------|----------|------|
| Header, Footer, metadata, layout.tsx | **BA** | Le Bon Avis Numérique |
| Login page (`connexion/page.tsx`) | **BS** | Le Bon Sens |
| Signup page (`inscription/page.tsx`) | **BS** | Le Bon Sens |
| TrustBanner (`TrustBanner.tsx`) | — | Le Bon Sens Numérique |
| GitHub repo | — | le-bon-avis-numerique |
| Project folder | — | le-bon-sens-numerique |

**Action:** Pick one name and update all occurrences across the codebase.

### 2. Broken redirect on `/chez-vous`

`src/app/chez-vous/page.tsx` line 29 redirects to `/auth/signin` (NextAuth default) instead of `/connexion`. This **404s** for unauthenticated users.

**Fix:** Change to `redirect("/connexion?callbackUrl=/chez-vous")`

### 3. Dead link to `/conditions` on signup

The terms checkbox in `inscription/page.tsx` line 470 links to `/conditions` which doesn't exist. No `src/app/conditions/page.tsx` found. Users are asked to accept terms they can't read.

**Fix:** Change link to `/mentions-legales` (which exists) or create a `/conditions` page.

### 4. Admin UI exposed to all users

- **Login page** shows a visible "Connexion administrateur" checkbox to everyone (line 256-269)
- **Collections empty state** links to `/admin/enrich` for all users

**Fix:** Remove admin checkbox from public login. Show user-friendly empty state for collections.

### 5. Series page filters broken for DB source

`src/app/series/page.tsx` useEffect (line 107) only depends on `[currentPage, filters.maxAge]`, missing `filters.searchQuery`, `filters.platforms`, and `filters.topics`. Changing these filters does nothing when using DB data.

**Fix:** Add missing dependencies to the useEffect array, matching the films page pattern.

---

## HIGH — Should fix soon

### 6. Missing French accents across multiple pages

Dozens of user-facing strings lack proper accents. Affected pages:
- **Series page:** "Series TV", "Selection qualite", "Aucune serie trouvee"
- **Age page:** "Contenu adapte aux tout-petits", "histoires simples et colorees"
- **TrustBanner:** "Independant", "Evaluations objectives", "Educatif"
- **Inscription:** "Creer votre compte gratuit", "Deja un compte?"
- **Connexion:** "Mot de passe oublie?", "favoris sauvegardes"
- **Profil:** "Enregistre!", "Parametres du compte", "Deconnexion"
- **Collections:** "Decouvrez nos selections thematiques"
- **MediaCard:** "Adapte", "Modere", "Educatif", "Modeles+", "Scenes intimes"

Pages that DO have proper accents: Films, Jeux, Search — use these as reference.

### 7. Navigation discoverability gaps

Key features are invisible in the header navigation:

| Feature | In header? | In footer? | Has page? |
|---------|-----------|-----------|-----------|
| Livres | No | Yes | Yes (`/livres`) |
| Age browsing | No | Yes | Yes (`/age/[range]`) |
| Collections | No | Yes | Yes (`/collections`) |
| BD | Yes (coming soon) | Yes | Yes (`/bd`) |
| Guides | "Coming soon" in header | Yes | Yes (3 of 5 guides live!) |

**Recommendations:**
- Add Livres to header primary nav
- Add age-based browsing (the site's key differentiator!) as prominent header element
- Add Collections to header
- Move BD from primary nav to "Plus" dropdown (coming soon, wastes prime space)
- Remove "coming soon" label from Guides (it has live content)

### 8. "Base locale" developer badges visible to users

Green "Base locale" badges appear on Films, Series, Jeux, Search, and Age pages. Meaningless to users.

**Fix:** Remove all instances.

### 9. No related content for DB items on media detail page

"Vous pourriez aussi aimer" section only works for mock data (`source === "mock"`). Database items (vast majority) show nothing.

**Fix:** Implement related content query based on shared genres/age range.

### 10. Post-login redirect goes to homepage

After login, users land on `/` (generic homepage). Should redirect to `/chez-vous` (personalized dashboard) for a better returning-user experience.

### 11. ITEMS_PER_PAGE inconsistency

- Films: 24 per page
- Series: 12 per page
- Jeux: 12 per page

No reason for the difference. Standardize to 24 (or at least the same value).

---

## MEDIUM — Improve when possible

### 12. No onboarding for new users

After signup → verify email → login, users land on homepage with zero guidance. No prompt to:
- Set up family profile (add children with ages)
- Select streaming platforms
- Browse age-appropriate content
- Discover the "Chez vous" personalized dashboard

### 13. Grid column inconsistency across pages

| Page | Grid at xl |
|------|-----------|
| Films/Series/Jeux | 7 columns |
| Search/Age | 5 columns |
| Recommendations | 4 columns (lg) |
| Expert picks | 6 columns (lg) |

No consistent "media grid" pattern.

### 14. User dropdown missing key shortcuts

Logged-in users can't access favorites, watchlist, or family settings from the header dropdown. Takes 3+ clicks to reach commonly-used features.

**Suggested dropdown structure:**
- Chez vous
- Mes favoris
- Ma liste à voir
- Mon profil
- Paramètres famille
- (Admin if applicable)
- Déconnexion

### 15. Inconsistent auth route protection

| Route | Middleware protected? | Client redirect? |
|-------|---------------------|-----------------|
| `/profil` | Yes | — |
| `/mes-avis` | Yes | — |
| `/ma-liste` | No | Yes (flash of content) |
| `/mes-favoris` | No | Yes (flash of content) |
| `/chez-vous` | No | Yes (broken URL!) |

**Fix:** Add all auth-required routes to middleware `protectedRoutes`.

### 16. Mobile UX gaps

- Search bar always visible below header (wastes space)
- Hamburger button lacks `aria-label` and `aria-expanded`
- Mobile menu appears/disappears instantly (no animation)
- Login/signup buttons hidden on smallest screens without opening menu

### 17. Media detail shows 0.0/5 when no reviews

Displays "0.0 / 5 — Basé sur 0 avis" instead of hiding or showing "Pas encore d'avis".

### 18. Recommendations fetches 200 items at once

No pagination — could be slow and memory-intensive.

### 19. HeroSearch popular links point to wrong routes

Popular searches link to `/films/recherche?maxAge=7` etc. The correct route is `/films?maxAge=7` or `/recherche?maxAge=7`.

### 20. About page hardcoded stats

Shows "4 000+ Contenus analysés" which may not match the actual database.

---

## Additional findings

- **Favorites vs Watchlist grid inconsistency:** Favorites uses 7 columns at xl, Watchlist uses 5
- **Profile page uses raw `<img>` tag** instead of Next.js `<Image>` component
- **About page uses Film icon for both Films and Series** in coverage section
- **Blog page** is placeholder with no newsletter signup CTA
- **Homepage CTA** "En savoir plus" links to `/contact`
- **Unused code:** `TestimonialsSection` exported from `FamilyImageSection.tsx` but never used
- **SafetyBar inverted display:** High safety = long bar, but "Mature" label = short bar — confusing
