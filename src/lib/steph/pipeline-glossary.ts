/**
 * Traduction en français clair des tâches automatiques ("les tuyaux").
 *
 * Les identifiants de tâche sont ceux réellement écrits dans `cron_logs`
 * (voir KNOWN_CRON_TASKS dans src/lib/admin-kpis.ts et EXPECTED_TASKS dans
 * src/lib/cron-supervisor.ts). Ce fichier ne fait qu'habiller ces
 * identifiants : il ne planifie rien et ne déclenche rien.
 *
 * Une seule source pour l'espace /steph : le tableau de bord ET la carte
 * mentale lisent ce glossaire, donc les deux ne peuvent pas diverger.
 */

/** Grandes familles de tâches, telles qu'affichées à l'écran. */
export type PipelineFamily =
  | "catalogue"
  | "comprehension"
  | "editorial"
  | "visibilite"
  | "familles"
  | "surveillance"

export interface PipelineFamilyInfo {
  key: PipelineFamily
  label: string
  /** Une phrase : à quoi sert cette famille de tâches. */
  tagline: string
  /** Couleur d'identité (palette Aperçu / bandeaux d'âge). */
  color: string
}

export const PIPELINE_FAMILIES: PipelineFamilyInfo[] = [
  {
    key: "catalogue",
    label: "Remplir le catalogue",
    tagline: "Aller chercher les nouveaux films, séries et jeux, tous les jours.",
    color: "#E8A87C",
  },
  {
    key: "comprehension",
    label: "Comprendre les œuvres",
    tagline: "Lire chaque titre, en tirer un âge conseillé et 8 dimensions de contenu.",
    color: "#B8D89A",
  },
  {
    key: "editorial",
    label: "Écrire et vérifier",
    tagline: "Produire les actualités, les dossiers et les rappels de relecture.",
    color: "#F8D775",
  },
  {
    key: "visibilite",
    label: "Se rendre visible",
    tagline: "Repérer les pages presque en première page de Google et les pousser.",
    color: "#8DBDC9",
  },
  {
    key: "familles",
    label: "Servir les familles",
    tagline: "Prévenir les parents quand un titre qu'ils attendent sort.",
    color: "#D89AB0",
  },
  {
    key: "surveillance",
    label: "Surveiller la machine",
    tagline: "Vérifier que tout ce qui précède a bien tourné, et alerter sinon.",
    color: "#A79BC7",
  },
]

export const PIPELINE_FAMILY_BY_KEY: Record<PipelineFamily, PipelineFamilyInfo> =
  Object.fromEntries(PIPELINE_FAMILIES.map((f) => [f.key, f])) as Record<
    PipelineFamily,
    PipelineFamilyInfo
  >

export interface PipelineTaskInfo {
  /** Identifiant exact écrit dans `cron_logs`. */
  task: string
  /** Nom lisible. */
  label: string
  family: PipelineFamily
  /** Quand la tâche est censée tourner (heures en UTC, comme la planification). */
  cadence: string
  /** Ce que la tâche fait, en une phrase sans jargon. */
  what: string
  /** Pourquoi ça compte pour le site — la conséquence si elle s'arrête. */
  why: string
  /**
   * Au-delà de ce délai sans nouvelle exécution, la tâche est « en retard ».
   * Valeurs alignées sur EXPECTED_TASKS (src/lib/cron-supervisor.ts) pour que
   * /steph et le superviseur racontent la même histoire.
   */
  staleAfterHours: number
  /**
   * Vrai quand un statut « partiel » est le fonctionnement normal
   * (rien à faire ce jour-là), et non un incident.
   */
  partialIsNormal?: boolean
}

export const PIPELINE_TASKS: PipelineTaskInfo[] = [
  // ── Remplir le catalogue ──────────────────────────────────────────
  {
    task: "import",
    label: "Import films & séries",
    family: "catalogue",
    cadence: "Tous les jours, 3 h",
    what: "Récupère les nouveaux films et séries chez TMDB, crée leur fiche, et récupère au passage les classifications officielles du CNC et les captures d'écran manquantes.",
    why: "Sans lui, plus aucune nouveauté n'entre sur le site : le rayon « Fraîchement ajoutés » se fige.",
    staleAfterHours: 36,
  },
  {
    task: "import-games",
    label: "Import jeux vidéo",
    family: "catalogue",
    cadence: "Tous les jours, 3 h",
    what: "Récupère les jeux vidéo récents et populaires depuis IGDB (base de données de jeux).",
    why: "Les jeux sont notre différence face aux autres guides français : c'est la moitié du sujet des parents.",
    staleAfterHours: 36,
  },
  {
    task: "import-preschool",
    label: "Import séries tout-petits",
    family: "catalogue",
    cadence: "Tous les jours, 3 h",
    what: "Va chercher spécifiquement les séries jeunesse, pour étoffer la tranche 2–4 ans.",
    why: "C'est la tranche d'âge la plus pauvre du catalogue : sans ce renfort, les parents de tout-petits repartent les mains vides.",
    staleAfterHours: 36,
  },
  {
    task: "games-top-names",
    label: "Gros noms du jeu vidéo",
    family: "catalogue",
    cadence: "Le lundi, 6 h 53",
    what: "Importe les jeux très recherchés (Fortnite, Roblox, Among Us…) à partir d'une liste tenue à la main.",
    why: "Ce sont les titres que les parents cherchent le plus : une fiche manquante, c'est une visite perdue.",
    staleAfterHours: 192,
    partialIsNormal: true,
  },

  // ── Comprendre les œuvres ─────────────────────────────────────────
  {
    task: "enrich",
    label: "Analyse des contenus",
    family: "comprehension",
    cadence: "Tous les jours, 4 h",
    what: "Lit synopsis, classifications et genres d'un titre, puis en déduit l'âge conseillé et les 8 dimensions de contenu.",
    why: "C'est le cœur du produit. Une fiche non analysée n'a ni « Pourquoi cet âge ? » ni jauges de contenu.",
    staleAfterHours: 36,
  },
  {
    task: "enrich-deep",
    label: "Analyse approfondie",
    family: "comprehension",
    cadence: "Tous les jours, 4 h",
    what: "Reprend quelques titres délicats avec une analyse plus poussée et une recherche sur le web.",
    why: "Rattrape les cas où la première lecture n'était pas assez sûre d'elle.",
    staleAfterHours: 36,
  },
  {
    task: "quality",
    label: "Score de complétude",
    family: "comprehension",
    cadence: "Tous les jours, 4 h",
    what: "Recalcule, pour chaque fiche, à quel point elle est complète (affiche, résumé, genres, âge, jauges) — et c'est ce passage qui fait officiellement basculer une fiche de « provisoire » à « complète ».",
    why: "Il n'y a pas de bouton « publier » sur ce site : c'est ce score qui décide si une fiche a le droit d'apparaître en page d'accueil et dans les sélections.",
    staleAfterHours: 36,
  },
  {
    task: "synopsis-audit",
    label: "Relecture des résumés",
    family: "comprehension",
    cadence: "Tous les jours, 4 h",
    what: "Passe une correction de grammaire et de ton sur les résumés en français.",
    why: "Un résumé maladroit décrédibilise toute la fiche. La tâche se vide d'elle-même quand tout est relu.",
    staleAfterHours: 36,
    partialIsNormal: true,
  },
  {
    task: "age-floor",
    label: "Plancher d'âge",
    family: "comprehension",
    cadence: "Le samedi, 5 h",
    what: "Vérifie qu'aucun titre sensible n'est descendu sous son âge minimum, et le remonte si besoin.",
    why: "C'est le garde-fou promis aux parents : jamais d'âge trop bas sur un contenu difficile. Il ne coûte rien et ne se trompe pas.",
    staleAfterHours: 192,
    partialIsNormal: true,
  },
  {
    task: "backfill-ratings",
    label: "Notes du public",
    family: "comprehension",
    cadence: "Le samedi, 5 h",
    what: "Récupère les notes du public TMDB, conservées en interne et jamais affichées aux visiteurs.",
    why: "Elles servent uniquement à trier : mettre en avant les bons titres plutôt que des obscurités.",
    staleAfterHours: 240,
    partialIsNormal: true,
  },
  {
    task: "streaming",
    label: "Où le regarder",
    family: "comprehension",
    cadence: "Le samedi, 5 h",
    what: "Met à jour les plateformes (Netflix, Disney+, Prime…) où chaque titre est disponible en France.",
    why: "« C'est bien pour mon enfant, mais où je le trouve ? » — sans ça, la réponse manque.",
    staleAfterHours: 192,
  },
  {
    task: "similarity",
    label: "Titres proches",
    family: "comprehension",
    cadence: "Le samedi, 5 h",
    what: "Calcule quels titres se ressemblent, pour alimenter « Dans le même esprit » et les recommandations.",
    why: "C'est ce qui permet de rebondir d'une fiche à l'autre au lieu de repartir sur Google.",
    staleAfterHours: 192,
    partialIsNormal: true,
  },
  {
    task: "revert-unreleased",
    label: "Fiches trop en avance",
    family: "comprehension",
    cadence: "Le dimanche, 6 h 43",
    what: "Repère les titres pas encore sortis qui auraient reçu une analyse détaillée, et la retire.",
    why: "Impossible d'analyser sérieusement un film que personne n'a vu : mieux vaut afficher « à confirmer » que d'inventer.",
    staleAfterHours: 192,
    partialIsNormal: true,
  },

  // ── Écrire et vérifier ────────────────────────────────────────────
  {
    task: "news-discover",
    label: "Actualités",
    family: "editorial",
    cadence: "4 fois par jour (0 h, 6 h, 12 h, 18 h — à :17)",
    what: "Parcourt la presse famille, en tire des brèves synthétisées et les publie avec leurs sources.",
    why: "C'est le contenu qui change tous les jours : la raison de revenir sur le site sans y être poussé.",
    staleAfterHours: 10,
  },
  {
    task: "news.pressKitScout",
    label: "Repérage des espaces presse",
    family: "editorial",
    cadence: "4 fois par jour, après les actualités",
    what: "Détecte les espaces presse officiels des éditeurs et les enregistre comme pistes d'images.",
    why: "Utiliser des images officielles plutôt que des photos trouvées au hasard : question de sérieux et de droits.",
    staleAfterHours: 10,
    partialIsNormal: true,
  },
  {
    task: "weekly-dossier",
    label: "Dossier de la semaine",
    family: "editorial",
    cadence: "Mardi et vendredi, 5 h",
    what: "Assemble les brèves des sept derniers jours en un article de fond.",
    why: "Le format long est ce qui fait exister le mot « guide » — et ce que citent les moteurs de recherche.",
    staleAfterHours: 96,
    partialIsNormal: true,
  },
  {
    task: "family-content-agent",
    label: "Priorités éditoriales",
    family: "editorial",
    cadence: "Le lundi, 6 h",
    what: "Envoie par e-mail la liste des contenus famille à traiter en priorité cette semaine.",
    why: "C'est la to-do list hebdomadaire : elle transforme les trous du catalogue en tâches concrètes.",
    staleAfterHours: 192,
  },
  {
    task: "game-guides-check",
    label: "Relecture des guides parents",
    family: "editorial",
    cadence: "Le 1er de chaque mois, 6 h 33",
    what: "Signale les blocs « état du jeu » à relire et teste si les liens officiels des éditeurs répondent encore.",
    why: "Un contrôle parental décrit alors qu'il n'existe plus, c'est un parent trompé. Aucune machine ne revérifie les faits à notre place.",
    staleAfterHours: 800,
    partialIsNormal: true,
  },

  // ── Se rendre visible ─────────────────────────────────────────────
  {
    task: "seo-striking-distance",
    label: "Pages à un pas de la 1re page",
    family: "visibilite",
    cadence: "Le jeudi, 6 h 23",
    what: "Repère dans Search Console les recherches où l'on est 8e à 20e, puis retouche les fiches concernées.",
    why: "Passer de la 2e à la 1re page multiplie les visites : c'est le levier de trafic le moins cher du site.",
    staleAfterHours: 192,
    partialIsNormal: true,
  },

  // ── Servir les familles ───────────────────────────────────────────
  {
    task: "release-alerts",
    label: "Alertes de sortie",
    family: "familles",
    cadence: "Tous les jours, 3 h",
    what: "Prévient les parents qui ont cliqué « Prévenez-moi » qu'un titre attendu vient de sortir.",
    why: "La seule notification que l'on envoie : c'est une promesse faite à un parent, elle doit être tenue.",
    staleAfterHours: 36,
  },

  // ── Surveiller la machine ─────────────────────────────────────────
  {
    task: "cron-supervisor",
    label: "Superviseur",
    family: "surveillance",
    cadence: "Tous les jours, 7 h",
    what: "Contrôle que chaque tâche a bien tourné, relance les cas simples et envoie un résumé en cas d'anomalie.",
    why: "C'est le contremaître : sans lui, une tâche pourrait s'arrêter pendant des semaines sans que personne le voie.",
    staleAfterHours: 36,
  },
  {
    task: "heartbeat",
    label: "Battement de cœur",
    family: "surveillance",
    cadence: "Tous les jours, 8 h",
    what: "Vérifie, depuis un autre hébergeur, que les tâches quotidiennes ont bien laissé une trace.",
    why: "Il surveille le superviseur lui-même : si toute la chaîne tombe, c'est lui qui donne l'alerte.",
    staleAfterHours: 50,
    partialIsNormal: true,
  },
  {
    task: "debt-digest",
    label: "Bilan hebdomadaire",
    family: "surveillance",
    cadence: "Le mercredi, 6 h 13",
    what: "Envoie un e-mail récapitulatif : santé des tâches, trous du catalogue, file éditoriale.",
    why: "Le point hebdo sur ce qui s'accumule lentement — ce qu'un contrôle quotidien ne voit pas passer.",
    staleAfterHours: 200,
    partialIsNormal: true,
  },
]

export const PIPELINE_TASK_BY_ID: Record<string, PipelineTaskInfo> = Object.fromEntries(
  PIPELINE_TASKS.map((t) => [t.task, t])
)

/**
 * Habillage d'une tâche inconnue du glossaire (nouvelle tâche ajoutée au
 * code sans passer ici). On préfère un affichage honnête et neutre à une
 * ligne manquante : /steph doit montrer tout ce que /admin montre.
 */
export function describeTask(task: string): PipelineTaskInfo {
  return (
    PIPELINE_TASK_BY_ID[task] ?? {
      task,
      label: task,
      family: "surveillance",
      cadence: "Cadence non documentée",
      what: "Cette tâche n'est pas encore décrite dans le glossaire de cet espace.",
      why: "Demandez à Xavier de la documenter dans src/lib/steph/pipeline-glossary.ts.",
      staleAfterHours: 192,
      partialIsNormal: true,
    }
  )
}
