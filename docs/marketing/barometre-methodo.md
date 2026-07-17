# Baromètre « Tous publics » — méthodologie & limites

*Page de méthodologie destinée à accompagner l'asset presse. À figer (date + version de la méthodo) avant toute publication. Interne pour l'instant ; la version publique reprendra les sections « Ce que nous mesurons », « Ce que nous ne prétendons pas » et « Limites ».*

---

## Le constat, en une phrase

> **« Tous publics » ne veut pas dire « adapté à tous les âges ».**
> Sur les films que la classification française laisse **sans restriction**, Totem Avisé conseille néanmoins **12 ans ou plus** pour une part importante d'entre eux.

Le chiffre exact (part conseillée 12+) est produit par `scripts/barometre-tp.ts` et **doit être recalculé après nettoyage de la cohorte** (voir ci-dessous). Ne pas republier le 41,6 % de la première passe tant que la cohorte n'a pas été assainie.

---

## Cadrage éditorial (non négociable)

1. **On ne dit jamais « le CNC a tort ».** La classification légale répond à une question (l'**accès** : un film est-il restreint ?), le conseil parental en répond à une autre (l'**adéquation** : à partir de quel âge est-ce confortable ?). Le Baromètre démontre que ces deux questions ont des réponses différentes — c'est exactement la raison d'être de Totem.
2. **Formulation retenue :** « Totem Avisé conseille néanmoins 12 ans ou plus pour X % d'entre eux. » On revendique uniquement ce qu'on peut défendre : que *notre* conseil diffère.
3. **Formulation écartée :** « ces films contiennent des éléments que la grille réserve aux 12+ ». Elle sous-entend un déclencheur objectif, par film, qu'on ne sait pas toujours produire à la demande. Les moyennes de sensibilité *expliquent* l'écart, elles ne le *prouvent* pas titre par titre.
4. **« Non restreint » plutôt que « pour tous les enfants ».** Sous-titre chiffré systématiquement présent sous le titre.

Titres candidats :

- *Tous publics, mais pas pour tous les âges* — Sur N films sans restriction analysés par Totem Avisé, X % sont néanmoins conseillés à partir de 12 ans.
- *« Tous publics » ne veut pas dire « adapté à tous les enfants »* — Totem Avisé recommande 12 ans ou plus pour deux films « Tous publics » sur cinq.

---

## Ce que nous mesurons

- **Cohorte :** films et séries dont la classification française est **« Tous publics » (non restreinte)**, enrichis par Totem (donc porteurs d'un âge conseillé et de métriques de contenu).
- **Signal principal :** la distribution de l'`âge conseillé par Totem` sur cette cohorte — part ≥ 12 ans (titre), part ≥ 8 ans, part ≤ 6 ans, histogramme complet.
- **Signal explicatif :** les moyennes des quatre axes de sensibilité (violence, sexe/nudité, langage, substances, échelle 0–5), comparées entre le groupe « conseillé ≥ 12 » et le groupe « ≤ 11 ».
- **Coupes secondaires :** par genre et par décennie de sortie.

## Ce que nous ne prétendons pas

- Nous ne mesurons **pas** un désaccord avec le CNC sur le plan légal.
- Les moyennes de sensibilité sont une **explication, pas une validation indépendante.** L'âge Totem et les axes de sensibilité proviennent du **même pipeline** (et le plancher d'âge déterministe hebdomadaire re-remonte l'âge à partir de ces mêmes métriques). Qu'un film conseillé 12+ ait une violence moyenne plus élevée confirme donc en partie que *nos règles fonctionnent comme prévu* — ce n'est pas une preuve externe. La seule validation réellement indépendante est l'**audit manuel** (ci-dessous).

---

## Assainissement de la cohorte (à faire AVANT publication)

Le champ `officialRating` **ne stocke aucune provenance**, et l'import mappe un « U » (UK) ou un « TP » nu vers `TOUS_PUBLICS` quel que soit le pays (`src/lib/tmdb.ts`, `mapCertificationToInternal`). Il peut aussi contenir de faux « TP » par défaut (d'où l'opération admin « Fix faux TP »). Un comptage brut de `TOUS_PUBLICS` **n'est donc pas** un constat sur la classification *française*.

**Étape 1 — nettoyage (mutation, à lancer en prod) :**

```
POST /api/admin/fix-default-tp     # boucler jusqu'à { done: true }
```

Re-vérifie chaque `TOUS_PUBLICS` film/série contre sa **certification région FR** (`getFrenchCertification` / `getTVFrenchRating`, filtrés sur `iso_3166_1 === "FR"`) et réinitialise tout ce qui n'est pas corroboré par une certification française. Ce qui survit est non restreint **en France**.

**Étape 2 — analyse (lecture seule) :**

```
npx tsx scripts/barometre-tp.ts            # rapport lisible
npx tsx scripts/barometre-tp.ts --csv      # échantillon d'audit en CSV
npx tsx scripts/barometre-tp.ts --sample 100
```

Le script applique en plus l'hygiène qu'il peut garantir hors-ligne (enrichis seulement, `tmdbId` présent, déduplication titre+année) et affiche le N survivant — **si le chiffre s'éloigne nettement du 41,6 % de la première passe, c'est le nettoyage qui a parlé, et c'est le nouveau chiffre qui fait foi.**

---

## Les cinq contrôles avant publication (checklist)

- [ ] **Autorité de classification isolée** — `fix-default-tp` bouclé jusqu'à `done:true` ; cohorte restreinte au « non restreint EN FRANCE ».
- [ ] **Doublons écartés** — éditions alternates / doublons catalogue (le script déduplique par titre+année ; vérifier le compteur `Doublons écartés`).
- [ ] **Version de la méthodo figée** — noter date du run + commit, geler l'export.
- [ ] **Biais des valeurs manquantes vérifié** — s'assurer que l'exclusion des non-enrichis / sans métriques ne penche pas systématiquement dans un sens.
- [ ] **Audit manuel stratifié (~100 films)** — relire à la main, en priorité les plus gros écarts officiel↔Totem (sortie `--csv` du script), répartis par genre et décennie. Cet audit fournit aussi les **dix exemples reconnaissables** du kit presse.

---

## Packaging de la première édition (ciblé, pas une étude de 40 pages)

1. Le constat titre. 2. La distribution des âges. 3. Les écarts de sensibilité. 4. Résultats par genre et par décennie. 5. Dix exemples reconnaissables (issus de l'audit). 6. Cette page méthodo + limites. 7. Un visuel presse téléchargeable + un communiqué court.

**Angles « second récit » à surveiller** (le script les calcule) :
- **Décennie :** les « classiques familiaux » anciens reçoivent-ils un âge Totem plus élevé que les récents ? Très partageable si oui.
- **Genre :** comédie (langage), action (violence), drame (intensité émotionnelle) comme moteurs distincts.

---

## Une question à trancher avant tout contact presse

La première question d'un journaliste sera « conseillé par qui, sur quelle base ? ». Décider **à l'avance** la réponse à la relance « est-ce de l'IA ? » : on peut décrire honnêtement la grille d'analyse et la relecture humaine sans nommer de prestataire, mais improviser sur ce point est le seul scénario qui transforme une bonne couverture en mauvaise.

---

*Source de vérité du calcul : `scripts/barometre-tp.ts` (lecture seule). Nettoyage : `POST /api/admin/fix-default-tp`. Ne pas citer de chiffre public sans avoir coché les cinq contrôles.*
