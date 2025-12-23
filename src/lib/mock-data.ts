// Mock data for development without database
export interface MockMediaItem {
  id: string
  title: string
  originalTitle?: string
  type: "MOVIE" | "TV" | "GAME" | "BOOK" | "APP"
  releaseDate: string | null
  posterUrl: string
  synopsisFr: string | null
  officialRating: string | null
  expertAgeRec: number | null
  communityAgeRec: number | null
  duration?: number
  director?: string
  genres: string[]
  platforms: string[]
  topics: string[]
  contentMetrics: {
    violence: number
    sexNudity: number
    language: number
    consumerism: number
    substanceUse: number
    positiveMessages: number
    roleModels: number
    whatParentsNeedToKnow: string[]
  }
  reviews: {
    id: string
    role: "PARENT" | "KID" | "EDUCATOR"
    rating: number
    ageSuggestion: number
    comment: string
  }[]
}

export const mockMediaItems: MockMediaItem[] = [
  {
    id: "1",
    title: "Le Roi Lion",
    originalTitle: "The Lion King",
    type: "MOVIE",
    releaseDate: "2019-07-17",
    posterUrl: "https://image.tmdb.org/t/p/w500/sKCr78MXSLixwmZ8DyJLrpMsd15.jpg",
    synopsisFr: "Au fond de la savane africaine, tous les animaux célèbrent la naissance de Simba, leur futur roi. Les mois passent. Simba idolâtre son père, le roi Mufasa, qui prend à cœur de lui faire comprendre les enjeux de sa royale destinée.",
    officialRating: "TOUS_PUBLICS",
    expertAgeRec: 6,
    communityAgeRec: 7.2,
    duration: 118,
    director: "Jon Favreau",
    genres: ["Animation", "Aventure", "Famille"],
    platforms: ["Disney+"],
    topics: ["Animaux", "Famille", "Royauté", "Afrique"],
    contentMetrics: {
      violence: 2,
      sexNudity: 0,
      language: 1,
      consumerism: 1,
      substanceUse: 0,
      positiveMessages: 5,
      roleModels: 4,
      whatParentsNeedToKnow: [
        "Contient une scène de mort d'un personnage principal qui peut être émouvante pour les jeunes enfants",
        "Excellents thèmes sur la responsabilité et le courage",
        "Quelques scènes effrayantes avec les hyènes",
      ],
    },
    reviews: [
      {
        id: "r1",
        role: "PARENT",
        rating: 5,
        ageSuggestion: 7,
        comment: "Un classique magnifique, mais la mort de Mufasa reste difficile pour les tout-petits.",
      },
      {
        id: "r2",
        role: "KID",
        rating: 5,
        ageSuggestion: 6,
        comment: "J'adore Simba et les chansons !",
      },
    ],
  },
  {
    id: "2",
    title: "Minecraft",
    type: "GAME",
    releaseDate: "2011-11-18",
    posterUrl: "https://image.api.playstation.com/vulcan/img/cfn/11307uYG0CXzRuA9aryByTHYrQLFz-HVQ3VVl7aAysxK15HMpqjkAIcC_R5vdfZt52hAXQNHoYhSuoSq_46_MT_tDBcLu49I.png",
    synopsisFr: "Minecraft est un jeu vidéo de type bac à sable développé par Mojang Studios. Le jeu permet aux joueurs de construire et d'explorer des mondes générés aléatoirement, composés de blocs.",
    officialRating: "PEGI_7",
    expertAgeRec: 7,
    communityAgeRec: 6.5,
    genres: ["Bac à sable", "Survie", "Créatif"],
    platforms: ["PC", "PlayStation", "Xbox", "Nintendo Switch", "Mobile"],
    topics: ["Créativité", "Construction", "Exploration", "Programmation"],
    contentMetrics: {
      violence: 1,
      sexNudity: 0,
      language: 0,
      consumerism: 2,
      substanceUse: 0,
      positiveMessages: 4,
      roleModels: 3,
      whatParentsNeedToKnow: [
        "Encourage la créativité et la résolution de problèmes",
        "Le mode multijoueur nécessite une supervision parentale",
        "Achats intégrés disponibles sur certaines versions",
      ],
    },
    reviews: [
      {
        id: "r3",
        role: "PARENT",
        rating: 4,
        ageSuggestion: 7,
        comment: "Excellent pour la créativité, mais attention au temps d'écran !",
      },
    ],
  },
  {
    id: "3",
    title: "Harry Potter à l'école des sorciers",
    originalTitle: "Harry Potter and the Philosopher's Stone",
    type: "MOVIE",
    releaseDate: "2001-12-05",
    posterUrl: "https://image.tmdb.org/t/p/w500/wuMc08IPKEatf9rnMNXvIDxqP4W.jpg",
    synopsisFr: "Orphelin, Harry Potter a été recueilli à contrecœur par son oncle Vernon et sa tante Pétunia, aussi cruels que mesquins. Le jour de ses onze ans, Harry reçoit une lettre mystérieuse l'invitant à rejoindre Poudlard.",
    officialRating: "TOUS_PUBLICS",
    expertAgeRec: 8,
    communityAgeRec: 8.5,
    duration: 152,
    director: "Chris Columbus",
    genres: ["Fantastique", "Aventure", "Famille"],
    platforms: ["Netflix France", "Prime Video"],
    topics: ["Magie", "Amitié", "École", "Fantastique"],
    contentMetrics: {
      violence: 2,
      sexNudity: 0,
      language: 1,
      consumerism: 2,
      substanceUse: 0,
      positiveMessages: 5,
      roleModels: 5,
      whatParentsNeedToKnow: [
        "Quelques scènes effrayantes (troll, Voldemort)",
        "Excellents thèmes sur l'amitié et le courage",
        "Peut inspirer l'amour de la lecture",
      ],
    },
    reviews: [
      {
        id: "r4",
        role: "PARENT",
        rating: 5,
        ageSuggestion: 8,
        comment: "Un film magique qui a donné envie à mes enfants de lire les livres !",
      },
    ],
  },
  {
    id: "4",
    title: "Bluey",
    type: "TV",
    releaseDate: "2018-10-01",
    posterUrl: "https://image.tmdb.org/t/p/w500/9xtgBK5qLzHiRvLvCKhPcZr7USE.jpg",
    synopsisFr: "Bluey est une petite chienne de six ans infatigable et curieuse. Elle transforme tous les jours en aventures extraordinaires avec sa sœur Bingo et ses parents.",
    officialRating: "TOUS_PUBLICS",
    expertAgeRec: 3,
    communityAgeRec: 3.5,
    duration: 7,
    genres: ["Animation", "Comédie", "Famille"],
    platforms: ["Disney+", "France TV"],
    topics: ["Famille", "Jeux", "Imagination", "Émotions"],
    contentMetrics: {
      violence: 0,
      sexNudity: 0,
      language: 0,
      consumerism: 0,
      substanceUse: 0,
      positiveMessages: 5,
      roleModels: 5,
      whatParentsNeedToKnow: [
        "Parfait pour les tout-petits",
        "Épisodes courts idéaux pour les temps de pause",
        "Modèles parentaux positifs",
      ],
    },
    reviews: [
      {
        id: "r5",
        role: "PARENT",
        rating: 5,
        ageSuggestion: 3,
        comment: "La meilleure série pour enfants ! Les parents adorent aussi.",
      },
    ],
  },
  {
    id: "5",
    title: "Le Petit Prince",
    type: "BOOK",
    releaseDate: "1943-04-06",
    posterUrl: "https://m.media-amazon.com/images/I/81fXBeYYxpL._AC_UF1000,1000_QL80_.jpg",
    synopsisFr: "Le Petit Prince est une œuvre poétique et philosophique d'Antoine de Saint-Exupéry. Un pilote d'avion, tombé en panne dans le désert du Sahara, rencontre un petit garçon venu d'une autre planète.",
    officialRating: "TOUS_PUBLICS",
    expertAgeRec: 6,
    communityAgeRec: 7.0,
    director: "Antoine de Saint-Exupéry",
    genres: ["Conte", "Philosophie", "Littérature jeunesse"],
    platforms: [],
    topics: ["Amitié", "Philosophie", "Voyage", "Imaginaire"],
    contentMetrics: {
      violence: 0,
      sexNudity: 0,
      language: 0,
      consumerism: 0,
      substanceUse: 0,
      positiveMessages: 5,
      roleModels: 5,
      whatParentsNeedToKnow: [
        "Un classique intemporel de la littérature française",
        "Thèmes profonds accessibles à différents niveaux selon l'âge",
        "Parfait pour une lecture partagée parent-enfant",
      ],
    },
    reviews: [
      {
        id: "r6",
        role: "EDUCATOR",
        rating: 5,
        ageSuggestion: 7,
        comment: "Indispensable dans toute bibliothèque. À relire à chaque âge de la vie.",
      },
    ],
  },
  {
    id: "6",
    title: "Spider-Man: Across the Spider-Verse",
    originalTitle: "Spider-Man: Across the Spider-Verse",
    type: "MOVIE",
    releaseDate: "2023-05-31",
    posterUrl: "https://image.tmdb.org/t/p/w500/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg",
    synopsisFr: "Miles Morales traverse le multivers et rencontre une équipe de Spider-People chargés de protéger son existence même. Mais quand les héros s'affrontent sur la façon de gérer une nouvelle menace, Miles doit repenser ce que signifie être un héros.",
    officialRating: "TOUS_PUBLICS",
    expertAgeRec: 9,
    communityAgeRec: 9.5,
    duration: 140,
    director: "Joaquim Dos Santos",
    genres: ["Animation", "Action", "Aventure", "Science-Fiction"],
    platforms: ["Netflix France", "Prime Video"],
    topics: ["Super-héros", "Identité", "Famille", "Multivers"],
    contentMetrics: {
      violence: 3,
      sexNudity: 0,
      language: 1,
      consumerism: 2,
      substanceUse: 0,
      positiveMessages: 5,
      roleModels: 4,
      whatParentsNeedToKnow: [
        "Animation visuellement intense avec beaucoup d'action",
        "Thèmes matures sur l'identité et les choix difficiles",
        "Excellent pour les discussions parent-enfant sur la responsabilité",
      ],
    },
    reviews: [
      {
        id: "r7",
        role: "PARENT",
        rating: 5,
        ageSuggestion: 10,
        comment: "Visuellement époustouflant ! Parfait pour les préados.",
      },
    ],
  },
  {
    id: "7",
    title: "Roblox",
    type: "APP",
    releaseDate: "2006-09-01",
    posterUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Roblox_player_icon_black.svg/1200px-Roblox_player_icon_black.svg.png",
    synopsisFr: "Roblox est une plateforme de jeux en ligne qui permet aux utilisateurs de créer et partager leurs propres jeux. Des millions d'expériences créées par la communauté sont disponibles.",
    officialRating: "PEGI_7",
    expertAgeRec: 10,
    communityAgeRec: 9.0,
    genres: ["Plateforme de jeux", "Social", "Créatif"],
    platforms: ["PC", "Mobile", "Xbox", "PlayStation"],
    topics: ["Créativité", "Social", "Jeux", "Programmation"],
    contentMetrics: {
      violence: 2,
      sexNudity: 1,
      language: 2,
      consumerism: 4,
      substanceUse: 0,
      positiveMessages: 3,
      roleModels: 2,
      whatParentsNeedToKnow: [
        "Contenu généré par les utilisateurs - qualité variable",
        "Chat en ligne avec des inconnus - supervision nécessaire",
        "Forte pression pour les achats intégrés (Robux)",
        "Paramètres de contrôle parental disponibles et recommandés",
      ],
    },
    reviews: [
      {
        id: "r8",
        role: "PARENT",
        rating: 3,
        ageSuggestion: 10,
        comment: "Mes enfants adorent, mais surveillance obligatoire et limites de temps nécessaires.",
      },
    ],
  },
  {
    id: "8",
    title: "Stranger Things",
    type: "TV",
    releaseDate: "2016-07-15",
    posterUrl: "https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg",
    synopsisFr: "Dans les années 80, un garçon disparaît mystérieusement dans la petite ville de Hawkins. Ses amis, sa famille et la police locale sont confrontés à des forces terrifiantes.",
    officialRating: "CSA_12",
    expertAgeRec: 13,
    communityAgeRec: 12.5,
    genres: ["Science-Fiction", "Horreur", "Drame"],
    platforms: ["Netflix France"],
    topics: ["Années 80", "Surnaturel", "Amitié", "Suspense"],
    contentMetrics: {
      violence: 4,
      sexNudity: 2,
      language: 3,
      consumerism: 1,
      substanceUse: 2,
      positiveMessages: 4,
      roleModels: 4,
      whatParentsNeedToKnow: [
        "Scènes d'horreur intenses et créatures effrayantes",
        "Violence modérée à forte selon les saisons",
        "Excellente représentation de l'amitié et de la loyauté",
        "Références nostalgiques aux années 80",
      ],
    },
    reviews: [
      {
        id: "r9",
        role: "PARENT",
        rating: 4,
        ageSuggestion: 13,
        comment: "Série captivante mais vraiment pas pour les moins de 12 ans.",
      },
    ],
  },
]

// Helper to get items by type
export function getMediaByType(type: MockMediaItem["type"]) {
  return mockMediaItems.filter((item) => item.type === type)
}

// Helper to search media
export function searchMedia(query: string) {
  const lowercaseQuery = query.toLowerCase()
  return mockMediaItems.filter(
    (item) =>
      item.title.toLowerCase().includes(lowercaseQuery) ||
      (item.synopsisFr ? item.synopsisFr.toLowerCase().includes(lowercaseQuery) : false) ||
      item.genres.some((g) => g.toLowerCase().includes(lowercaseQuery)) ||
      item.topics.some((t) => t.toLowerCase().includes(lowercaseQuery))
  )
}

// Helper to filter by age
export function filterByAge(items: MockMediaItem[], maxAge: number) {
  return items.filter((item) => (item.expertAgeRec ?? 99) <= maxAge)
}

// Helper to filter by platform
export function filterByPlatform(items: MockMediaItem[], platform: string) {
  return items.filter((item) =>
    item.platforms.some((p) => p.toLowerCase().includes(platform.toLowerCase()))
  )
}


