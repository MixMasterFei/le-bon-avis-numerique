// Curated "must-have" catalogue for a French-speaking family guide.
//
// WHY THIS FILE EXISTS
// Every acquisition path we have is driven by TMDB/IGDB *popularity*
// (`weekly-import`, `batch-import` presets, `now_playing`). Popularity endpoints
// surface what is trending NOW, so they structurally cannot deliver heritage
// cinema: Le Gendarme de Saint-Tropez will never trend again. The result is a
// catalogue that is strong on 2020s releases and full of holes exactly where
// grandparents look — which is what a family guide gets demoed on.
//
// So the reference list has to be editorial, not algorithmic. This file IS that
// list: the titles a French (and Québécois) family would be surprised NOT to
// find, plus the seasonal titles people search for every December and October.
//
// HOW IT IS USED
// `heritage-gap.ts` diffs this list against the catalogue and reports what is
// missing. Matching is on normalised title + release year (see `matchesEntry`),
// never on a raw ILIKE — during the first manual audit, naive patterns produced
// four false "missing" verdicts in a row (S.O.S. Fantômes, Monstres & Cie,
// L'Étrange Pouvoir de Norman, Miracle sur la 34ème rue) because the catalogue
// title differs from the canonical one by punctuation or by a localised name.
// That is precisely the failure mode `aliases` exists to absorb.
//
// MAINTENANCE
// Add entries freely — the list is meant to grow. Keep `year` as the ORIGINAL
// theatrical release year (TMDB's primary release), and add an alias whenever a
// title is known under more than one French name.

export type HeritageCategory =
  | "fr-patrimoine"
  | "fr-culte"
  | "fr-animation"
  | "quebec"
  | "noel"
  | "halloween"
  | "classique-intl"

export interface HeritageEntry {
  title: string
  year: number
  type: "MOVIE"
  category: HeritageCategory
  /** Alternative French titles / spellings seen in TMDB. */
  aliases?: string[]
  /** Why it matters — surfaced in the gap report to help triage. */
  note?: string
}

export const HERITAGE_CATEGORY_LABELS: Record<HeritageCategory, string> = {
  "fr-patrimoine": "Patrimoine français (de Funès, Bourvil, Tati…)",
  "fr-culte": "Comédies et classiques français cultes",
  "fr-animation": "Animation et jeunesse françaises",
  quebec: "Classiques québécois",
  noel: "Noël",
  halloween: "Halloween / frissons famille",
  "classique-intl": "Classiques familiaux internationaux",
}

export const HERITAGE_WATCHLIST: HeritageEntry[] = [
  // ─────────────────────────────────────────────────────────────────────
  // Patrimoine français — le trou le plus visible du catalogue
  // ─────────────────────────────────────────────────────────────────────
  { title: "Le Gendarme de Saint-Tropez", year: 1964, type: "MOVIE", category: "fr-patrimoine", note: "Tête de série — 6 films, 2 présents" },
  { title: "Le Gendarme à New York", year: 1965, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Le Gendarme se marie", year: 1968, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Le Gendarme en balade", year: 1970, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Le Gendarme et les Extra-terrestres", year: 1979, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Le Gendarme et les Gendarmettes", year: 1982, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Les Aventures de Rabbi Jacob", year: 1973, type: "MOVIE", category: "fr-patrimoine", aliases: ["Rabbi Jacob"], note: "Incontournable absolu — et fiche à contextualiser (humour ethnique daté)" },
  { title: "La Grande Vadrouille", year: 1966, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Le Corniaud", year: 1965, type: "MOVIE", category: "fr-patrimoine" },
  { title: "La Folie des grandeurs", year: 1971, type: "MOVIE", category: "fr-patrimoine" },
  { title: "L'Aile ou la Cuisse", year: 1976, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Le Grand Restaurant", year: 1966, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Oscar", year: 1967, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Hibernatus", year: 1969, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Le Tatoué", year: 1968, type: "MOVIE", category: "fr-patrimoine" },
  { title: "La Zizanie", year: 1978, type: "MOVIE", category: "fr-patrimoine" },
  { title: "L'Avare", year: 1980, type: "MOVIE", category: "fr-patrimoine" },
  { title: "La Soupe aux choux", year: 1981, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Les Grandes Vacances", year: 1967, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Le Petit Baigneur", year: 1968, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Pouic-Pouic", year: 1963, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Le Cerveau", year: 1969, type: "MOVIE", category: "fr-patrimoine" },
  { title: "La Vache et le Prisonnier", year: 1959, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Fantômas", year: 1964, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Fantômas se déchaîne", year: 1965, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Fantômas contre Scotland Yard", year: 1967, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Jour de fête", year: 1949, type: "MOVIE", category: "fr-patrimoine", note: "Tati" },
  { title: "Les Vacances de Monsieur Hulot", year: 1953, type: "MOVIE", category: "fr-patrimoine", note: "Tati" },
  { title: "Mon Oncle", year: 1958, type: "MOVIE", category: "fr-patrimoine", note: "Tati" },
  { title: "Le Ballon rouge", year: 1956, type: "MOVIE", category: "fr-patrimoine", note: "Court-métrage culte, très utilisé en classe" },
  { title: "La Guerre des boutons", year: 1962, type: "MOVIE", category: "fr-patrimoine", note: "Original — seul le remake 1994 est en base" },
  { title: "Mais où est donc passée la septième compagnie ?", year: 1973, type: "MOVIE", category: "fr-patrimoine", aliases: ["Mais où est donc passée la 7ème compagnie ?"] },
  { title: "Papy fait de la résistance", year: 1983, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Le Grand Blond avec une chaussure noire", year: 1972, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Le Magnifique", year: 1973, type: "MOVIE", category: "fr-patrimoine" },
  { title: "Le Jouet", year: 1976, type: "MOVIE", category: "fr-patrimoine" },

  // ─────────────────────────────────────────────────────────────────────
  // Comédies / classiques français cultes
  // ─────────────────────────────────────────────────────────────────────
  { title: "Les Bronzés", year: 1978, type: "MOVIE", category: "fr-culte" },
  { title: "Les Bronzés font du ski", year: 1979, type: "MOVIE", category: "fr-culte" },
  { title: "La Chèvre", year: 1981, type: "MOVIE", category: "fr-culte" },
  { title: "Les Compères", year: 1983, type: "MOVIE", category: "fr-culte" },
  { title: "Les Fugitifs", year: 1986, type: "MOVIE", category: "fr-culte" },
  { title: "La Boum", year: 1980, type: "MOVIE", category: "fr-culte" },
  { title: "Trois hommes et un couffin", year: 1985, type: "MOVIE", category: "fr-culte" },
  { title: "Jean de Florette", year: 1986, type: "MOVIE", category: "fr-culte", note: "Pagnol — patrimoine scolaire" },
  { title: "Manon des sources", year: 1986, type: "MOVIE", category: "fr-culte" },
  { title: "La Gloire de mon père", year: 1990, type: "MOVIE", category: "fr-culte" },
  { title: "Le Château de ma mère", year: 1990, type: "MOVIE", category: "fr-culte" },
  { title: "Les Visiteurs", year: 1993, type: "MOVIE", category: "fr-culte", note: "Original 1993 absent, seuls les dérivés sont en base" },
  { title: "Les Trois Frères", year: 1995, type: "MOVIE", category: "fr-culte", note: "Original absent, seul Le Retour (2014) est en base" },
  { title: "La Cité de la peur", year: 1994, type: "MOVIE", category: "fr-culte" },
  { title: "Un Indien dans la ville", year: 1994, type: "MOVIE", category: "fr-culte" },
  { title: "Le Dîner de cons", year: 1998, type: "MOVIE", category: "fr-culte" },
  { title: "Astérix et Obélix contre César", year: 1999, type: "MOVIE", category: "fr-culte" },
  { title: "Astérix & Obélix : Mission Cléopâtre", year: 2002, type: "MOVIE", category: "fr-culte" },
  { title: "Les Choristes", year: 2004, type: "MOVIE", category: "fr-culte" },
  { title: "Bienvenue chez les Ch'tis", year: 2008, type: "MOVIE", category: "fr-culte" },
  { title: "Le Petit Nicolas", year: 2009, type: "MOVIE", category: "fr-culte" },
  { title: "Belle et Sébastien", year: 2013, type: "MOVIE", category: "fr-culte" },

  // ─────────────────────────────────────────────────────────────────────
  // Animation / jeunesse françaises
  // ─────────────────────────────────────────────────────────────────────
  { title: "Le Roi et l'Oiseau", year: 1980, type: "MOVIE", category: "fr-animation" },
  { title: "Kirikou et la Sorcière", year: 1998, type: "MOVIE", category: "fr-animation" },
  { title: "Princes et Princesses", year: 2000, type: "MOVIE", category: "fr-animation" },
  { title: "Les Triplettes de Belleville", year: 2003, type: "MOVIE", category: "fr-animation" },
  { title: "Azur et Asmar", year: 2006, type: "MOVIE", category: "fr-animation" },
  { title: "Ernest et Célestine", year: 2012, type: "MOVIE", category: "fr-animation" },
  { title: "Le Chant de la mer", year: 2014, type: "MOVIE", category: "fr-animation" },
  { title: "Le Petit Prince", year: 2015, type: "MOVIE", category: "fr-animation" },
  { title: "Ma vie de Courgette", year: 2016, type: "MOVIE", category: "fr-animation" },
  { title: "Le Grand Méchant Renard et autres contes", year: 2017, type: "MOVIE", category: "fr-animation" },
  { title: "Dilili à Paris", year: 2018, type: "MOVIE", category: "fr-animation" },
  { title: "Calamity, une enfance de Martha Jane Cannary", year: 2020, type: "MOVIE", category: "fr-animation" },

  // ─────────────────────────────────────────────────────────────────────
  // Québec — le public canadien francophone, angle mort total aujourd'hui
  // ─────────────────────────────────────────────────────────────────────
  { title: "La Guerre des tuques", year: 1984, type: "MOVIE", category: "quebec", note: "LE classique de Noël québécois" },
  { title: "Bach et Bottine", year: 1986, type: "MOVIE", category: "quebec", note: "Contes pour tous" },
  { title: "La Grenouille et la Baleine", year: 1988, type: "MOVIE", category: "quebec", note: "Contes pour tous" },
  { title: "Le Chandail", year: 1980, type: "MOVIE", category: "quebec", note: "ONF — Roch Carrier" },
  { title: "La Guerre des tuques 3D", year: 2015, type: "MOVIE", category: "quebec" },
  { title: "La Course des tuques", year: 2018, type: "MOVIE", category: "quebec" },
  { title: "Félix et le trésor de Morgäa", year: 2021, type: "MOVIE", category: "quebec" },

  // ─────────────────────────────────────────────────────────────────────
  // Noël
  // ─────────────────────────────────────────────────────────────────────
  { title: "La vie est belle", year: 1946, type: "MOVIE", category: "noel", aliases: ["It's a Wonderful Life"] },
  { title: "Miracle sur la 34e rue", year: 1947, type: "MOVIE", category: "noel", aliases: ["Miracle sur la 34ème rue"] },
  { title: "Comment le Grinch a volé Noël !", year: 1966, type: "MOVIE", category: "noel" },
  { title: "Le Noël de Mickey", year: 1983, type: "MOVIE", category: "noel" },
  { title: "Gremlins", year: 1984, type: "MOVIE", category: "noel" },
  { title: "Maman, j'ai raté l'avion !", year: 1990, type: "MOVIE", category: "noel" },
  { title: "Maman, j'ai encore raté l'avion !", year: 1992, type: "MOVIE", category: "noel" },
  { title: "L'Étrange Noël de monsieur Jack", year: 1993, type: "MOVIE", category: "noel" },
  { title: "Super Noël", year: 1994, type: "MOVIE", category: "noel", aliases: ["The Santa Clause"] },
  { title: "La Course au jouet", year: 1996, type: "MOVIE", category: "noel", aliases: ["Jingle All the Way"] },
  { title: "Le Grinch", year: 2000, type: "MOVIE", category: "noel" },
  { title: "Elfe", year: 2003, type: "MOVIE", category: "noel" },
  { title: "Love Actually", year: 2003, type: "MOVIE", category: "noel" },
  { title: "Le Pôle express", year: 2004, type: "MOVIE", category: "noel" },
  { title: "Joyeux Noël", year: 2005, type: "MOVIE", category: "noel", note: "1914, fraternisation — fort en usage scolaire" },
  { title: "Le Drôle de Noël de Scrooge", year: 2009, type: "MOVIE", category: "noel" },
  { title: "Arthur Noël", year: 2011, type: "MOVIE", category: "noel", aliases: ["Arthur Christmas", "Mission Noël : Les aventures de la famille Noël"] },
  { title: "Les Cinq Légendes", year: 2012, type: "MOVIE", category: "noel" },
  { title: "Klaus", year: 2019, type: "MOVIE", category: "noel" },

  // ─────────────────────────────────────────────────────────────────────
  // Halloween / frissons famille
  // ─────────────────────────────────────────────────────────────────────
  { title: "S.O.S. Fantômes", year: 1984, type: "MOVIE", category: "halloween", aliases: ["SOS Fantômes", "Ghostbusters"] },
  { title: "Beetlejuice", year: 1988, type: "MOVIE", category: "halloween" },
  { title: "Edward aux mains d'argent", year: 1990, type: "MOVIE", category: "halloween" },
  { title: "Les Sorcières", year: 1990, type: "MOVIE", category: "halloween" },
  { title: "La Famille Addams", year: 1991, type: "MOVIE", category: "halloween" },
  { title: "Hocus Pocus : Les Trois Sorcières", year: 1993, type: "MOVIE", category: "halloween", aliases: ["Hocus Pocus"] },
  { title: "Casper", year: 1995, type: "MOVIE", category: "halloween" },
  { title: "Monstres & Cie", year: 2001, type: "MOVIE", category: "halloween", aliases: ["Monstres et Cie"] },
  { title: "Scooby-Doo", year: 2002, type: "MOVIE", category: "halloween" },
  { title: "Les Noces funèbres", year: 2005, type: "MOVIE", category: "halloween" },
  { title: "Wallace & Gromit : Le Mystère du lapin-garou", year: 2005, type: "MOVIE", category: "halloween" },
  { title: "Monster House", year: 2006, type: "MOVIE", category: "halloween" },
  { title: "Coraline", year: 2009, type: "MOVIE", category: "halloween" },
  { title: "Frankenweenie", year: 2012, type: "MOVIE", category: "halloween" },
  { title: "L'Étrange Pouvoir de Norman", year: 2012, type: "MOVIE", category: "halloween", aliases: ["ParaNorman"] },
  { title: "Hôtel Transylvanie", year: 2012, type: "MOVIE", category: "halloween" },
  { title: "Chair de poule", year: 2015, type: "MOVIE", category: "halloween", aliases: ["Goosebumps"] },
  { title: "Coco", year: 2017, type: "MOVIE", category: "halloween" },

  // ─────────────────────────────────────────────────────────────────────
  // Classiques familiaux internationaux
  // ─────────────────────────────────────────────────────────────────────
  { title: "Le Magicien d'Oz", year: 1939, type: "MOVIE", category: "classique-intl" },
  { title: "Mary Poppins", year: 1964, type: "MOVIE", category: "classique-intl" },
  { title: "Charlie et la Chocolaterie", year: 1971, type: "MOVIE", category: "classique-intl", aliases: ["Willy Wonka et la Chocolaterie"] },
  { title: "E.T. l'extra-terrestre", year: 1982, type: "MOVIE", category: "classique-intl" },
  { title: "L'Histoire sans fin", year: 1984, type: "MOVIE", category: "classique-intl" },
  { title: "Karaté Kid", year: 1984, type: "MOVIE", category: "classique-intl" },
  { title: "Les Goonies", year: 1985, type: "MOVIE", category: "classique-intl" },
  { title: "Retour vers le futur", year: 1985, type: "MOVIE", category: "classique-intl" },
  { title: "Labyrinthe", year: 1986, type: "MOVIE", category: "classique-intl" },
  { title: "Fievel et le nouveau monde", year: 1986, type: "MOVIE", category: "classique-intl" },
  { title: "Princess Bride", year: 1987, type: "MOVIE", category: "classique-intl" },
  { title: "Mon voisin Totoro", year: 1988, type: "MOVIE", category: "classique-intl" },
  { title: "Le Petit dinosaure et la vallée des merveilles", year: 1988, type: "MOVIE", category: "classique-intl" },
  { title: "Chérie, j'ai rétréci les gosses", year: 1989, type: "MOVIE", category: "classique-intl" },
  { title: "Beethoven", year: 1992, type: "MOVIE", category: "classique-intl" },
  { title: "Sauvez Willy", year: 1993, type: "MOVIE", category: "classique-intl" },
  { title: "Babe, le cochon devenu berger", year: 1995, type: "MOVIE", category: "classique-intl" },
  { title: "Jumanji", year: 1995, type: "MOVIE", category: "classique-intl" },
  { title: "Matilda", year: 1996, type: "MOVIE", category: "classique-intl" },
  { title: "Le Géant de fer", year: 1999, type: "MOVIE", category: "classique-intl" },
  { title: "Le Voyage de Chihiro", year: 2001, type: "MOVIE", category: "classique-intl" },
]
