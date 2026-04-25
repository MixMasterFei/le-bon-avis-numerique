import type { NewsCategory } from "@prisma/client"

export interface NewsSource {
  name: string
  url: string
  category: NewsCategory
  trustTier: 1 | 2 | 3
  // "FR" = domestic French press (default). "INTL" = international
  // family/parenting/screen-time press. INTL items get translated +
  // framed for French families during synthesis and surface under the
  // "Vu d'ailleurs" tab on /actualites.
  region?: "FR" | "INTL"
  // Country code for INTL sources (informational; helps the synthesis
  // prompt write "Aux États-Unis…" / "En Allemagne…" framing).
  country?: string
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

  // ── INTERNATIONAL (Vu d'ailleurs) ───────────────────────────────
  // Family/parenting/screen-time press from outside France. Synthesized
  // + translated into French for the "Vu d'ailleurs" tab. Curated to
  // skip the gossip/lifestyle press and stick to substantive sources.

  // PARENTHOOD international
  { name: "NYT Well Family",                  url: "https://rss.nytimes.com/services/xml/rss/nyt/FamilyandRelationships.xml", category: "PARENTHOOD", trustTier: 1, region: "INTL", country: "US" },
  { name: "BBC Family & Education",           url: "https://feeds.bbci.co.uk/news/education/rss.xml",                         category: "PARENTHOOD", trustTier: 1, region: "INTL", country: "UK" },
  { name: "Guardian Family",                  url: "https://www.theguardian.com/lifeandstyle/family/rss",                     category: "PARENTHOOD", trustTier: 1, region: "INTL", country: "UK" },
  { name: "Common Sense Media — News",        url: "https://www.commonsensemedia.org/rss.xml",                                category: "PARENTHOOD", trustTier: 1, region: "INTL", country: "US" },
  { name: "Pew Research — Internet & Tech",   url: "https://www.pewresearch.org/internet/feed/",                              category: "PARENTHOOD", trustTier: 1, region: "INTL", country: "US" },

  // FILM_TV international
  { name: "Variety Family",                   url: "https://variety.com/v/film/feed/",                                        category: "FILM_TV",    trustTier: 2, region: "INTL", country: "US" },
  { name: "Hollywood Reporter Animation",     url: "https://www.hollywoodreporter.com/c/movies/animation/feed/",              category: "FILM_TV",    trustTier: 2, region: "INTL", country: "US" },
  { name: "BBC Culture",                      url: "https://www.bbc.com/culture/feed.rss",                                    category: "FILM_TV",    trustTier: 1, region: "INTL", country: "UK" },

  // GAMES international
  { name: "Polygon",                          url: "https://www.polygon.com/rss/index.xml",                                   category: "GAMES",      trustTier: 1, region: "INTL", country: "US" },
  { name: "GameSpot Family",                  url: "https://www.gamespot.com/feeds/news/",                                    category: "GAMES",      trustTier: 2, region: "INTL", country: "US" },

  // READING international
  { name: "Publishers Weekly Children's",     url: "https://www.publishersweekly.com/pw/feeds/recent/childrens.xml",          category: "READING",    trustTier: 1, region: "INTL", country: "US" },
  { name: "School Library Journal",           url: "https://www.slj.com/?feed=rss2",                                          category: "READING",    trustTier: 1, region: "INTL", country: "US" },
]
