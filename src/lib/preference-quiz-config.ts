/**
 * Shared preference-quiz vocabulary — single source for UI + scoring alignment.
 * Quiz v2 splits "hard avoid" (mature genres) from "soft dislike" (broad TMDB tags).
 */

export const QUIZ_VERSION = 2

/** All genres offered in the "j'aime" step (films, TV, games). */
export const QUIZ_FAVORITE_GENRES = [
  "Animation",
  "Aventure",
  "Comédie",
  "Fantastique",
  "Science-Fiction",
  "Famille",
  "Action",
  "Documentaire",
  "Musical",
  "Drame",
  "Romance",
  "Mystère",
  "Crime",
  "Thriller",
  "Horreur",
  "Plateforme",
  "Stratégie",
  "Simulation",
  "RPG",
  "Sport",
  "Course",
  "Puzzle",
] as const

/** Hard block — maps to MATURE_GENRES in family-fit-score. */
export const QUIZ_HARD_AVOID_GENRES = [
  "Horreur",
  "Thriller",
  "Crime",
  "Épouvante",
] as const

/** Soft signal — down-ranks, never silently removes from browse/reco. */
export const QUIZ_SOFT_DISLIKE_GENRES = [
  "Drame",
  "Romance",
  "Comédie",
  "Action",
  "Documentaire",
  "Musical",
  "Mystère",
] as const

/** Subset of enrich VALID_TOPICS — parent-facing "themes to avoid". */
export const QUIZ_AVOID_TOPICS = [
  "Guerre",
  "Deuil",
  "Divorce",
  "Harcèlement",
  "Premiers amours",
  "Mort d'un parent",
  "Maladie grave",
  "Drogue",
  "Suicide",
  "Religion",
] as const

/** Quick-pick interests → FamilyMember.interests (matches enrich topics). */
export const QUIZ_INTEREST_CHIPS = [
  "Espace",
  "Dinosaures",
  "Animaux",
  "Super-héros",
  "Magie",
  "Sport",
  "Musique",
  "Enquête/Mystère",
  "Robots",
  "Nature",
  "Histoire",
  "Jeux vidéo",
] as const

export const QUIZ_SENSITIVITY_OPTIONS = [
  { value: 0, emoji: "😎", label: "Pas du tout", description: "Aucun problème" },
  { value: 1, emoji: "🙂", label: "Un peu", description: "Tolère sans souci" },
  { value: 2, emoji: "😐", label: "Plutôt oui", description: "Préfère éviter" },
  { value: 3, emoji: "🚫", label: "Beaucoup", description: "À éviter absolument" },
] as const

export const QUIZ_POSITIVE_OPTIONS = [
  { value: 0, label: "Indifférent" },
  { value: 1, label: "Apprécié" },
  { value: 2, label: "Important" },
  { value: 3, label: "Essentiel" },
] as const

export const QUIZ_GAMEPLAY_STYLES = [
  { value: "Jeu solo", label: "Solo", emoji: "🎮" },
  { value: "Jeu coop", label: "En coop", emoji: "🤝" },
  { value: "Jeu en famille", label: "En famille", emoji: "🛋️" },
  { value: "Jeu compétitif", label: "Compétitif en ligne", emoji: "🏆" },
] as const
