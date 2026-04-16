# Totem Avisé — Analyse Stratégique & Positionnement

> Document de réflexion — Février 2026

---

## 1. Comparaison honnête avec Common Sense Media

### Ce que Common Sense fait (et qu'on ne peut pas répliquer)

Common Sense Media emploie des **journalistes rémunérés** (ex: Tara McNamara pour la critique de K-Pops) qui regardent chaque film et rédigent :
- Un éditorial "Common Sense Says" nuancé et contextualisé
- Des analyses détaillées par catégorie (violence, sexe, langage, etc.) avec des **explications écrites**
- "What Parents Need to Know" — rédigé par un humain, contextualisé
- "Talk to Your Kids About" — des pistes de conversation réfléchies

Ils ont **20+ ans** de contenu, un **budget annuel de 30M$+**, des contrats de licence avec écoles/bibliothèques, et une confiance de marque bâtie sur deux décennies.

**On ne peut pas concurrencer sur cet axe. Point.**

### Ce que Totem Avisé est aujourd'hui (état réel)

| Aspect | Common Sense | Totem Avisé |
|--------|-------------|-------------|
| Recommandations d'âge | Reviewer humain | GPT-4o-mini |
| Analyse de contenu | Paragraphes rédigés | Scores IA 0-5 |
| "Ce que les parents doivent savoir" | Rédigé par un humain | 3 puces générées par IA |
| Avis/Reviews | Éditorial + communauté | Communauté uniquement (quasi vides) |
| Personnalisation | Aucune (taille unique) | Scoring par membre de la famille |
| Système famille | Aucun | Quiz, réactions, scores d'adéquation |
| "Où regarder" | Basique | Intégration TMDB riche |
| Langue | Anglais d'abord | Français d'abord |
| Couverture | Massive (20+ ans) | ~3000-5000 items, automatisé |

### Le problème de transparence sur le contenu IA

Les champs `whatParentsNeedToKnow` et `expertAgeRec` proviennent d'appels batch à GPT-4o-mini. Les utilisateurs ne le savent pas. Quand ils lisent "Recommandé à partir de 10 ans", ils peuvent supposer qu'un psychologue pour enfants a pris cette décision. Si la supercherie est découverte, la confiance s'effondre instantanément.

---

## 2. La vraie question : quel problème résout-on ?

**Common Sense répond à :** "Ce film est-il adapté aux enfants en général ?"

**Totem Avisé pourrait répondre à :** "Ce film est-il adapté à VOTRE famille en particulier ?"

### Nos atouts uniques (que Common Sense n'a pas)

1. **Personnalisation par enfant** — Personne d'autre ne fait ça. Le quiz de préférences, les réglages de sensibilité, les réactions ADORÉ/EFFRAYÉ par enfant, et le scoring Family Fit sont véritablement innovants.
2. **Français d'abord** — Common Sense couvre à peine le cinéma français. Classements CSA, plateformes de streaming françaises, dates de sortie françaises — on possède ce terrain.
3. **"Où regarder"** — Les parents ne veulent pas seulement savoir SI un film est bien. Ils veulent savoir OÙ le regarder ce soir.
4. **Soirée Ciné Familiale** — "Trouvez un film que toute la famille peut regarder ensemble" est un cas d'usage puissant.

### Le problème actuel

Le site essaie d'être **à la fois** Common Sense (autorité éditoriale) **et** un moteur de recommandations personnalisées, sans exceller dans aucun des deux.

---

## 3. Visibilité sur les besoins utilisateurs

### Ce qu'on n'a PAS aujourd'hui

- **Aucune analytics** (pas de Plausible, PostHog, GA4)
- Aucun feedback "Cette recommandation était-elle utile ?"
- Aucun sondage utilisateur ou NPS
- Pas de heatmaps ni d'enregistrements de sessions
- Pas de framework A/B testing
- Aucun tracking des clics sur les sections de la homepage

**On construit à l'aveugle.** On ne sait pas si les utilisateurs s'intéressent au radar des métriques de contenu, ou s'ils veulent juste connaître l'âge recommandé et où streamer.

---

## 4. L'objectif est-il rempli ?

Si l'objectif est "aider les parents français à choisir des médias adaptés à l'âge" — **partiellement** :

- Un nouveau visiteur sur la homepage ne comprend pas immédiatement la proposition de valeur
- Le branding "expert" implique une expertise humaine qui n'existe pas
- La plupart des fiches média ont probablement zéro avis communautaire (problème de la poule et de l'oeuf)
- Il n'y a aucun moyen de savoir si les utilisateurs sont satisfaits ou s'ils reviennent

---

## 5. Trois directions stratégiques possibles

### Direction A : Outil de décision familiale

Miser à fond sur la personnalisation :
- Family Fit comme fonctionnalité héro (pas caché dans une sidebar)
- Quiz comme flux d'onboarding (pas enterré à 3 clics)
- "Trouvez le film parfait pour ce soir" comme hero de la homepage
- Dé-emphaser la prétention éditoriale

**Pour qui :** Parents qui reviennent régulièrement pour trouver quoi regarder.
**Risque :** Besoin d'utilisateurs inscrits pour fonctionner → croissance lente.

### Direction B : Guide alimenté par la communauté

Faciliter les contributions :
- Rendre la rédaction d'avis ultra-simple (micro-reviews : "En un mot : trop violent pour mon 7 ans")
- Mettre en avant les opinions des parents
- Construire la confiance par la sagesse collective plutôt que l'autorité IA
- Badges "La majorité des parents confirment" quand la communauté s'aligne avec l'IA

**Pour qui :** Trafic SEO ("est-ce que X est adapté pour mon enfant de 12 ans").
**Risque :** Besoin d'une masse critique d'avis pour être crédible.

### Direction C : Hybride (les deux)

Garder les deux angles mais être transparent sur IA vs communauté :
- Ajouter des analytics d'abord pour comprendre ce que les utilisateurs utilisent vraiment
- Étiqueter clairement ce qui est IA vs humain vs communauté
- Laisser les données guider la priorisation

---

## 6. Étapes non-négociables (quelle que soit la direction)

### 6.1 Ajouter des analytics

Plausible.io : 5 minutes d'installation, RGPD-conforme, ~9$/mois. Sans données, chaque décision est un pari.

Métriques minimales à tracker :
- Pages les plus visitées
- Taux de rebond par page
- CTAs les plus cliqués sur la homepage
- Taux de complétion du quiz
- Recherches sans résultats
- Parcours : homepage → détail → inscription

### 6.2 Être honnête sur le contenu IA

Ajouter un petit label "Estimation basée sur l'analyse du contenu" ou "Généré par IA" sur :
- Les recommandations d'âge
- Les métriques de contenu (violence, sexe, langage)
- "Ce que les parents doivent savoir"

**Pourquoi :** Un seul article de blog exposant l'IA non-signalée endommagerait la confiance de manière permanente. La transparence est un bouclier.

### 6.3 Ajouter un mécanisme de feedback

Même un simple pouce haut/bas sur les recommandations d'âge :
- (a) Données sur la précision de l'IA
- (b) Signal d'engagement utilisateur
- (c) Chemin vers des évaluations validées par la communauté
- (d) Matériau pour afficher "85% des parents confirment cette recommandation"

---

## 7. Questions stratégiques à trancher

### Qui est l'utilisateur réel ?

Deux profils très différents :

| Profil A : "Chercheur Google" | Profil B : "Parent régulier" |
|------|------|
| Recherche "Deadpool adapté 12 ans" | Ouvre l'app le vendredi soir |
| Arrive sur la page détail | Arrive sur la homepage/profil |
| Veut une réponse rapide | Veut des suggestions personnalisées |
| Ne créera probablement pas de compte | Utilise le système famille |
| Monétisation : SEO → pub/affiliation | Monétisation : abonnement/fidélité |

→ Ces deux profils nécessitent des UX différentes.

### Quel est le plus petit élément qui ferait qu'un parent recommande le site à un autre parent ?

C'est le levier de croissance. Est-ce :
- Le Family Fit ?
- Le filtre par âge sur `/films` ?
- L'intégration streaming ?
- Le quiz de préférences ?
- La soirée ciné familiale ?

→ Sans analytics, on ne peut pas répondre.

### SEO ou utilisateurs fidèles ?

- **Modèle SEO :** La page détail et son SEO comptent le plus. JSON-LD, meta descriptions, contenu riche.
- **Modèle fidélité :** Le système de personnalisation/profil compte le plus. Notifications, emails hebdo, contenu frais.

→ Les deux sont possibles, mais le budget et l'énergie ne permettent probablement qu'un seul focus au départ.

---

## 8. La boucle de contenu réalisable (sans journalistes)

On ne peut pas embaucher de journalistes. Mais on peut construire :

1. **Votes sur les recommandations d'âge IA** → calibrage progressif
2. **Badges "Confirmé par les parents"** quand la communauté s'aligne avec l'IA
3. **Micro-reviews encouragées** ("En un mot : trop violent pour mon 7 ans")
4. **Import des classements CNC** (95K+ classifications officielles françaises — déjà identifié comme travail futur)
5. **Mise en avant des avis communautaires** quand ils existent
6. **Collections éditoriales** (le seul vrai contenu éditorial — à développer)
7. **Guides thématiques** (déjà 3 en place — en écrire plus)

---

## 9. Simplification de la page détail

La page détail de Common Sense est efficace parce qu'elle a **UN message clair** : "Age 10+, voici pourquoi."

Notre page détail a : badge d'âge, classement officiel, grille de métriques, carte Family Fit, réactions, avis, médias similaires, plateformes de streaming, onglets... c'est trop dense.

**Le parent qui visite a UNE question :** "Est-ce que mon enfant de 8 ans peut regarder ça ?"

→ Répondre à cette question en 2 secondes devrait être l'objectif #1 de la page.

---

## 10. Résumé

| Priorité | Action | Impact |
|----------|--------|--------|
| **Urgente** | Installer Plausible/analytics | Arrêter de construire à l'aveugle |
| **Urgente** | Étiqueter le contenu IA | Protéger la crédibilité |
| **Haute** | Feedback pouce haut/bas | Engagement + calibrage IA |
| **Haute** | Choisir une direction (A, B ou C) | Focus stratégique |
| **Moyenne** | Simplifier la page détail | Meilleure conversion visiteur |
| **Moyenne** | Onboarding quiz simplifié | Plus de profils complétés |
| **Basse** | Import CNC | Données officielles françaises |
| **Basse** | Collections éditoriales | Contenu de qualité humaine |
