import type { NewsCategory } from "@prisma/client"

export interface NewsSource {
  name: string
  url: string
  category: NewsCategory
  trustTier: 1 | 2 | 3
}

// V1 starter set. Dead feeds are silently skipped at fetch time; entries
// can be tuned locally without touching the cron handler.
export const NEWS_SOURCES: NewsSource[] = [
  // Parentalité
  { name: "Magicmaman",        url: "https://www.magicmaman.com/rss.xml",                     category: "PARENTHOOD", trustTier: 2 },
  { name: "Famili",            url: "https://www.famili.fr/famille/rss",                      category: "PARENTHOOD", trustTier: 2 },
  { name: "La Croix Famille",  url: "https://www.la-croix.com/RSS/univers_famille",           category: "PARENTHOOD", trustTier: 1 },

  // Cinéma & séries
  { name: "AlloCiné",          url: "http://rss.allocine.fr/ac/cine/cettesemaine/",           category: "FILM_TV",    trustTier: 1 },
  { name: "Première",          url: "https://www.premiere.fr/rss/actualite-cinema",           category: "FILM_TV",    trustTier: 2 },
  { name: "BetaSeries",        url: "https://www.betaseries.com/rss/news.xml",                category: "FILM_TV",    trustTier: 2 },

  // Jeux vidéo
  { name: "Gamekult",          url: "https://www.gamekult.com/feed.xml",                      category: "GAMES",      trustTier: 1 },
  { name: "JeuxVideo.com",     url: "https://www.jeuxvideo.com/rss/rss.xml",                  category: "GAMES",      trustTier: 2 },

  // Lectures recommandées
  { name: "Télérama Idées",    url: "https://www.telerama.fr/rss/idees.xml",                  category: "READING",    trustTier: 1 },
  { name: "France Inter",      url: "https://www.radiofrance.fr/franceinter/rss",             category: "READING",    trustTier: 1 },
  { name: "Le Monde Idées",    url: "https://www.lemonde.fr/idees/rss_full.xml",              category: "READING",    trustTier: 1 },
]
