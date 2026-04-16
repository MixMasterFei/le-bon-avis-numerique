# SEO Issues - totemavise.com

Audit automatise du 7 mars 2026 via `lbsn-seo` skill (`parse_html.py`).

## Homepage (totemavise.com)

### Problemes detectes (6)

| # | Probleme | Detail | Priorite |
|---|----------|--------|----------|
| 1 | Titre trop long | 75 caracteres (max 60) | Haute |
| 2 | Meta description trop longue | 166 caracteres (max 160) | Moyenne |
| 3 | Canonical manquant | Pas de `<link rel="canonical">` | Haute |
| 4 | Pas de H1 | Aucune balise `<h1>` sur la page d'accueil | Haute |
| 5 | Image sans alt | 1 image sans attribut alt | Moyenne |
| 6 | og:image manquant | Pas de meta `og:image` (partage social) | Haute |

### Stats

- Mots : 420
- Images : 6 (1 sans alt)
- Liens internes : 47
- Liens externes : 3
- JSON-LD : 1 bloc (Organization)

### Corrections a appliquer

**Titre** (`src/app/layout.tsx` metadata.title.default)
- Actuel : "Totem Avise - Trouvez les films, series et jeux parfaits pour votre famille" (75 car.)
- Proposition : "Totem Avise - Films et series pour toute la famille" (50 car.)

**Meta description** (`src/app/layout.tsx` metadata.description)
- Actuel : 166 caracteres
- Raccourcir a 155 caracteres max

**Canonical**
- Ajouter `alternates: { canonical: "/" }` dans le metadata de layout.tsx
- Ou ajouter par page via `generateMetadata()`

**H1**
- Ajouter une balise H1 visible sur la page d'accueil (hero section)

**og:image**
- Ajouter une image OG par defaut dans le metadata de layout.tsx
- Creer une image 1200x630 representant la marque

---

## Prochaines etapes

- [ ] Corriger les 6 problemes ci-dessus
- [ ] Lancer un audit complet avec `seo audit` sur les pages media
- [ ] Verifier le sitemap (`seo sitemap https://totemavise.com/sitemap.xml`)
- [ ] Tester les Core Web Vitals (`seo speed https://totemavise.com`)
- [ ] Ajouter les regles AI crawler dans robots.txt (GPTBot, ClaudeBot, etc.)
