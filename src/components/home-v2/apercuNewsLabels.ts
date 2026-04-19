import type { NewsCategory } from "@prisma/client"

export type NewsCategoryKey = NewsCategory | "ALL"

export const NEWS_CATEGORY_LABEL: Record<NewsCategoryKey, string> = {
  ALL: "Tous",
  PARENTHOOD: "Parentalité",
  FILM_TV: "Cinéma & séries",
  GAMES: "Jeux vidéo",
  READING: "Lectures",
}

export const NEWS_CATEGORY_ORDER: NewsCategoryKey[] = [
  "ALL",
  "PARENTHOOD",
  "FILM_TV",
  "GAMES",
  "READING",
]
