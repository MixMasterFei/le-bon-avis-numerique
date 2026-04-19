// Curated rotation of family-tech / parenting facts. One is shown per
// ISO week on /apercudecouverte's "Le chiffre de la semaine" card.
// Sources are French institutions wherever possible. Rotate quarterly
// when figures get stale; selection is deterministic by ISO week so
// every visitor sees the same fact all week long.

export interface FamilyFact {
  /** Bold focal number/figure — short, eye-catching. */
  stat: string
  /** One-sentence context surrounding the stat. */
  label: string
  /** Citation string shown small, italic. */
  source: string
  /** Optional public URL for the source — opens in a new tab. */
  sourceUrl?: string
}

export const FAMILY_FACTS: FamilyFact[] = [
  {
    stat: "2 h 17",
    label: "par jour devant les écrans en moyenne pour les enfants de 3 à 11 ans en France.",
    source: "Santé publique France · Étude Enabee 2025",
    sourceUrl: "https://www.santepubliquefrance.fr/presse/2025/temps-d-ecran-des-enfants-de-3-a-11-ans-un-usage-precoce-quotidien-et-marque-par-les-inegalites-sociales",
  },
  {
    stat: "3-6-9-12",
    label: "le repère pédopsychiatrique du Pr Serge Tisseron : pas d'écran avant 3 ans, pas de console avant 6, pas d'Internet avant 9, pas de réseaux sociaux avant 12.",
    source: "Yapaka · Fédération Wallonie-Bruxelles",
    sourceUrl: "https://www.yapaka.be/thematique/ecrans",
  },
  {
    stat: "15 ans",
    label: "l'âge minimum requis pour qu'un mineur consente seul à un traitement de ses données personnelles en France.",
    source: "CNIL · Droits numériques des mineurs",
    sourceUrl: "https://www.cnil.fr/fr/thematiques/les-droits-numeriques-des-mineurs",
  },
  {
    stat: "82 %",
    label: "des parents français se disent préoccupés par le temps que leurs enfants passent sur les écrans.",
    source: "Fondation pour l'Enfance · Baromètre Enfance & Numérique 2026",
    sourceUrl: "https://www.fondation-enfance.org/actualites/",
  },
  {
    stat: "3018",
    label: "le numéro national gratuit pour signaler le cyberharcèlement et la violence numérique. Disponible 7 j/7, 9 h-23 h.",
    source: "Association e-Enfance",
    sourceUrl: "https://e-enfance.org/informer/",
  },
  {
    stat: "5 niveaux",
    label: "la signalétique jeunesse imposée par l'Arcom à toute la télévision française : Tous publics, -10, -12, -16, -18.",
    source: "Arcom · Protection des mineurs",
    sourceUrl: "https://www.arcom.fr/se-documenter/ressources-pedagogiques/protection-des-mineurs",
  },
  {
    stat: "1 enfant sur 4",
    label: "déclare avoir déjà été confronté à une situation gênante en ligne avant ses 12 ans.",
    source: "UNICEF France · État des droits de l'enfant numérique",
    sourceUrl: "https://www.unicef.fr/article/proteger-les-droits-de-lenfant-dans-un-monde-numerique/",
  },
  {
    stat: "PEGI 7",
    label: "convient aux enfants dès 7 ans : peut contenir des scènes ou sons légèrement effrayants, jamais de violence réaliste.",
    source: "PEGI · Pan European Game Information",
    sourceUrl: "https://pegi.info/fr",
  },
  {
    stat: "60 minutes",
    label: "le temps d'écran récréatif maximum recommandé par jour pour les enfants de 2 à 5 ans (OMS).",
    source: "Organisation mondiale de la Santé",
    sourceUrl: "https://www.who.int/fr/news/item/24-04-2019-to-grow-up-healthy-children-need-to-sit-less-and-play-more",
  },
  {
    stat: "1 sur 3",
    label: "des collégiens dit avoir été exposé à des contenus pornographiques en ligne avant l'âge de 12 ans.",
    source: "Arcom · Étude usages numériques mineurs",
    sourceUrl: "https://www.arcom.fr/",
  },
  {
    stat: "8 ans",
    label: "l'âge médian d'obtention du premier smartphone personnel chez les enfants français.",
    source: "Fondation pour l'Enfance · Baromètre 2026",
    sourceUrl: "https://www.fondation-enfance.org/",
  },
  {
    stat: "TP, -10, -12, -16, -18",
    label: "les visas du CNC qui régissent l'accès aux salles de cinéma françaises selon l'âge.",
    source: "Centre national du cinéma",
    sourceUrl: "https://www.cnc.fr",
  },
  {
    stat: "2 h",
    label: "le temps d'écran quotidien au-delà duquel les chercheurs constatent un effet mesurable sur le sommeil des enfants.",
    source: "INSERM · Étude Elfe",
    sourceUrl: "https://presse.inserm.fr/ecrans-et-developpement-cognitif-de-lenfant-le-temps-dexposition-nest-pas-le-seul-facteur-a-prendre-en-compte/67438/",
  },
  {
    stat: "60 %",
    label: "des familles françaises regardent un film ou une série ensemble au moins une fois par semaine.",
    source: "CSA · Baromètre télévision",
    sourceUrl: "https://www.csa.fr",
  },
  {
    stat: "30 minutes",
    label: "le temps de lecture quotidien recommandé pour développer le vocabulaire et la concentration des 6-10 ans.",
    source: "Ministère de l'Éducation nationale",
    sourceUrl: "https://www.education.gouv.fr",
  },
  {
    stat: "✓ vérifier",
    label: "selon Arcom, contrôler l'âge réel de votre enfant à l'inscription sur un réseau social est désormais une obligation légale pour les plateformes.",
    source: "Arcom · Protection des mineurs en ligne",
    sourceUrl: "https://www.arcom.fr/",
  },
  {
    stat: "1 jeu sur 5",
    label: "noté PEGI 18 contient des éléments tels que la violence réaliste, le sexe ou la consommation de drogue.",
    source: "PEGI · Statistiques annuelles",
    sourceUrl: "https://pegi.info/fr",
  },
  {
    stat: "13 ans",
    label: "l'âge minimum officiel pour s'inscrire sur la plupart des réseaux sociaux (TikTok, Instagram, Snapchat). Beaucoup d'enfants y sont pourtant plus jeunes.",
    source: "CNIL · Réseaux sociaux et mineurs",
    sourceUrl: "https://www.cnil.fr/fr/thematiques/les-droits-numeriques-des-mineurs",
  },
  {
    stat: "70 %",
    label: "des parents disent ne pas savoir précisément ce que leur ado regarde sur YouTube ou TikTok.",
    source: "UNAF · Mon enfant et les écrans",
    sourceUrl: "https://www.mon-enfant-et-les-ecrans.fr/",
  },
  {
    stat: "lire ensemble",
    label: "selon les chercheurs, partager une histoire à voix haute reste l'activité la plus efficace pour ancrer le langage avant 6 ans, devant n'importe quelle application éducative.",
    source: "Naître et grandir · Fondation Chagnon (QC)",
    sourceUrl: "https://naitreetgrandir.com/fr/",
  },
]

/**
 * Pick a deterministic fact for the current ISO week. Same fact for
 * every visitor, every visit, until Monday 00:00 UTC. Quarterly review
 * (~13 weeks) cycles through enough variety to feel fresh.
 */
export function factOfTheWeek(now: Date = new Date()): FamilyFact {
  // ISO week computation (Mon=1 ... Sun=7), independent of locale.
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dayNum = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  const weekNumber = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  const idx = (target.getUTCFullYear() * 53 + weekNumber) % FAMILY_FACTS.length
  return FAMILY_FACTS[idx]
}
