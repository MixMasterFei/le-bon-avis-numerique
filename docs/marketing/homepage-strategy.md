# Stratégie page d'accueil — Recherche & recommandations

> Analyse marketing + produit de ce que la page d'accueil de Totem Avisé devrait
> être, déclenchée par une intuition de Xavier : le rail du haut (« Pour ce
> week-end en famille ») « ne se met pas assez à jour » — un module ciné/salles
> serait-il préférable ? Rédigée au moment où le trafic organique commence à
> monter. Compagnon de `claude_mkt.md`, `market-analysis.md`, `launch-checklist.md`.

---

## Verdict

**Le problème est un décalage promesse / requête (« ce week-end » vs. tri par
votes), pas un manque de cinéma en tête de page.** Le rail du haut n'est pas
« mort » : il est déjà *time-aware* (soir / week-end / vacances), cache 10 min,
clé journalière. Mais plusieurs de ses 4 cases sont remplies par des requêtes
gelées (`tmdbVoteCount desc`, sans rotation), donc on revoit *Les Simpson* et
*Forza* tous les jours → sensation de stagnation.

Trois mouvements, par ordre d'impact :

1. **Réparer la fraîcheur des requêtes** du rail (le plus petit diff, le plus
   fort effet) — garder la forme, changer ce qui *gagne* une case.
2. **Remonter le module cinéma live** (`ApercuNowInCinema`, `/api/cinema`) —
   c'est notre signal le plus différenciant et le seul vraiment frais à la
   journée (l'affiche du jour en salles + âge expert, qu'AlloCiné ne fait pas).
3. **Faire remonter la preuve sociale** (« aimés par les parents cette semaine »),
   aujourd'hui enterrée en position #10 — maintenant qu'on a des clics à montrer.

Ce qu'on **ne touche pas** : le hero « recherche d'abord » (correct, aligné sur
Common Sense Media, sert les deux modes d'arrivée parents).

---

## 1. Comment Common Sense Media structure sa page d'accueil

CSM est la référence mondiale du guide média familial. Sa home (relevée en mai
2026) ne mène **pas** par un feed « ce soir on regarde quoi », mais par la
confiance et la décision :

1. **Hero de confiance + entrée par catégorie** — « Ratings and reviews parents
   trust » + boutons Movies / TV / Books / Guidance / Gaming / Social Media.
   Aucune logique horaire.
2. **Curation éditoriale** — « Our Editors Recommend ».
3. **Sélection qualité** — « Common Sense Selections » (sceau qualité).
4. **Preuve sociale** — « Popular with Parents » (haut de page, pas en bas).
5. **Mission / confiance** — « leading independent source… since 2003 ».
6. **Distribution** — logos partenaires (Apple TV+, Fandango, Target…).

**Enseignement :** chez CSM la fraîcheur vient de *« New »* + *« Best of [année] »*
+ *popularité*, **pas** d'une rotation horaire. Le rôle de la home est le
**support à la décision et la confiance**, pas un flux Netflix.

Sources :
- [Common Sense Media — accueil](https://www.commonsensemedia.org/)
- [New Kids' Movies](https://www.commonsensemedia.org/lists/new-kids-movies)
- [Best of 2025](https://www.commonsensemedia.org/best-of-2025)

---

## 2. Ce que les parents cherchent vraiment

Les parents arrivent dans **deux modes** distincts :

- **Titre connu** — « *Ce* film est-il OK pour mon enfant de 8 ans ? » → ils
  **cherchent** un titre précis (barre de recherche, SEO « [titre] à partir de
  quel âge »). Ils ne parcourent pas la home.
- **Découverte** — « Qu'est-ce qu'on peut regarder ce week-end ? » → ils veulent
  des **listes curées, filtrées par âge**.

Fonctionnalités que les parents valorisent (recoupement de plusieurs sources) :

| Attente parent | Statut Totem |
|---|---|
| Détail par critère (violence, langage, sexe, substances…) | ✅ cœur du produit (7 critères) |
| Recommandation d'âge précise (pas juste « PG-13 ») | ✅ `expertAgeRec` |
| Contexte « Ce que les parents doivent savoir… » | ⚠️ présent en fiche, peu mis en avant en home |
| Filtres faciles (« sans violence », « jeunes enfants ») | ✅ filtres `/films` |
| Perspectives multiples (avis parents + enfants) | ◻️ communautaire encore jeune |

**Conséquence pour la home :** le hero recherche sert le mode 1 (déjà bon). Le
rail et les sections de découverte servent le mode 2 — et c'est là que vit
l'intuition « cinéma ».

Sources :
- [Kids-in-Mind — Parents' Movie Guide](https://kids-in-mind.com/)
- [HealthyChildren — Media ratings guide](https://www.healthychildren.org/English/family-life/Media/Pages/TV-Ratings-A-Guide-for-Parents.aspx)
- [Common Sense Media — Browse Reviews](https://www.commonsensemedia.org/movie-reviews)

---

## 3. Diagnostic : pourquoi le rail *semble* gelé

Le rail est `ApercuTimeAwareHero` (`src/components/home-v2/ApercuTimeAwareHero.tsx`).
Il choisit un état selon l'heure de Paris (`tonight` / `weekend` / `holidays` /
défaut) et remplit 4 cases. Détail par tranche :

| Tranche | Fonction | Tri | Résultat |
|---|---|---|---|
| Ciné | `fetchCinemaSlice` (`:288`) | `releaseDate desc` | ✅ **frais** — tourne avec les sorties catalogue |
| Séries | `fetchFamilyTV` (`:92`) | `tmdbVoteCount desc` | ❌ **gelé** → *Les Simpson* chaque jour |
| Film streaming (soir) | `fetchTonight` (`:141`) | `tmdbVoteCount desc` | ❌ **gelé** |
| Film (vacances) | `fetchHolidays` (`:218`) | `tmdbVoteCount desc` | ❌ **gelé** |
| Jeux | `fetchFamilyGames` (`:111`) | `releaseDate desc` (petit catalogue) | ⚠️ **quasi gelé** → *Forza* |

**Nuance clé (piège à éviter) :** le commentaire `void dayKey` (`~:317`) laisse
croire que la rotation est automatique. La clé de cache `getHeroData` inclut bien
`parisIsoDay`, donc le cache **s'invalide chaque jour** — mais comme la *requête*
ne contient aucun shuffle, on **ré-exécute la même sélection**. **Invalidation ≠
diversité.** C'est la cause racine : la promesse (« CE WEEK-END ») annonce de la
nouveauté que le tri par votes ne livre pas.

---

## 4. Cinéma : deux choses différentes (à ne pas confondre)

C'est la confusion la plus coûteuse à éviter avant le pass implémentation :

- **La case ciné du rail** (`fetchCinemaSlice`) est une **requête DB** sur les
  films sortis dans les 6 derniers mois (`releaseDate desc`). Elle « tourne avec
  les sorties catalogue », mais ce n'est *pas* l'affiche du jour en salles.
- **`ApercuNowInCinema`** (`src/components/home-v2/ApercuNowInCinema.tsx`) est le
  vrai différenciateur : **TMDB `now_playing` live via `/api/cinema`** = *l'affiche
  du jour en salles françaises + l'âge expert*. C'est exactement ce qu'AlloCiné ne
  fait pas.

**Recommandation :** promouvoir **`ApercuNowInCinema`**, pas la case du rail.
*Option future* : aligner aussi la case ciné du hero sur `/api/cinema` pour
unifier la source « salles ».

---

## 5. Ordre des sections : actuel vs. proposé

Les 11 blocs sont ordonnés dans **`HomepageApercu.tsx`** — **pas** dans
`page.tsx`, qui se contente de composer `HomepageApercu` et de lui passer le hero
en `topSlot`.

**Ordre actuel :**

1. Hero recherche
2. Rail time-aware (`topSlot`)
3. Coups de cœur (`ApercuExpertPicks`)
4. Cinéma (`ApercuNowInCinema`)
5. Par âge (`ApercuAgeGrid`)
6. Streaming (`ApercuStreaming`)
7. Jeux récents
8. Mangas (admin seulement)
9. Collections
10. Pulse (`ApercuPulse`) — stats + « plus aimés » + « fraîchement ajoutés »
11. CTA

**Ordre proposé (hero intact) :**

1. Hero recherche — *inchangé*
2. **Rail time-aware** — *avec fraîcheur réparée (§6)*
3. **Cinéma live** ↑ (remonté de #4) — le signal le plus frais/différenciant
4. **Preuve sociale légère** ↑ (extraite de Pulse #10, voir §7) — « aimés par
   les parents cette semaine » + « fraîchement ajoutés »
5. Coups de cœur (descend de #3)
6. … reste inchangé (par âge, streaming, jeux, collections, CTA)

Rationale : on enchaîne *décision* (hero) → *moment frais* (rail + salles) →
*preuve sociale* (pourquoi faire confiance) → *curation* — exactement la grammaire
CSM, adaptée au contexte temporel français que CSM ne fait pas.

---

## 6. Réparer la fraîcheur (spéc concrète pour le pass code)

Le pattern existe **déjà dans le même fichier** : `fetchDefault` (`:240-283`)
récupère un pool de 60, applique `seededShuffle(pool, getDaySeed())`, puis réserve
1 case « nouveauté » (`createdAt desc`).

**Étendre ce modèle à toutes les cases gelées, listées explicitement :**

- `fetchFamilyTV` — pool de ~20 séries familiales (plancher qualité conservé),
  `seededShuffle(pool, getDaySeed())`, prendre ce qu'il faut.
- `fetchFamilyGames` — idem sur un pool de jeux récents qualité.
- La case film streaming de `fetchTonight` (`:141`).
- La case film de `fetchHolidays` (`:218`).

**Option recommandée :** réserver **une case « injection nouveauté »**
(item le plus récemment noté par l'expert, ou le plus récemment ajouté) pour
qu'au moins une carte soit *vraiment* neuve, pas seulement réordonnée.

**Pourquoi ça marche sans nouveau modèle de données :** la clé `unstable_cache`
inclut déjà `parisIsoDay`, donc un shuffle journalier s'invalide et se rejoue
chaque jour. Réutiliser `getDaySeed()` / `seededShuffle()` (déjà importés par le
hero). Coût estimé : **~50–80 lignes** dans `ApercuTimeAwareHero.tsx`, zéro
migration.

---

## 7. Preuve sociale : plus qu'un simple reorder

Attention — remonter Pulse n'est **pas** un déplacement d'une ligne.
`ApercuPulse` est **client-side** (`"use client"`, `useEffect` → `/api/stats/public`)
en position #10. Le remonter près du haut implique :

- soit une **version SSR / prefetch** (sinon flash de skeleton + coût LCP /
  layout-shift en haut de page) ;
- **extraire `weeklyBuzz` / `latestAdditions` sans les 4 tuiles compteur
  catalogue** (« X œuvres, Y familles… ») — ces compteurs sont du *vanity* en
  haut de page ; la preuve sociale utile, ce sont les titres aimés.

À spécifier explicitement dans le pass (c) pour ne pas sous-estimer le travail.

---

## 8. Ce qu'on ne change pas

- **Hero recherche d'abord** — aligné CSM, sert les deux modes d'arrivée. Ne pas
  le remplacer par un rail de contenu.
- **Métriques par critère** — le différenciateur central. À mettre en avant, pas
  à diluer.
- **Pas de feed Netflix infini** — la home est un outil de décision.
- `images: unoptimized` + `productionBrowserSourceMaps` — délibérés et documentés
  (coût Vercel / debug), ne pas inverser à l'aveugle.

---

## 9. Risques & arbitrages

- **Shuffle seul réordonne un pool fixe.** Le visiteur revoit les ~20 mêmes
  titres dans un autre ordre → peut encore sembler répétitif à l'usage.
  *Mitigation :* coupler le shuffle avec la **case « injection nouveauté »** (§6)
  pour qu'au moins 1 carte soit réellement neuve.
- **Cadence de rotation :** `getDaySeed` vs `getWeekSeed` est le bouton de réglage.
  Journalier = plus frais ressenti ; hebdo = plus stable et plus *cache-friendly*.
  Démarrer en journalier, observer.

---

## 10. Métriques à suivre

- CTR home → fiche média (le signal #1 d'utilité de la home).
- Taux de visiteurs récurrents (> 30 % = sain).
- Impressions GSC sur « [titre] à partir de quel âge » et « film famille ce
  week-end » (à brancher sur l'agent SEO *striking-distance* existant).
- CTR de la section cinéma (valide / invalide la promotion §5).

---

## 11. Déploiement par phases (chaque phase approuvée séparément)

| Phase | Contenu | Fichier(s) | Taille |
|---|---|---|---|
| (a) | Ce document | `docs/marketing/homepage-strategy.md` | — |
| (b) | **Fix fraîcheur** du rail (plus petit, plus fort impact) | `ApercuTimeAwareHero.tsx` | ~50–80 l. |
| (c) | Remonter ciné live + preuve sociale SSR | `HomepageApercu.tsx`, `ApercuPulse.tsx` | reorder + SSR |
| (d) | Mesurer le delta de CTR | (analytics / GSC) | — |

---

## Décisions actées (avec concordance d'un second relecteur)

| Décision | Verdict |
|---|---|
| Garder le rail time-aware | ✅ cadre soir/week-end/vacances que CSM ne fait pas |
| Pas de lead « ciné seul » | ✅ évite de réduire la promesse produit à une niche |
| Pas de curation manuelle maintenant | ✅ scale + crons d'abord |
| Doc d'abord, code après | ✅ bon move avec la croissance organique qui démarre |
