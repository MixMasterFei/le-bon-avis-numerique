// Curated seed list for the "À partir de quel âge ?" games pillar page
// (/jeux/quel-age). These are the high-search titles French kids ask for by
// name — the "[jeu] quel âge" query class the market study flags as unowned
// whitespace. The page looks each up in the catalogue at request time and only
// renders the ones that exist and are enriched (self-heals as the catalogue
// fills). `aliases` are lowercased title fragments matched against DB titles;
// `parentNote` is an honest one-line reason parents search the title — a
// framing of the question, never a Totem content verdict (those come from the
// fiche's own analysis).
//
// Keep this file free of React/Prisma imports so it can be reused by route
// handlers and tests.

export interface TopGameSeed {
  /** URL-safe key; also the row anchor id. */
  key: string
  /** Display name used in copy and structured data. */
  name: string
  /** Lowercased title fragments matched against catalogue titles (contains). */
  aliases: string[]
  /** Honest one-line reason parents look this title up (not a content claim). */
  parentNote: string
}

export const TOP_GAMES: TopGameSeed[] = [
  {
    key: "fortnite",
    name: "Fortnite",
    aliases: ["fortnite"],
    parentNote:
      "Battle royale en ligne omniprésent dans les cours de récré : les parents s'interrogent sur le chat vocal, les inconnus et les achats intégrés.",
  },
  {
    key: "roblox",
    name: "Roblox",
    aliases: ["roblox"],
    parentNote:
      "Plateforme de mini-jeux créés par les joueurs : le contenu varie énormément d'un jeu à l'autre, d'où la question de l'âge.",
  },
  {
    key: "minecraft",
    name: "Minecraft",
    aliases: ["minecraft"],
    parentNote:
      "Bac à sable créatif très demandé dès le primaire : les parents veulent situer l'âge et le mode multijoueur.",
  },
  {
    key: "gta",
    name: "Grand Theft Auto (GTA)",
    aliases: ["grand theft auto", "gta"],
    parentNote:
      "Série d'action pour adultes que les plus jeunes réclament : la question de l'âge revient sans cesse.",
  },
  {
    key: "among-us",
    name: "Among Us",
    aliases: ["among us"],
    parentNote:
      "Jeu de déduction sociale en ligne : simple en apparence, mais avec chat et parties entre inconnus.",
  },
  {
    key: "brawl-stars",
    name: "Brawl Stars",
    aliases: ["brawl stars"],
    parentNote:
      "Jeu de combat en équipe sur mobile très populaire chez les 8-12 ans, avec achats et jeu en ligne.",
  },
  {
    key: "ea-sports-fc",
    name: "EA Sports FC (ex-FIFA)",
    aliases: ["ea sports fc", "ea sports f.c", "fifa"],
    parentNote:
      "Simulation de football familière, mais dont le mode Ultimate Team soulève des questions sur les dépenses.",
  },
  {
    key: "call-of-duty",
    name: "Call of Duty",
    aliases: ["call of duty"],
    parentNote:
      "Jeu de tir militaire pour adolescents et adultes fréquemment réclamé plus tôt.",
  },
  {
    key: "fall-guys",
    name: "Fall Guys",
    aliases: ["fall guys"],
    parentNote:
      "Party game coloré de type course à obstacles, souvent perçu comme adapté aux enfants.",
  },
  {
    key: "rocket-league",
    name: "Rocket League",
    aliases: ["rocket league"],
    parentNote:
      "Football avec des voitures, très accessible ; les parents s'interrogent surtout sur le jeu en ligne.",
  },
  {
    key: "mario-kart",
    name: "Mario Kart",
    aliases: ["mario kart"],
    parentNote:
      "Jeu de course familial emblématique de Nintendo, un grand classique des questions d'âge.",
  },
  {
    key: "zelda",
    name: "The Legend of Zelda",
    aliases: ["legend of zelda", "zelda"],
    parentNote:
      "Aventure Nintendo acclamée : les parents veulent savoir à partir de quel âge la proposer.",
  },
  {
    key: "pokemon",
    name: "Pokémon",
    aliases: ["pokémon", "pokemon"],
    parentNote:
      "Licence de créatures à collectionner adorée des enfants, déclinée en de nombreux jeux.",
  },
  {
    key: "animal-crossing",
    name: "Animal Crossing",
    aliases: ["animal crossing"],
    parentNote:
      "Simulation de vie paisible souvent citée comme idéale pour les jeunes joueurs.",
  },
  {
    key: "splatoon",
    name: "Splatoon",
    aliases: ["splatoon"],
    parentNote:
      "Jeu de tir coloré à l'encre, pensé pour un public jeune mais joué en ligne.",
  },
  {
    key: "super-smash-bros",
    name: "Super Smash Bros.",
    aliases: ["super smash bros", "smash bros"],
    parentNote:
      "Jeu de combat festif réunissant les héros Nintendo, très demandé en famille.",
  },
  {
    key: "overwatch",
    name: "Overwatch",
    aliases: ["overwatch"],
    parentNote:
      "Jeu de tir en équipe stylisé : coloré, mais en ligne et compétitif.",
  },
  {
    key: "valorant",
    name: "Valorant",
    aliases: ["valorant"],
    parentNote:
      "Jeu de tir tactique compétitif que les adolescents découvrent souvent tôt.",
  },
  {
    key: "genshin-impact",
    name: "Genshin Impact",
    aliases: ["genshin impact"],
    parentNote:
      "Aventure en monde ouvert au style manga, avec un système de tirages payants (gacha).",
  },
  {
    key: "stardew-valley",
    name: "Stardew Valley",
    aliases: ["stardew valley"],
    parentNote:
      "Jeu de ferme relaxant fréquemment recommandé pour un public jeune.",
  },
  {
    key: "les-sims",
    name: "Les Sims",
    aliases: ["les sims", "the sims"],
    parentNote:
      "Simulation de vie ouverte : les parents s'interrogent sur les thèmes adultes et les extensions.",
  },
  {
    key: "it-takes-two",
    name: "It Takes Two",
    aliases: ["it takes two"],
    parentNote:
      "Aventure coopérative à deux souvent jouée parent-enfant.",
  },
  {
    key: "sonic",
    name: "Sonic",
    aliases: ["sonic"],
    parentNote:
      "Le hérisson rapide de SEGA, une valeur sûre des jeux de plateforme pour enfants.",
  },
  {
    key: "gang-beasts",
    name: "Gang Beasts",
    aliases: ["gang beasts"],
    parentNote:
      "Jeu de bagarre burlesque à plusieurs, à la violence cartoonesque.",
  },
]
