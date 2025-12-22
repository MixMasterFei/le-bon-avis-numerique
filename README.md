# Le Bon Avis Numérique 🇫🇷

> Le guide média de confiance pour les familles françaises

Une plateforme web inspirée de Common Sense Media, adaptée au marché francophone. Elle fournit des évaluations par âge, des analyses de contenu (violence, langage, etc.) et des avis pour les Films, Séries TV, Jeux Vidéo, Livres et Applications.

![Next.js](https://img.shields.io/badge/Next.js-14+-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4+-38B2AC?style=flat-square&logo=tailwind-css)
![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=flat-square&logo=prisma)

## ✨ Fonctionnalités

- **Système de notation par âge** - Recommandations d'experts et de la communauté
- **Jauge de contenu** - Analyse visuelle (Violence, Sexe, Langage, etc.)
- **Badges réglementaires** - CSA pour films/TV, PEGI pour jeux
- **Filtres avancés** - Par âge, plateforme, thème
- **Avis communautaires** - Parents, enfants, éducateurs
- **Conformité RGPD** - Bannière de consentement cookies
- **Interface responsive** - Mobile-first design

## 🚀 Démarrage rapide

### Prérequis

- Node.js 18+ 
- npm ou yarn
- PostgreSQL (optionnel pour la démo)

### Installation

```bash
# Cloner le projet
cd le-bon-avis-numerique

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

### Configuration de la base de données (optionnel)

```bash
# Configurer la variable d'environnement
cp .env.example .env

# Éditer .env avec votre URL PostgreSQL
# DATABASE_URL="postgresql://user:password@localhost:5432/lebonsens"

# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma db push
```

## 📁 Structure du projet

```
src/
├── app/                    # Routes Next.js App Router
│   ├── page.tsx           # Page d'accueil
│   ├── films/             # Page Films
│   ├── series/            # Page Séries TV
│   ├── jeux/              # Page Jeux Vidéo
│   ├── livres/            # Page Livres
│   ├── apps/              # Page Applications
│   └── media/[id]/        # Page détail média
├── components/
│   ├── layout/            # Header, Footer
│   ├── media/             # Composants médias
│   │   ├── MediaCard.tsx
│   │   ├── ContentGrid.tsx
│   │   ├── AgeBadge.tsx
│   │   └── FilterSidebar.tsx
│   └── ui/                # Composants UI (shadcn-style)
├── lib/
│   ├── utils.ts           # Utilitaires et helpers
│   ├── mock-data.ts       # Données de démonstration
│   └── db.ts              # Client Prisma
└── prisma/
    └── schema.prisma      # Schéma de base de données
```

## 🎨 Design System

### Couleurs
- **Primary (Blue):** `#1e40af` - Confiance
- **Safe (Green):** `#16a34a` - Approuvé/Sûr
- **Caution (Orange):** `#ea580c` - Attention
- **Danger (Red):** `#dc2626` - Élevé

### Typographie
- **Headings:** Poppins
- **Body:** Inter

## 🔒 Conformité réglementaire

### CSA (Cinéma & TV français)
- Tous publics
- -10, -12, -16, -18

### PEGI (Jeux vidéo européens)
- PEGI 3, 7 (Vert)
- PEGI 12 (Jaune)
- PEGI 16 (Orange)
- PEGI 18 (Rouge)

### RGPD
- Bannière de consentement cookies
- Pages Mentions Légales et Politique de Confidentialité

## 📝 Scripts disponibles

```bash
npm run dev      # Serveur de développement
npm run build    # Build de production
npm run start    # Lancer la production
npm run lint     # Vérification ESLint
```

## 🚀 Déploiement Vercel

### Déploiement en un clic

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/le-bon-avis-numerique)

### Déploiement manuel

1. **Connectez votre repo GitHub à Vercel**
   - Allez sur [vercel.com](https://vercel.com)
   - Importez votre projet GitHub

2. **Configurez les variables d'environnement** dans les settings Vercel :
   ```
   DATABASE_URL=postgresql://...
   TMDB_API_KEY=votre_clé_tmdb
   ```

3. **Déployez !** Vercel détecte automatiquement Next.js

### Variables d'environnement Vercel

| Variable | Description | Requis |
|----------|-------------|--------|
| `DATABASE_URL` | URL PostgreSQL (Neon/Supabase recommandé) | Production |
| `TMDB_API_KEY` | Clé API TMDB pour films/séries | Oui |
| `IGDB_CLIENT_ID` | ID client Twitch pour jeux | Oui (jeux) |
| `IGDB_CLIENT_SECRET` | Secret client Twitch pour jeux | Oui (jeux) |
| `GOOGLE_BOOKS_API_KEY` | Clé API Google Books pour livres | Oui (livres) |
| `NEXTAUTH_SECRET` | Secret pour l'authentification | Si auth activée |

### Base de données recommandée

Pour Vercel, utilisez :
- **[Neon](https://neon.tech)** - PostgreSQL serverless gratuit
- **[Supabase](https://supabase.com)** - PostgreSQL avec extras

## 🔌 APIs Externes Intégrées

### TMDB (Films & Séries TV)
- **Site:** [themoviedb.org](https://www.themoviedb.org/settings/api)
- **Coût:** Gratuit avec attribution
- **Variable:** `TMDB_API_KEY`

```bash
# Endpoints disponibles
GET /api/movies/search?q=...     # Recherche films
GET /api/movies/popular          # Films populaires
GET /api/movies/family           # Films famille
GET /api/movies/[id]             # Détails film
GET /api/tv/search?q=...         # Recherche séries
GET /api/tv/[id]                 # Détails série
```

### IGDB (Jeux Vidéo)
- **Site:** [dev.twitch.tv/console](https://dev.twitch.tv/console)
- **Coût:** Gratuit avec attribution
- **Variables:** `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`

```bash
# Endpoints disponibles
GET /api/games/search?q=...      # Recherche jeux
GET /api/games/popular           # Jeux populaires
GET /api/games/family            # Jeux PEGI 3-7
GET /api/games/[id]              # Détails jeu
```

### Google Books (Livres)
- **Site:** [console.cloud.google.com](https://console.cloud.google.com/)
- **Coût:** Gratuit
- **Variable:** `GOOGLE_BOOKS_API_KEY`

```bash
# Endpoints disponibles
GET /api/books/search?q=...      # Recherche livres (français)
GET /api/books/children          # Livres jeunesse
GET /api/books/[id]              # Détails livre
```

### Outil d'Import
Visitez `/admin/import` pour rechercher et importer du contenu depuis toutes les APIs.

## 📄 Licence

Ce projet est sous licence MIT.

---

Fait avec ❤️ pour les familles francophones
