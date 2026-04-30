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
  // Family magazines — high volume, lifestyle-leaning but mass-market
  { name: "Magicmaman",                      url: "https://www.magicmaman.com/rss/index.xml",                               category: "PARENTHOOD", trustTier: 2 },
  { name: "Parents.fr",                      url: "https://www.parents.fr/rss",                                             category: "PARENTHOOD", trustTier: 2 },
  // Education professional press — strong institutional signal for
  // school news, ministerial decisions, parent-school tensions
  { name: "Café Pédagogique",                url: "https://www.cafepedagogique.net/feed/",                                  category: "PARENTHOOD", trustTier: 1 },
  { name: "VousNousIls",                     url: "https://www.vousnousils.fr/feed",                                        category: "PARENTHOOD", trustTier: 1 },
  // Public-health / research institutions — low volume but each item
  // is gold (cited studies, official recommendations, methodology
  // populates the "Ce que dit la recherche" sidebar)
  { name: "INSERM Actualités",               url: "https://presse.inserm.fr/feed/",                                         category: "PARENTHOOD", trustTier: 1 },
  { name: "Santé publique France",           url: "https://www.santepubliquefrance.fr/rss/communiques.xml",                 category: "PARENTHOOD", trustTier: 1 },

  // FILM_TV
  { name: "AlloCiné Cinéma",                 url: "https://www.allocine.fr/rss/news-cine.xml",                              category: "FILM_TV",    trustTier: 1 },
  { name: "AlloCiné Séries",                 url: "https://www.allocine.fr/rss/news-series.xml",                            category: "FILM_TV",    trustTier: 1 },
  { name: "Télérama Enfants",                url: "https://www.telerama.fr/rss/enfants.xml",                                category: "FILM_TV",    trustTier: 1 },
  { name: "Première",                        url: "https://www.premiere.fr/rss/news.xml",                                   category: "FILM_TV",    trustTier: 2 },

  // GAMES
  { name: "PédaGoJeux",                      url: "https://www.pedagojeux.fr/feed/",                                        category: "GAMES",      trustTier: 1 },
  { name: "Geek Junior",                     url: "https://www.geekjunior.fr/feed/",                                        category: "GAMES",      trustTier: 2 },
  { name: "Nintendo-Master",                 url: "https://www.nintendo-master.com/feed/",                                  category: "GAMES",      trustTier: 2 },
  { name: "Numerama Pop",                    url: "https://www.numerama.com/pop-culture/feed/",                             category: "GAMES",      trustTier: 1 },
  { name: "20 Minutes Gaming",               url: "https://www.20minutes.fr/feeds/rss-gaming.xml",                          category: "GAMES",      trustTier: 2 },
  { name: "Jeuxvideo.com",                   url: "https://www.jeuxvideo.com/rss/rss-news.xml",                             category: "GAMES",      trustTier: 2 },

  // TECH — generative AI, parental tech, social media regulation,
  // screen-time tools, EdTech, devices. The synthesis filter narrows
  // each broad-tech feed to family-relevant items via the editorial
  // line. Distinct from GAMES (video game industry / releases).
  { name: "Numerama Tech",                   url: "https://www.numerama.com/tech/feed/",                                    category: "TECH",       trustTier: 1 },
  { name: "Frandroid",                       url: "https://www.frandroid.com/feed",                                         category: "TECH",       trustTier: 2 },
  { name: "Le Monde Pixels",                 url: "https://www.lemonde.fr/pixels/rss_full.xml",                             category: "TECH",       trustTier: 1 },
  { name: "01net",                           url: "https://www.01net.com/actualites/feed/",                                 category: "TECH",       trustTier: 2 },
  { name: "Korben",                          url: "https://korben.info/feed",                                               category: "TECH",       trustTier: 3 },
  { name: "ZDNet France",                    url: "https://www.zdnet.fr/feeds/rss/actualites/",                             category: "TECH",       trustTier: 2 },
  { name: "Siècle Digital",                  url: "https://siecledigital.fr/feed/",                                         category: "TECH",       trustTier: 2 },

  // READING — children's literature is thin in our base; expanding to
  // give the page a real reading-news anchor
  { name: "1jour1actu",                      url: "https://feeds.feedburner.com/1jour1actu/BwmM3ey8dPF",                    category: "READING",    trustTier: 1 },
  { name: "IDBOOX Livres enfants",           url: "https://www.idboox.com/livres-enfants/feed/",                            category: "READING",    trustTier: 3 },
  { name: "Ricochet — Littérature jeunesse", url: "https://www.ricochet-jeunes.org/rss.xml",                                category: "READING",    trustTier: 1 },
  { name: "Babelio Jeunesse",                url: "https://www.babelio.com/rss/genre/15.xml",                               category: "READING",    trustTier: 2 },
  { name: "Lire Magazine",                   url: "https://www.lire.fr/rss",                                                category: "READING",    trustTier: 2 },

  // ── INTERNATIONAL (Vu d'ailleurs) ───────────────────────────────
  // Family/parenting/screen-time press from outside France. Synthesized
  // + translated into French for the "Vu d'ailleurs" tab. Curated to
  // skip the gossip/lifestyle press and stick to substantive sources.

  // PARENTHOOD international — US/UK anchors + EU diversity
  { name: "NYT Well Family",                  url: "https://rss.nytimes.com/services/xml/rss/nyt/FamilyandRelationships.xml", category: "PARENTHOOD", trustTier: 1, region: "INTL", country: "US" },
  { name: "BBC Family & Education",           url: "https://feeds.bbci.co.uk/news/education/rss.xml",                         category: "PARENTHOOD", trustTier: 1, region: "INTL", country: "UK" },
  { name: "Guardian Family",                  url: "https://www.theguardian.com/lifeandstyle/family/rss",                     category: "PARENTHOOD", trustTier: 1, region: "INTL", country: "UK" },
  { name: "Common Sense Media — News",        url: "https://www.commonsensemedia.org/rss.xml",                                category: "PARENTHOOD", trustTier: 1, region: "INTL", country: "US" },
  { name: "Pew Research — Internet & Tech",   url: "https://www.pewresearch.org/internet/feed/",                              category: "PARENTHOOD", trustTier: 1, region: "INTL", country: "US" },
  // Germany
  { name: "Spiegel Familie",                  url: "https://www.spiegel.de/familie/index.rss",                                category: "PARENTHOOD", trustTier: 1, region: "INTL", country: "DE" },
  // Süddeutsche has no family-specific RSS path — Topthemen is the
  // stable feed and the synthesis filter narrows to family content.
  { name: "Süddeutsche — Topthemen",          url: "https://rss.sueddeutsche.de/rss/Topthemen",                               category: "PARENTHOOD", trustTier: 1, region: "INTL", country: "DE" },
  // Italy
  // Repubblica's school-specific RSS was retired; using homepage feed
  // (synthesis filter culls non-family items).
  { name: "Repubblica",                       url: "https://www.repubblica.it/rss/homepage/rss2.0.xml",                       category: "PARENTHOOD", trustTier: 1, region: "INTL", country: "IT" },
  { name: "Corriere — Scuola",                url: "https://xml2.corriereobjects.it/rss/scuola.xml",                          category: "PARENTHOOD", trustTier: 1, region: "INTL", country: "IT" },
  // Spain
  { name: "El País — Mamás & Papás",          url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/mamas-papas/portada", category: "PARENTHOOD", trustTier: 1, region: "INTL", country: "ES" },
  // Netherlands
  { name: "NL Times Family",                  url: "https://nltimes.nl/rss.xml",                                              category: "PARENTHOOD", trustTier: 2, region: "INTL", country: "NL" },

  // FILM_TV international
  { name: "Variety Family",                   url: "https://variety.com/v/film/feed/",                                        category: "FILM_TV",    trustTier: 2, region: "INTL", country: "US" },
  { name: "Hollywood Reporter Animation",     url: "https://www.hollywoodreporter.com/c/movies/animation/feed/",              category: "FILM_TV",    trustTier: 2, region: "INTL", country: "US" },
  { name: "BBC Culture",                      url: "https://www.bbc.com/culture/feed.rss",                                    category: "FILM_TV",    trustTier: 1, region: "INTL", country: "UK" },
  // (Cineuropa RSS returned 403 due to User-Agent block; removed
  // until we have a feed they don't block.)

  // TECH international — family-tech / AI press
  { name: "MIT Technology Review",            url: "https://www.technologyreview.com/feed/",                                  category: "TECH",       trustTier: 1, region: "INTL", country: "US" },
  { name: "The Verge",                        url: "https://www.theverge.com/rss/index.xml",                                  category: "TECH",       trustTier: 1, region: "INTL", country: "US" },
  { name: "Ars Technica",                     url: "https://feeds.arstechnica.com/arstechnica/index",                         category: "TECH",       trustTier: 1, region: "INTL", country: "US" },

  // GAMES international
  { name: "Polygon",                          url: "https://www.polygon.com/rss/index.xml",                                   category: "GAMES",      trustTier: 1, region: "INTL", country: "US" },
  { name: "GameSpot Family",                  url: "https://www.gamespot.com/feeds/news/",                                    category: "GAMES",      trustTier: 2, region: "INTL", country: "US" },
  // Eurogamer (UK) — major European gaming source
  { name: "Eurogamer",                        url: "https://www.eurogamer.net/?format=rss",                                   category: "GAMES",      trustTier: 1, region: "INTL", country: "UK" },

  // READING international
  { name: "Publishers Weekly Children's",     url: "https://www.publishersweekly.com/pw/feeds/recent/childrens.xml",          category: "READING",    trustTier: 1, region: "INTL", country: "US" },
  { name: "School Library Journal",           url: "https://www.slj.com/?feed=rss2",                                          category: "READING",    trustTier: 1, region: "INTL", country: "US" },
  // UK children's books
  { name: "Books for Keeps",                  url: "https://booksforkeeps.co.uk/feed/",                                       category: "READING",    trustTier: 1, region: "INTL", country: "UK" },
]
