import type { NewsCategory } from "@prisma/client"

export interface NewsSource {
  name: string
  url: string
  category: NewsCategory
  trustTier: 1 | 2 | 3
}

// V2 source list — see docs/editorial-sources.md for the research behind
// each entry. RSS URLs verified live during the Apr 2026 audit.
export const NEWS_SOURCES: NewsSource[] = [
  // PARENTHOOD — news-driven + institutional voices that cluster reliably
  { name: "Le Monde Darons Daronnes",        url: "https://www.lemonde.fr/darons-daronnes/rss_full.xml",                    category: "PARENTHOOD", trustTier: 1 },
  { name: "La Croix Enfants & ados",         url: "https://www.la-croix.com/feeds/rss/Famille/Enfants-et-adolescents.xml",  category: "PARENTHOOD", trustTier: 1 },
  { name: "20 Minutes Famille",              url: "https://www.20minutes.fr/feeds/rss-famille.xml",                         category: "PARENTHOOD", trustTier: 2 },
  { name: "Franceinfo Jeunes",               url: "https://www.franceinfo.fr/l-actu-pour-les-jeunes.rss",                   category: "PARENTHOOD", trustTier: 1 },
  { name: "Fondation pour l'Enfance",        url: "https://www.fondation-enfance.org/feed/",                                category: "PARENTHOOD", trustTier: 1 },
  { name: "France Culture — Être et savoir", url: "https://radiofrance-podcast.net/podcast09/rss_11192.xml",                category: "PARENTHOOD", trustTier: 1 },
  { name: "Sortiraparis Enfant & famille",   url: "https://www.sortiraparis.com/rss/enfant-famille",                        category: "PARENTHOOD", trustTier: 3 },

  // FILM_TV
  { name: "AlloCiné Cinéma",                 url: "https://www.allocine.fr/rss/news-cine.xml",                              category: "FILM_TV",    trustTier: 1 },
  { name: "AlloCiné Séries",                 url: "https://www.allocine.fr/rss/news-series.xml",                            category: "FILM_TV",    trustTier: 1 },
  { name: "Télérama Enfants",                url: "https://www.telerama.fr/rss/enfants.xml",                                category: "FILM_TV",    trustTier: 1 },

  // GAMES
  { name: "PédaGoJeux",                      url: "https://www.pedagojeux.fr/feed/",                                        category: "GAMES",      trustTier: 1 },
  { name: "Geek Junior",                     url: "https://www.geekjunior.fr/feed/",                                        category: "GAMES",      trustTier: 2 },
  { name: "Nintendo-Master",                 url: "https://www.nintendo-master.com/feed/",                                  category: "GAMES",      trustTier: 2 },
  { name: "Numerama Pop",                    url: "https://www.numerama.com/pop-culture/feed/",                             category: "GAMES",      trustTier: 1 },
  { name: "20 Minutes Gaming",               url: "https://www.20minutes.fr/feeds/rss-gaming.xml",                          category: "GAMES",      trustTier: 2 },

  // READING
  { name: "1jour1actu",                      url: "https://feeds.feedburner.com/1jour1actu/BwmM3ey8dPF",                    category: "READING",    trustTier: 1 },
  { name: "IDBOOX Livres enfants",           url: "https://www.idboox.com/livres-enfants/feed/",                            category: "READING",    trustTier: 3 },
]
