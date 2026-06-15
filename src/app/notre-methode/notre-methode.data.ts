// Pure-data module for the "Notre méthode" page.
// Consumed by:
// - src/app/notre-methode/page.tsx (JSX rendering)
// - src/app/md/notre-methode/route.ts (Markdown rendering for agents)
// Keep this file free of React imports so route handlers can use it.

export type MethodeIcon =
  | "sparkles"
  | "award"
  | "book-open"
  | "star"
  | "users"
  | "shield-alert"
  | "thumbs-up"

export interface MethodeSection {
  id: string
  icon: MethodeIcon
  title: string
  content: string[]
  list?: { label: string; desc: string }[]
  after?: string
}

export const methodeIntro = {
  eyebrow: "Méthode",
  title: "Notre méthode",
  lead: "Comment on évalue les contenus, attribue les badges et calcule la compatibilité avec votre famille.",
}

export const methodeSections: MethodeSection[] = [
  {
    id: "analyse-automatisee",
    icon: "sparkles",
    title: "Comment on analyse — en toute honnêteté",
    content: [
      "On préfère vous le dire clairement : nos recommandations d'âge, nos métriques de contenu, les points clés pour les parents et les thèmes détectés sont générés par une analyse automatisée du contenu. On croise les synopsis, les classifications officielles (CNC/CSA, PEGI), les genres et les données publiques pour produire une première estimation sur 8 dimensions.",
      "Cette estimation n'est pas un verdict d'expert. C'est un point de départ, qui s'affine avec le temps grâce aux votes et réactions des foyers inscrits. Quand au moins 5 parents ont voté et que 70 % sont d'accord, un badge de consensus apparaît — vos retours remplacent progressivement l'analyse automatisée.",
      "On ne promet pas une recommandation magique. On dit « en calibrage » parce que c'est ce qui se passe : vous aidez à régler le cadran, pas à valider un résultat figé.",
    ],
    list: [
      { label: "Recommandation d'âge", desc: "Estimée automatiquement à partir du synopsis + classifications officielles. Ajustée par vos votes « j'approuve / je conteste »." },
      { label: "Métriques de contenu", desc: "Les 8 dimensions (violence, sexe, langage, substances, consumérisme, messages positifs, modèles positifs, valeur éducative) sont estimées automatiquement. Les scores évaluables par les parents sont ensuite recalibrés par la communauté." },
      { label: "Points clés pour les parents", desc: "Extraits automatiquement du contenu analysé. Indicatifs — à recouper avec la fiche complète et les avis." },
      { label: "Thèmes détectés", desc: "Les tags thématiques sont détectés automatiquement. Ils peuvent être affinés par les signalements de la communauté." },
    ],
    after: "Pour chaque surface concernée, une petite pastille « Analyse automatisée · en calibrage » est visible sur les fiches. Elle vous rappelle la nature de l'estimation et vous invite à contribuer.",
  },
  {
    id: "recommandations-age",
    icon: "award",
    title: "D'où viennent nos recommandations d'âge",
    content: [
      "Chaque contenu sur Totem Avisé porte une recommandation d'âge indépendante de la classification officielle (CNC/CSA). La classification légale donne un âge minimum d'accès en salle. Nous, on regarde l'expérience dans son ensemble : est-ce que ce film risque de faire peur ? Est-ce que les thèmes abordés sont compréhensibles à cet âge ?",
      "La recommandation initiale est générée par analyse automatisée (voir « Comment on analyse » ci-dessus). Elle est ensuite calibrée par les votes des foyers inscrits. Sur chaque fiche vous trouverez les pouces en haut / en bas : c'est le levier pour contester ou confirmer.",
      "Quand les données du CNC sont disponibles, on les affiche en complément. Sur chaque fiche, vous voyez les deux côte à côte : la classification officielle et notre recommandation.",
    ],
  },
  {
    id: "metriques-contenu",
    icon: "book-open",
    title: "Les métriques de contenu (0–5)",
    content: [
      "Chaque contenu est noté sur 8 dimensions, une échelle de 0 à 5. Violence, sexe et nudité, langage, substances, consumérisme pour les éléments sensibles ; messages positifs, modèles positifs et valeur éducative pour les apports positifs.",
      "Ces repères sont calibrés pour une sensibilité familiale : une scène d'action stylisée (dessin animé, fantastique) ne pèse pas comme une scène réaliste équivalente, et les niveaux restent cohérents avec l'âge conseillé — un contenu conseillé dès 6–8 ans n'affiche pas de niveau élevé sur un axe sensible. L'âge conseillé reste le signal principal ; les niveaux de contenu sont des repères de vigilance (« y a-t-il un point à surveiller ? »), pas une note de sévérité au point près. La fiche détaille le 0 à 5 ; les vues rapides n'en gardent que l'essentiel.",
      "Pour les jeux vidéo, on met en avant les deux repères qui comptent le plus pour les parents : la violence et les achats intégrés (microtransactions).",
      "Comme les recommandations d'âge, ces scores démarrent en analyse automatisée. Les dimensions évaluables par les parents sont ensuite recalibrées par les familles qui notent elles-mêmes le contenu. Vous pouvez proposer vos propres scores depuis la fiche via « Évaluer ce contenu » — quand assez de parents contribuent, les scores communautaires remplacent progressivement les estimations initiales.",
    ],
  },
  {
    id: "points-cles",
    icon: "book-open",
    title: "Les points clés pour les parents",
    content: [
      "Le bloc « Ce que les parents doivent savoir » résume, en 3 à 5 points, les éléments du contenu qui méritent une attention particulière : scène impressionnante, thématique complexe, scène d'amour explicite, langage cru, etc.",
      "Ces points sont extraits automatiquement par analyse du contenu. Ils sont indicatifs et ne remplacent pas votre propre lecture de la fiche ni les avis des autres parents. Si un point manque ou semble incorrect, vous pouvez le signaler depuis la fiche.",
    ],
  },
  {
    id: "themes-detectes",
    icon: "book-open",
    title: "Les thèmes détectés",
    content: [
      "Les tags thématiques (amitié, deuil, voyage, écologie, etc.) sont détectés automatiquement à partir du synopsis, des genres et des classifications. Ils servent à connecter des œuvres similaires et à alimenter le moteur de recommandation personnalisée.",
      "Comme les autres signaux automatisés, ils peuvent être affinés par les signalements de la communauté. Si un thème central est absent ou si un thème listé ne correspond pas, vous pouvez nous le signaler.",
    ],
  },
  {
    id: "badges",
    icon: "star",
    title: "Les badges",
    content: [
      "Les badges apparaissent sur les fiches et les cartes pour repérer rapidement les qualités d'un contenu :",
    ],
    list: [
      { label: "Éducatif", desc: "Le contenu a un fort potentiel éducatif (score de 5/5 en valeur éducative)." },
      { label: "Modèles+", desc: "Le contenu met en avant des modèles positifs (score de 5/5)." },
      { label: "Âge (ex : 8+)", desc: "Âge minimum recommandé par l'analyse Totem Avisé, puis calibré par les retours des parents." },
      { label: "Classif. officielle", desc: "La classification CNC/CSA quand elle est disponible." },
    ],
  },
  {
    id: "famille",
    icon: "users",
    title: "Adapté à ma famille",
    content: [
      "Quand vous créez un profil famille, Totem Avisé calcule un repère de compatibilité pour chaque membre. Le calcul reste interne : côté parent, on affiche des niveaux simples comme « Très adapté », « Bon choix » ou « À vérifier ». Ce repère croise plusieurs facteurs :",
    ],
    list: [
      { label: "Âge", desc: "L'âge du membre par rapport à la recommandation d'âge du contenu. C'est le facteur qui pèse le plus." },
      { label: "Sensibilités", desc: "On compare les niveaux de contenu sensible (violence, peur, langage…) avec ce que chaque membre tolère." },
      { label: "Genres préférés", desc: "Correspondance entre les genres du contenu et les favoris du membre." },
      { label: "Centres d'intérêt", desc: "Les thèmes et sujets du contenu par rapport aux centres d'intérêt du membre." },
      { label: "Affinités", desc: "Si le membre a aimé des contenus similaires, ça joue en faveur." },
      { label: "Ambiance", desc: "Le ton et le rythme du contenu par rapport à l'âge et la sensibilité du membre." },
      { label: "Contenu positif", desc: "Correspondance avec les préférences en messages positifs, modèles inspirants et contenu éducatif." },
      { label: "Sujets à éviter", desc: "On vérifie que le contenu ne contient pas de sujets que le membre souhaite éviter." },
    ],
    after: "Les avatars des membres concernés apparaissent directement sur les cartes, avec une couleur de repère, pour voir d'un coup d'œil à qui le contenu semble convenir ou mérite une vérification.",
  },
  {
    id: "warning",
    icon: "shield-alert",
    title: "Attention famille",
    content: [
      "Le badge « Attention famille » signale les contenus qui méritent une vigilance particulière pour les foyers avec enfants. Il se déclenche dans deux cas :",
    ],
    list: [
      { label: "Détection automatique", desc: "Le contenu présente des signaux sensibles pour un foyer avec enfants : genre horreur/crime/thriller, violence ou sexualité élevée, ambiance sombre ou intense, ou combinaison âge recommandé + métriques sensibles." },
      { label: "Signalement communautaire*", desc: "Au moins 10 parents ont signalé ce contenu comme sensible pour les familles. L'astérisque (*) distingue ce signalement du signal automatique." },
    ],
    after: "Ce badge ne veut pas dire que le contenu est « mauvais ». Il indique qu'il vaut mieux y jeter un œil avant de le regarder en famille.",
  },
  {
    id: "votes",
    icon: "thumbs-up",
    title: "Les votes communautaires",
    content: [
      "Totem Avisé s'améliore grâce aux retours des parents. Vous pouvez contribuer de plusieurs façons :",
    ],
    list: [
      { label: "Vote sur l'âge", desc: "Confirmez ou contestez la recommandation d'âge avec un pouce en haut ou en bas. À partir de 5 votes et 70 % d'accord, un badge de consensus apparaît." },
      { label: "Signalement famille", desc: "Si vous estimez qu'un contenu mérite un avertissement familial, vous pouvez le signaler depuis la fiche. Seuls les utilisateurs avec un profil famille peuvent voter." },
      { label: "Réactions par membre", desc: "Enregistrez les réactions de chaque membre (adoré, aimé, ennuyeux, trop jeune…). Ces réactions alimentent les recommandations." },
    ],
  },
  {
    id: "sources",
    icon: "book-open",
    title: "Nos sources",
    content: [
      "Nos données viennent de plusieurs sources complémentaires :",
    ],
    list: [
      { label: "Bases de données internationales", desc: "Informations générales (synopsis, genres, dates, équipes techniques) issues de bases collaboratives." },
      { label: "CNC / data.gouv.fr", desc: "Classifications officielles des films en France, importées depuis les données publiques du CNC." },
      { label: "Analyse de contenu", desc: "Évaluation des 8 dimensions par notre système d'analyse, affinée par les retours de la communauté." },
      { label: "Communauté", desc: "Avis, votes d'âge et signalements des parents utilisateurs." },
    ],
    after: "Nos recommandations sont indépendantes. On n'est affilié à aucun studio, distributeur ou plateforme de streaming.",
  },
]
