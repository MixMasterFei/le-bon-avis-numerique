# Extension Québec

> Statut : **proposition**, non engagée. Rédigé le 2026-08-10.
> Portée retenue : catalogue québécois + classification québécoise **en arrière-plan**.
> Hors portée à ce stade : plateformes de streaming canadiennes, copie fr-CA, sélecteur de région, pages `/qc`.

---

## 1. L'idée

Totem Avisé vise « les familles francophones » dans sa marque (`docs/marketing/brand-brief.md:73`) alors que 100 % de sa substance est française. Le Québec est le premier marché francophone hors de France — et il est déjà identifié en interne comme un angle mort : `src/lib/heritage-watchlist.ts:143` porte le commentaire *« Québec — le public canadien francophone, angle mort total aujourd'hui »*.

L'approche retenue **n'est pas** d'ouvrir un second front d'acquisition SEO. C'est plus simple et plus solide :

1. **Ajouter les films québécois au catalogue** — combler un trou réel.
2. **Utiliser la classification québécoise en arrière-plan** comme signal d'entrée de la recommandation Totem, exactement comme le CSA aujourd'hui.
3. **L'expliquer dans « Notre méthode »** — la transparence est déjà la position de marque.
4. **Produire le jumeau québécois de la statistique d'écart** — la donnée qui prouve l'indépendance du modèle.

Ce cadrage a une conséquence stratégique importante : le Québec devient **une source de données qui renforce le produit français**, et non un pari d'acquisition. Il reste donc défendable même si le trafic québécois ne décolle jamais.

---

## 2. La donnée cible

### 2.1 Ce que produit déjà le modèle français

Mesuré sur la base de production le 2026-08-10 (films + séries, enrichis, avec classification officielle et âge Totem) :

| Classification officielle | n | Totem plus strict | Accord | Plus permissif | Âge Totem moyen |
|---|---|---|---|---|---|
| Tous publics | 2 898 | 100 % | — | — | **9,7 ans** |
| −10 | 123 | 61,0 % | 18,7 % | 20,3 % | 11,3 |
| −12 | 951 | 59,8 % | 34,4 % | 5,8 % | 13,1 |
| −16 | 440 | 0,2 % | 73,4 % | 26,4 % | 15,3 |
| −18 | 87 | — | 18,4 % | 81,6 % | 16,0 |

Et le chiffre marquant, sur les 2 898 films « Tous publics » :

| Seuil Totem | Part |
|---|---|
| 8 ans et plus | 67,5 % |
| 10 ans et plus | 54,1 % |
| **12 ans et plus** | **41,3 %** |
| 13 ans et plus | 20,7 % |

> **41,3 % des films classés « Tous publics » en France sont recommandés 12 ans et plus par Totem Avisé.**

La requête exacte qui produit ces tableaux est en annexe (§6). Elle normalise `official_rating` en SQL, ce qui est nécessaire — voir §5.2.

### 2.2 Le jumeau québécois

L'objectif est la même mesure contre la classification du Québec :

> *« X % des films classés « Visa général » au Québec sont recommandés N ans et plus par Totem Avisé. »*

**Raison structurelle d'attendre un écart plus large qu'en France.** Le système québécois n'a **ni catégorie −10 ni catégorie −12** : il passe de « Visa général » directement à « 13 ans et plus ». Tout ce que la France répartit entre Tous publics, −10 et −12 se retrouve donc au Québec dans un seul bucket. Le sous-ensemble « Visa général mais en réalité 10-12 ans » devrait être nettement plus fourni. **À vérifier — c'est une hypothèse, pas un acquis.**

### 2.3 Un troisième angle, gratuit

Une fois les deux classifications présentes sur les mêmes films, une mesure supplémentaire apparaît sans travail additionnel : **là où la France et le Québec se contredisent entre elles**. Deux autorités francophones, deux verdicts différents sur le même film. Personne ne publie cette donnée aujourd'hui.

C'est une variante du format déjà repéré dans `docs/marketing/market-analysis.md` (« FR vs US ratings »), en plus fort : les deux juridictions sont francophones, donc comparables sans excuse culturelle.

---

## 3. Le piège de circularité — et pourquoi le code le résout déjà

**On ne peut pas simultanément ancrer la note Totem sur la classification québécoise et mesurer son écart avec elle.** Ce serait mesurer son propre input : le chiffre tomberait vers zéro et l'angle éditorial disparaîtrait.

Le code français traite déjà ce problème correctement, et il suffit d'appliquer le **même** traitement au Québec :

| Mécanisme | Emplacement | Traitement de la classification officielle |
|---|---|---|
| Prompt d'enrichissement | `src/app/api/admin/enrich/route.ts:292` | Section explicitement intitulée « CLASSIFICATION OFFICIELLE (indice **FAIBLE**) » |
| Plancher d'âge déterministe | `src/lib/age-floor.ts:19`, `:42` | CSA/CNC **n'influencent jamais** le plancher — commentaire explicite : ces classifications sont indulgentes. Seul PEGI plancher les jeux |

C'est exactement ce qui rend le 41,3 % défendable plutôt que tautologique.

**Règle pour le Québec :** classification québécoise = indice faible dans le prompt, **jamais** un plancher, **jamais** un ancrage. Son rôle principal est d'être la référence contre laquelle on se mesure.

---

## 4. Phases

Chaque phase livre quelque chose d'utile seule.

### Phase 0 — Vérifier que la donnée existe et se raccroche (~1 semaine, aucun code produit)

Livrable : une note de faisabilité et un go/no-go.

| # | Question | Méthode | Seuil |
|---|---|---|---|
| 1 | Le CSV québécois est-il exploitable ? | Télécharger le jeu de données (§6). Inspecter les colonnes : titre, titre original, année, catégorie, motifs. | Titre + année indispensables |
| 2 | **Quel taux de correspondance avec notre catalogue ?** | Matcher le CSV contre les 8 623 films en base par titre + année. | **< 20 % ⇒ ne pas construire.** C'est la question qui décide de tout |
| 3 | CKAN expose-t-il une API ? | Tester `donneesquebec.ca/api/3/action/datastore_search?resource_id=…&q=…` | API ⇒ clone direct de l'import CNC. Sinon ⇒ CSV en masse + correspondance locale |
| 4 | L'écart est-il réellement plus marqué ? | Sur l'échantillon apparié de la Q2, calculer la statistique §2.2 en avance. | Si l'écart est plus faible qu'en France, l'angle éditorial est plus faible — le catalogue reste valable |

### Phase 1 — Stocker une seconde classification

`MediaItem.officialRating` est une colonne unique déjà occupée par la valeur française. Il faut un emplacement pour la valeur québécoise.

Nouvelle table, purement données/analytique — **aucune migration d'UI**, puisque le Québec reste en arrière-plan :

```prisma
model MediaRating {
  id         String    @id @default(uuid())
  mediaId    String    @map("media_id")
  system     String    // "CSA" | "RCQ"
  code       String    // "CSA_12" | "RCQ_13"
  age        Int?      // âge normalisé — le champ portable
  advisories String[]  @default([])  // ["violence", "langage vulgaire"]
  source     String    // "CNC" | "MCC_QC" | "TMDB"
  media      MediaItem @relation(fields: [mediaId], references: [id], onDelete: Cascade)
  @@unique([mediaId, system])
  @@index([system, code])
  @@map("media_ratings")
}
```

`MediaItem.officialRating` **reste inchangé** — plus de 100 sites d'appel en dépendent. La table est additive.

Migration : `prisma db push` est bloqué par le conflit sur `topics` (`CLAUDE.md`). Écrire `sql/add_media_ratings.sql`, appliquer via `prisma db execute`, puis `prisma generate`.

Cette phase est aussi l'occasion de corriger le problème décrit en §5.2, qui affecte le site français aujourd'hui.

### Phase 2 — Importer la classification québécoise

Clone de `src/app/api/admin/import-cnc-ratings/route.ts` vers `import-qc-ratings`. Réutiliser tel quel la correspondance par variantes de casse (`searchCNC()` :93-120, `toSentenceCase()` :46-55) et la robustesse réseau (timeout 8 s, un retry sur 429/5xx, délai inter-requêtes, :57-89).

| Catégorie MCC | Code | Âge |
|---|---|---|
| Visa général | `RCQ_G` | 0 |
| Visa général — déconseillé aux jeunes enfants | `RCQ_G_DJE` | 6 |
| 13 ans et plus | `RCQ_13` | 13 |
| 16 ans et plus | `RCQ_16` | 16 |
| 18 ans et plus | `RCQ_18` | 18 |

Les motifs (violence, langage vulgaire, érotisme, horreur) vont dans `advisories[]`.

**Enregistrement du cron — checklist en 4 points** (`CLAUDE.md`) : `.github/workflows/cron.yml`, `EXPECTED_TASKS` (`src/lib/cron-supervisor.ts`), `KNOWN_CRON_TASKS` (`admin-kpis.ts`), `CRON_STALE_HOURS` (`debt-digest.ts`).

### Phase 3 — Catalogue québécois

**Garde-fous à désamorcer d'abord**, sinon le contenu québécois est rejeté ou détruit :

| Risque | Emplacement | Action |
|---|---|---|
| **Destructif** — supprime les films sans classification CSA, sans streaming FR et non francophones | `src/app/api/admin/cleanup-non-french/route.ts:28-34`, bouton admin `OperationsCenter.tsx:605` | **En premier.** Élargir aux classifications non-FR ou retirer le bouton |
| Filtre de pertinence française à l'import | `weekly-import/route.ts:74-96`, répliqué dans `backfill-kids:47`, `import/movies:216` | Ajouter la source québécoise à `FR_SAFE_SOURCES` (`import/movies/route.ts:23`) |
| Liste blanche de langues qui exclut les `NULL` | `src/lib/media-queries.ts:131-150` | Bug connu, corrigé uniquement dans `api/db/media/route.ts:78-102` (1 948 titres, 20,6 % du catalogue). Reporter le correctif |

Import : preset dans `src/components/admin/ImportPresetsBar.tsx` (`PRESETS`, :30-110) avec TMDB `region=CA` / `with_original_language=fr`, et compléter la liste `quebec` de `src/lib/heritage-watchlist.ts:143-151`.

État actuel : **2 des 7 classiques québécois** listés sont en base (`Le chandail`, `Félix et le trésor de Morgäa`). Manquent *La Guerre des tuques* (1984 et 3D), *Bach et Bottine*, *La Grenouille et la Baleine*, *La Course des tuques*.

### Phase 4 — Le signal faible et la page méthode

1. Ajouter la classification québécoise au prompt d'enrichissement dans la **même section « indice FAIBLE »** que le CSA (`enrich/route.ts:292`). Ne pas créer de mécanisme distinct. Ne pas toucher à `age-floor.ts`.
2. Mettre à jour `src/app/notre-methode/notre-methode.data.ts`, section `recommandations-age`. Ce module est un fichier de données pur consommé **à la fois** par la page JSX et par `/md/notre-methode` (la surface destinée aux agents) — une seule édition met à jour les deux.
   La formulation actuelle (`:55`) dit déjà « indépendante de la classification officielle (CNC/CSA) » : il s'agit d'étendre à « CNC/CSA en France, ministère de la Culture et des Communications au Québec » et d'y adosser les chiffres d'écart.
3. Publier la statistique. Candidats : la page méthode, un article de blog, `llms.txt`.

---

## 4 bis. Décisions prises (2026-08-10)

### « Ne regarder la classification québécoise que pour les films québécois » — écarté

Variante envisagée puis écartée, pour deux raisons factuelles :

1. **Inimplémentable en l'état** : `media_items` n'a **aucune colonne de pays** (vérifié en base — seuls `original_language` et `original_title` existent). TMDB fournit `production_countries` (`tmdb.ts:153`) mais rien ne l'écrit. Identifier « les films québécois » exigerait migration + backfill TMDB sur 8 623 films — l'option « simple » coûte plus cher que l'option générale.
2. **Elle tue la statistique** : le jeu de données du MCC classe *tous* les films diffusés au Québec (Avatar, Disney, films français…). La valeur est précisément le recouvrement avec le catalogue existant. Restreint aux productions québécoises, l'échantillon tombe à quelques dizaines de titres non représentatifs.

L'objectif de non-perturbation est atteint autrement : table séparée (`media_ratings`), rien d'affiché, la phase 0 ne fait **aucune écriture** (téléchargement CSV + appariement hors ligne + calcul).

### Plateformes de streaming pour les films québécois — rien à faire

Question : que faire si un film québécois est disponible au Québec mais sur aucune plateforme française ?

Réponse mesurée en base : c'est **déjà l'état normal d'un tiers du catalogue**. Sur 8 623 films, 4 812 (55,8 %) ont une offre de streaming FR réelle, et **2 706 sont explicitement marqués « aucune offre en France »** (lignes `provider='_none'` dans `streaming_availability`). La fiche gère ce cas depuis toujours : le bloc plateformes est simplement absent. Un film québécois sans offre FR sera traité exactement comme *ces* 2 706 films. La valeur de la fiche est l'âge conseillé argumenté, pas le lien de visionnage.

Ne **pas** afficher les offres de streaming québécoises (Crave, Club illico, Tou.tv) : le public est français, ce serait du bruit. Le jour où un vrai public québécois existe, `StreamingAvailability.country` est déjà prêt (indexé, dans la clé unique) — il suffira de paramétrer le fetch (`tmdb.ts:569/:581`, codé `.results?.FR`) et les lectures (`extras/route.ts:44`).

### Trailers YouTube — corrigé (fait, commit du 2026-08-10)

Le vrai trou était là : `getMovieVideos`/`getTVVideos` (`src/lib/tmdb.ts`) tentaient fr-FR puis en-US. Or les trailers des films québécois sont souvent tagués **fr-CA** chez TMDB → aucune des deux requêtes ne les trouvait, fiche sans trailer. Corrigé par un 3e palier fr-CA, tenté **en dernier** : les titres qui résolvaient déjà gardent le même nombre de requêtes, l'appel supplémentaire ne part que pour les titres qui n'auraient rien affiché. Bénéficie aussi aux 2 titres québécois déjà en base.

---

## 5. Points de vigilance

### 5.1 Le 41,3 % doit être audité avant publication

Il existe une route admin `fix-default-tp` (« Fix faux TP », `src/app/api/admin/fix-default-tp/route.ts`) dédiée au nettoyage de fausses valeurs « Tous Publics ». Une partie des 2 898 films du dénominateur pourrait donc être mal classée par défaut plutôt que réellement Tous Publics — ce qui gonflerait mécaniquement l'écart.

**À faire avant toute communication publique du chiffre :** quantifier les faux TP résiduels et recalculer sur le sous-ensemble propre. Publier un chiffre gonflé sur un site dont la marque repose sur la rigueur serait le pire résultat possible.

### 5.2 `official_rating` mélange déjà deux vocabulaires

Relevé sur la base de production (films + séries) :

| Contenu de `official_rating` | Lignes |
|---|---|
| `(null)` | 4 933 |
| Forme interne normalisée (`TOUS_PUBLICS`, `CSA_10/12/16/18`) | 1 760 |
| **Certificats TMDB bruts** (`TP`, `U`, `12`, `16`, `10`, `18`, `NR`) | **2 785** |

Il y a plus de lignes en valeur brute qu'en valeur normalisée : `mapCertificationToInternal()` (`src/lib/tmdb.ts:448`) n'est pas appliqué sur tous les chemins d'écriture. Conséquences **actuelles**, sur le site français :

- `estimateProvisionalAgeFromStored()` (`src/lib/import-helpers.ts:135-137`) ne connaît que la forme interne → pour ces 2 785 films il retombe silencieusement sur l'heuristique de genre, en ignorant une classification pourtant présente.
- `csaRatings` (`src/lib/utils.ts:33`) ne mappe que la forme interne → `OfficialRatingBadge` (`AgeBadge.tsx:69`) n'affiche rien d'exploitable pour ces films.
- `U` et `NR` ne sont pas des certificats français : l'hypothèse « une colonne = CSA » fuit déjà.

La phase 1 corrige ce point pour le site français, indépendamment du Québec.

### 5.3 TMDB ne peut pas fournir la classification québécoise

Le code `CA` de TMDB correspond au **CHVRS** (G / PG / 14A / 18A / R / A / E), utilisé par les six provinces **autres** que le Québec. Il n'existe pas de région `CA-QC`. L'open data du MCC est la seule source.

### 5.4 Contexte de trafic

`docs/marketing/market-study-2026-07.md` mesure la Belgique et la Suisse comme baromètre des AI Overviews : CTR de 0,56 à 1,79 % contre 3,4 à 3,7 % en France, soit **−55 à −85 %**. Le Canada a l'AIO depuis 2024. Toute prévision de trafic québécois doit se calibrer sur ces chiffres, pas sur ceux de la France.

Ce risque **ne pèse pas sur ce plan**, puisqu'il n'est pas construit sur une promesse d'acquisition. Il redeviendrait déterminant si l'on ajoutait plus tard des pages `/qc` et un sélecteur de région.

`src/lib/gsc.ts:61` supporte déjà la dimension `country` : le trafic canadien actuel est mesurable gratuitement, à tout moment.

### 5.5 Bug relevé au passage : le filtre plateformes ratait la plupart des films disponibles — **corrigé (2026-08-10)**

Sans rapport avec le Québec, découvert en mesurant la couverture streaming. Deux stockages coexistaient sans pont :

| Stockage | Lu par | Écrit par |
|---|---|---|
| `streaming_availability` (table, noms TMDB bruts, tous types d'offre) | La fiche (`extras/route.ts:43`) | `admin/streaming/cache` (op admin « MAJ streaming ») |
| `media_items.platforms[]` (tableau normalisé) | **Tous les filtres** (`media-queries.ts:384/:482/:560`, smart filter, outils MCP) | Import jour-un + cron `admin/streaming/update` (150/sem., `onlyEmpty`) |

La route `cache` avait couvert ~8 000 films dans la table **sans jamais écrire le tableau**. Résultat mesuré : en sémantique filtre (offres abonnement/gratuit sur les 12 plateformes filtrables), **2 090 films/séries justifiaient une entrée de filtre et ne l'avaient pas** — 525 films filtrables au lieu de ~2 400. *The Dark Knight*, *Pulp Fiction*, *Joker* étaient invisibles au filtre Netflix. (Le chiffre « 4 701 » d'une première estimation incluait les offres location/achat, qui ne relèvent pas du filtre.)

**Correctif appliqué :**
1. **Backfill** `sql/backfill_platforms_from_streaming.sql` (exécuté en prod le 2026-08-10) : `platforms[]` ← offres SUBSCRIPTION/FREE de la table, normalisées via la même carte que `extractProviders()`, additif (ne touche jamais un tableau non vide, exclut les jeux). Résultat : **films 525 → 2 413, séries → 513**.
2. **Write-through** dans `admin/streaming/cache` : chaque rafraîchissement de la table synchronise désormais `platforms[]` (y compris remise à vide quand l'offre a disparu — donnée TMDB fraîche faisant autorité).
3. `admin/streaming/update` purge désormais les entrées périmées quand TMDB ne renvoie plus d'offre (atteignable en `onlyEmpty=false`).

**Suite possible (non faite, à décider)** : le cron du samedi appelle `update` (150 items/sem., du plus récent au plus ancien, re-scanne indéfiniment les mêmes films sans offre — file bouchée). La route `cache` est mieux outillée (marqueur `_none`, re-check 7 jours, compteur de reste) ; la planifier à la place d'`update` serait plus sain, mais exige le câblage de monitoring complet (checklist 4 points de CLAUDE.md : `cron.yml`, `EXPECTED_TASKS`, `KNOWN_CRON_TASKS`, `CRON_STALE_HOURS`) — chantier séparé.

### 5.6 Juridique, si le Québec devient une cible affichée

Non bloquant tant que le Québec reste une source de données, mais à ne pas découvrir plus tard : Loi 25 (autorité = la **CAI**, pas la CNIL ; consentement des mineurs à **13 ans** contre 15 en France), et surtout `src/app/mentions-legales/page.tsx:239-243` — « régies par le droit français », « les tribunaux français seront seuls compétents » — clause qui ne tient pas face à un consommateur québécois.

---

## 6. Annexes

### Sources

| Ressource | URL |
|---|---|
| Jeu de données — Classement des long-métrages diffusés sur le territoire québécois | https://www.donneesquebec.ca/recherche/dataset/classement-des-long-metrages-diffuses-sur-le-territoire-quebecois |
| Répertoire des films classés (catégorie + motifs + synopsis) | https://repertoire.cinema.mcc.gouv.qc.ca/ |

Autorité : Direction du classement des films, ministère de la Culture et des Communications. La Régie du cinéma a été remplacée en 2015, et le MCC administre le classement depuis le 1er avril 2017.

Catégories : Visa général · 13 ans et plus · 16 ans et plus · 18 ans et plus.
Indications complémentaires : déconseillé aux jeunes enfants, violence, langage vulgaire, érotisme, horreur, sexualité explicite.

### Requête de référence — écart par classification

```sql
WITH norm AS (
  SELECT
    CASE
      WHEN official_rating IN ('TOUS_PUBLICS','TP','U') THEN 0
      WHEN official_rating IN ('CSA_10','10')           THEN 10
      WHEN official_rating IN ('CSA_12','12')           THEN 12
      WHEN official_rating IN ('CSA_16','16')           THEN 16
      WHEN official_rating IN ('CSA_18','18')           THEN 18
    END AS official_age,
    expert_age_rec
  FROM media_items
  WHERE type IN ('MOVIE','TV')
    AND is_enriched
    AND expert_age_rec IS NOT NULL
    AND official_rating IS NOT NULL
)
SELECT official_age,
       COUNT(*) AS n,
       ROUND(100.0 * COUNT(*) FILTER (WHERE expert_age_rec > official_age) / COUNT(*), 1) AS pct_totem_plus_strict,
       ROUND(100.0 * COUNT(*) FILTER (WHERE expert_age_rec = official_age) / COUNT(*), 1) AS pct_accord,
       ROUND(100.0 * COUNT(*) FILTER (WHERE expert_age_rec < official_age) / COUNT(*), 1) AS pct_plus_permissif,
       ROUND(AVG(expert_age_rec)::numeric, 1) AS age_totem_moyen
FROM norm
WHERE official_age IS NOT NULL
GROUP BY official_age
ORDER BY official_age;
```

Le jour où `media_ratings` existe, la version québécoise est la même requête avec une jointure sur `media_ratings WHERE system = 'RCQ'` au lieu de `official_rating`.
