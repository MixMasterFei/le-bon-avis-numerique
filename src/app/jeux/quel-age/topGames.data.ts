// Curated seed list for the "À partir de quel âge ?" games pillar page
// (/jeux/quel-age). These are the high-search titles French kids ask for by
// name — the "[jeu] quel âge" query class the market study flags as unowned
// whitespace. The page looks each up in the catalogue at request time and only
// renders the ones that exist and are enriched (self-heals as the catalogue
// fills). `aliases` support guide discovery; catalogue rows use exact full
// titles, optionally supplied by `catalogueTitles` for a franchise or edition.
// `parentNote` is an honest one-line reason parents search the title — a
// framing of the question, never a Totem content verdict (those come from the
// fiche's own analysis).
//
// `familyIssues` goes one step further: the concrete, checkable things families
// actually run into with a given title — open voice chat, random-reward
// mechanics, an age rating that sits below the felt intensity, a control that
// exists but is off by default. They are DESCRIPTIONS of the game and its
// settings, still not Totem verdicts, and they are what makes this page worth
// citing rather than a list of names. Keep them specific: "coffres à
// récompenses aléatoires" beats "achats intégrés".
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
  /** Exact full titles, in editorial preference order, for catalogue identity. */
  catalogueTitles?: string[]
  /** Honest one-line reason parents look this title up (not a content claim). */
  parentNote: string
  /** Concrete family-side issues: mechanics, settings, mismatches. */
  familyIssues?: string[]
  /** Override: skip alias lookup and use this exact catalogue id. */
  forcedId?: string
  /** Override: use this exact FAQ answer instead of the generated one. */
  customFaqAnswer?: string
}

export const TOP_GAMES: TopGameSeed[] = [
  {
    key: "fortnite",
    name: "Fortnite",
    aliases: ["fortnite"],
    catalogueTitles: ["fortnite", "fortnite battle royale"],
    parentNote:
      "Battle royale en ligne omniprésent dans les cours de récré : les parents s'interrogent sur le chat vocal, les inconnus et les achats intégrés.",
    familyIssues: [
      "Le chat vocal est ouvert par défaut et met l'enfant en relation avec des joueurs inconnus du monde entier.",
      "Les achats cosmétiques (V-Bucks) sont permanents et fortement renforcés par la pression du groupe de camarades.",
      "Les contrôles parentaux Epic permettent de couper le chat et d'exiger une validation parentale pour chaque achat — ils ne sont pas actifs par défaut.",
      "Les parties s'enchaînent sans fin naturelle, ce qui rend l'arrêt plus conflictuel que sur un jeu à niveaux.",
    ],
  },
  {
    key: "roblox",
    name: "Roblox",
    aliases: ["roblox"],
    parentNote:
      "Plateforme de mini-jeux créés par les joueurs : le contenu varie énormément d'un jeu à l'autre, d'où la question de l'âge.",
    familyIssues: [
      "Ce n'est pas un jeu mais une plateforme : le contenu est créé par les utilisateurs et va du jeu enfantin à des expériences bien plus crues, sans classification homogène.",
      "Chat texte et vocal : des enquêtes ont documenté des adultes entrant en contact avec des enfants, la conversation se déplaçant ensuite hors plateforme (Discord notamment).",
      "Les Robux se dépensent par petits montants répétés, ce qui rend les achats impulsifs difficiles à repérer.",
      "Depuis janvier 2026 une vérification d'âge conditionne l'accès au chat, et un compte parent lié permet de plafonner les dépenses mensuelles — à activer explicitement.",
    ],
  },
  {
    key: "minecraft",
    name: "Minecraft",
    aliases: ["minecraft"],
    catalogueTitles: ["minecraft", "minecraft: java edition", "minecraft: bedrock edition"],
    parentNote:
      "Bac à sable créatif très demandé dès le primaire : les parents veulent situer l'âge et le mode multijoueur.",
    familyIssues: [
      "Le jeu en lui-même est régulièrement cité comme l'un des plus sûrs du marché : pas de progression sous pression, pas de monnaie aléatoire.",
      "Le point de vigilance n'est pas le jeu mais les serveurs publics tiers, qui ne sont pas modérés par Mojang et peuvent héberger chat libre et contenus non filtrés.",
      "Le mode créatif et le jeu en solo ou en réseau local ne posent aucune de ces questions.",
    ],
  },
  {
    key: "gta",
    name: "Grand Theft Auto (GTA)",
    aliases: ["grand theft auto", "gta"],
    catalogueTitles: ["grand theft auto v", "grand theft auto iv", "grand theft auto: san andreas"],
    parentNote:
      "Série d'action pour adultes que les plus jeunes réclament : la question de l'âge revient sans cesse.",
    familyIssues: [
      "Conçu et classé pour un public adulte : la question n'est pas le réglage mais l'adéquation même du titre.",
      "GTA Online place l'enfant dans des salons partagés avec des inconnus, communication vocale et écrite comprise.",
      "La demande vient presque toujours du groupe de camarades plutôt que du jeu lui-même — un point utile à nommer dans la discussion.",
    ],
  },
  {
    key: "among-us",
    name: "Among Us",
    aliases: ["among us"],
    parentNote:
      "Jeu de déduction sociale en ligne : simple en apparence, mais avec chat et parties entre inconnus.",
    familyIssues: [
      "Le graphisme enfantin masque un chat libre avec des inconnus en partie publique.",
      "La mécanique repose sur le mensonge et la trahison : anodin pour un ado, déroutant pour un enfant plus jeune.",
      "En partie privée entre camarades connus, la plupart de ces réserves disparaissent.",
    ],
  },
  {
    key: "brawl-stars",
    name: "Brawl Stars",
    aliases: ["brawl stars"],
    parentNote:
      "Jeu de combat en équipe sur mobile très populaire chez les 8-12 ans, avec achats et jeu en ligne.",
    familyIssues: [
      "Le cœur du modèle économique repose sur des coffres à récompenses aléatoires, dont les mécaniques sont proches de celles des jeux de hasard.",
      "Le jeu est accessible dès 9 ans sur les boutiques d'applications sans mention de ces mécaniques aléatoires.",
      "Des cas documentés font état d'enfants ayant dépensé une centaine d'euros sur la carte bancaire parentale sans en mesurer le total.",
      "Des professionnels de l'addiction ont publiquement alerté sur l'agressivité du modèle auprès des préadolescents.",
      "Désactiver les achats intégrés au niveau du système (iOS/Android) est plus fiable que de compter sur les réglages du jeu.",
    ],
  },
  {
    key: "ea-sports-fc",
    name: "EA Sports FC (ex-FIFA)",
    aliases: ["ea sports fc", "ea sports f.c", "fifa"],
    parentNote:
      "Simulation de football familière, mais dont le mode Ultimate Team soulève des questions sur les dépenses.",
    familyIssues: [
      "Le mode Ultimate Team repose sur des pochettes de joueurs au contenu aléatoire, achetables en argent réel.",
      "Le reste du jeu (matchs, carrière, local à plusieurs) ne comporte aucune de ces mécaniques.",
      "Les dépenses passent par petits montants, souvent invisibles jusqu'au relevé bancaire. Les achats se coupent dans les réglages console et le compte enfant EA — ils ne sont pas actifs par défaut.",
      "FC 26 reste PEGI 3. FC 27 (septembre 2026) sera PEGI 16 : les pochettes payantes au hasard deviennent un critère d'âge sur les nouveaux jeux, pas un recalcul des opus déjà classés 3.",
    ],
    forcedId: "095106fa-bc48-4bd9-9461-adc1ae2a088e",
    customFaqAnswer:
      "EA Sports FC 26 est un jeu vidéo conseillé à partir de 7 ans par Totem Avisé. Points à vérifier : consumérisme. Points favorables : messages positifs, modèles positifs.",
  },
  {
    key: "call-of-duty",
    name: "Call of Duty",
    aliases: ["call of duty"],
    catalogueTitles: ["call of duty: black ops 6", "call of duty: modern warfare iii", "call of duty: warzone"],
    parentNote:
      "Jeu de tir militaire pour adolescents et adultes fréquemment réclamé plus tôt.",
    familyIssues: [
      "Classé pour un public adulte selon les épisodes, avec une violence armée réaliste.",
      "Le chat vocal en ligne expose à des propos crus entre joueurs, indépendamment du contenu du jeu.",
      "Les épisodes se ressemblant de loin, les parents confondent souvent des opus classés différemment.",
    ],
  },
  {
    key: "valorant",
    name: "Valorant",
    aliases: ["valorant"],
    parentNote:
      "Jeu de tir tactique compétitif que les adolescents découvrent souvent tôt.",
    familyIssues: [
      "Jeu compétitif classé pour adolescents, à la violence armée stylisée mais nette.",
      "La communication vocale d'équipe est au cœur du jeu et la communauté compétitive peut être rude.",
      "Le format en parties classées entretient une pression de progression difficile à interrompre.",
    ],
  },
  {
    key: "genshin-impact",
    name: "Genshin Impact",
    aliases: ["genshin impact"],
    parentNote:
      "Aventure en monde ouvert au style manga, avec un système de tirages payants (gacha).",
    familyIssues: [
      "Le système de tirages (gacha) est une mécanique de récompense aléatoire payante, cœur du modèle économique.",
      "Le jeu est gratuit à l'entrée, ce qui rend la dépense d'autant moins visible au départ.",
      "L'aventure elle-même reste accessible sans payer : la question porte sur la mécanique, pas sur le contenu.",
    ],
  },
  {
    key: "fall-guys",
    name: "Fall Guys",
    aliases: ["fall guys"],
    catalogueTitles: ["fall guys", "fall guys: ultimate knockout"],
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
    catalogueTitles: ["mario kart world", "mario kart 8 deluxe", "mario kart 8"],
    parentNote:
      "Jeu de course familial emblématique de Nintendo, un grand classique des questions d'âge.",
  },
  {
    key: "zelda",
    name: "The Legend of Zelda",
    aliases: ["legend of zelda", "zelda"],
    catalogueTitles: ["the legend of zelda: tears of the kingdom", "the legend of zelda: breath of the wild"],
    parentNote:
      "Aventure Nintendo acclamée : les parents veulent savoir à partir de quel âge la proposer.",
  },
  {
    key: "pokemon",
    name: "Pokémon",
    aliases: ["pokémon", "pokemon"],
    catalogueTitles: ["pokémon scarlet", "pokemon scarlet", "pokémon violet", "pokemon violet"],
    parentNote:
      "Licence de créatures à collectionner adorée des enfants, déclinée en de nombreux jeux.",
  },
  {
    key: "animal-crossing",
    name: "Animal Crossing",
    aliases: ["animal crossing"],
    catalogueTitles: ["animal crossing: new horizons", "animal crossing: new leaf", "animal crossing"],
    parentNote:
      "Simulation de vie paisible souvent citée comme idéale pour les jeunes joueurs.",
  },
  {
    key: "splatoon",
    name: "Splatoon",
    aliases: ["splatoon"],
    catalogueTitles: ["splatoon 3", "splatoon 2", "splatoon"],
    parentNote:
      "Jeu de tir coloré à l'encre, pensé pour un public jeune mais joué en ligne.",
  },
  {
    key: "super-smash-bros",
    name: "Super Smash Bros.",
    aliases: ["super smash bros", "smash bros"],
    catalogueTitles: ["super smash bros. ultimate", "super smash bros. for wii u", "super smash bros."],
    parentNote:
      "Jeu de combat festif réunissant les héros Nintendo, très demandé en famille.",
  },
  {
    key: "overwatch",
    name: "Overwatch",
    aliases: ["overwatch"],
    catalogueTitles: ["overwatch 2", "overwatch"],
    parentNote:
      "Jeu de tir en équipe stylisé : coloré, mais en ligne et compétitif.",
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
    catalogueTitles: ["the sims 4", "les sims 4", "the sims 3", "les sims 3"],
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
    catalogueTitles: ["sonic superstars", "sonic frontiers", "sonic mania"],
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
  {
    key: "five-nights-at-freddys",
    name: "Five Nights at Freddy's",
    aliases: ["five nights at freddy", "fnaf"],
    catalogueTitles: ["five nights at freddy's", "five nights at freddy’s"],
    parentNote:
      "Jeu d'horreur devenu une licence enfantine (peluches, films, vidéos) : l'écart entre l'univers et le jeu lui-même surprend beaucoup de parents.",
    familyIssues: [
      "Le jeu original est un jeu d'horreur bâti sur les sursauts (jump scares), pas un jeu d'aventure.",
      "L'univers circule massivement chez les 8-12 ans via YouTube, les peluches et les films, bien en dessous de l'âge du jeu.",
      "Les animatroniques et l'ambiance sonore sont conçues pour la tension continue, pas pour l'action.",
    ],
  },
  {
    key: "poppy-playtime",
    name: "Poppy Playtime",
    aliases: ["poppy playtime"],
    parentNote:
      "Horreur à l'esthétique de jouets, très relayée par les vidéos : les parents découvrent souvent le contenu après l'enfant.",
    familyIssues: [
      "L'esthétique de peluches attire des enfants nettement plus jeunes que le contenu réel du jeu.",
      "Le classement affiché sur certaines plateformes descend jusqu'à 8 ans, en décalage avec l'intensité ressentie.",
      "Les personnages (Huggy Wuggy et suivants) sont conçus pour la poursuite et la surprise.",
      "Signes à surveiller après exposition : cauchemars, sommeil perturbé, anxiété, ou rejeu répété des scènes.",
    ],
  },
  {
    key: "clash-royale",
    name: "Clash Royale",
    aliases: ["clash royale"],
    parentNote:
      "Jeu de cartes en duel du même éditeur que Brawl Stars, avec la même logique de coffres.",
    familyIssues: [
      "Progression rythmée par des coffres à contenu aléatoire, mécanique proche des jeux de hasard.",
      "Accessible dès 9 ans sur les boutiques sans mention de ces mécaniques.",
      "Le format en duels très courts favorise les sessions qui s'étirent sans point d'arrêt net.",
    ],
  },
  {
    key: "clash-of-clans",
    name: "Clash of Clans",
    aliases: ["clash of clans"],
    parentNote:
      "Jeu de stratégie mobile à progression longue, souvent joué en clan avec des inconnus.",
    familyIssues: [
      "La progression est volontairement lente, avec des accélérations payantes.",
      "Le chat de clan met l'enfant en contact avec des joueurs adultes inconnus.",
      "Les temps de construction encouragent des retours au jeu très fréquents sur la journée.",
    ],
  },
  {
    key: "league-of-legends",
    name: "League of Legends",
    aliases: ["league of legends"],
    parentNote:
      "Grand jeu compétitif en équipe que les adolescents rejoignent souvent tôt.",
    familyIssues: [
      "Jeu d'équipe classé pour adolescents, à la violence fantastique stylisée.",
      "La communauté compétitive est réputée dure : les échanges en partie sont un sujet en soi.",
      "Une partie ne peut pas être quittée sans pénaliser l'équipe, ce qui rend l'arrêt difficile à négocier.",
    ],
  },
  {
    key: "apex-legends",
    name: "Apex Legends",
    aliases: ["apex legends"],
    parentNote:
      "Battle royale à héros, alternative fréquente à Fortnite chez les adolescents.",
    familyIssues: [
      "Violence armée dans un univers de science-fiction, classé pour adolescents.",
      "Le chat vocal d'équipe est central dans le jeu en escouade.",
      "Boutique rotative et passes saisonniers entretiennent une pression d'achat régulière.",
    ],
  },
  {
    key: "rainbow-six-siege",
    name: "Rainbow Six Siege",
    aliases: ["rainbow six"],
    catalogueTitles: ["tom clancy's rainbow six siege", "tom clancy’s rainbow six siege", "rainbow six siege"],
    parentNote:
      "Jeu de tir tactique réaliste réclamé au collège, classé pour adultes.",
    familyIssues: [
      "Violence armée réaliste en environnement contemporain, classée pour un public adulte.",
      "Le jeu repose sur la communication vocale entre joueurs, souvent inconnus.",
      "Le format compétitif classé entretient une progression sous pression.",
    ],
  },
  {
    key: "subway-surfers",
    name: "Subway Surfers",
    aliases: ["subway surfers"],
    parentNote:
      "Jeu de course mobile installé très tôt, y compris en maternelle.",
    familyIssues: [
      "Contenu très simple et sans violence : la question porte surtout sur l'usage.",
      "Publicités fréquentes et achats intégrés dans un jeu utilisé par de très jeunes enfants.",
      "Le format sans fin est conçu pour la relance immédiate, sans point d'arrêt naturel.",
    ],
  },
  {
    key: "toca-boca",
    name: "Toca Boca (Toca Life World)",
    aliases: ["toca boca", "toca life"],
    catalogueTitles: ["toca boca world", "toca life world", "toca life: world"],
    parentNote:
      "Univers de jeu libre pour jeunes enfants, souvent la première application de jeu installée.",
    familyIssues: [
      "Pas de score, pas de perte, pas de chat : le format est pensé pour le jeu libre des plus jeunes.",
      "Le catalogue s'étend par achats de packs, principale question côté budget.",
      "Peu de risques d'interaction, ce qui en fait un repère utile pour situer les autres titres.",
    ],
  },
  {
    key: "just-dance",
    name: "Just Dance",
    aliases: ["just dance"],
    catalogueTitles: ["just dance 2026 edition", "just dance 2025 edition", "just dance 2024 edition", "just dance"],
    parentNote:
      "Jeu de danse familial, l'un des rares titres joués physiquement à plusieurs.",
    familyIssues: [
      "Jeu d'activité physique en salon, sans violence ni interaction en ligne obligatoire.",
      "Le catalogue de morceaux s'étend par abonnement.",
      "Certaines chorégraphies et paroles suivent les tubes du moment, à regarder si l'enfant est jeune.",
    ],
  },
  {
    key: "mario-party",
    name: "Mario Party",
    aliases: ["mario party"],
    catalogueTitles: ["super mario party jamboree", "mario party superstars", "super mario party"],
    parentNote:
      "Jeu de plateau festif Nintendo, classique des soirées en famille.",
    familyIssues: [
      "Format en tour par tour, adapté au jeu intergénérationnel.",
      "La part de hasard peut générer de la frustration chez les plus jeunes compétiteurs.",
      "Pas de chat ni de contenu en ligne dans le mode local.",
    ],
  },
  {
    key: "super-mario",
    name: "Super Mario",
    aliases: ["super mario"],
    catalogueTitles: ["super mario bros. wonder", "super mario odyssey", "super mario 3d world + bowser's fury"],
    parentNote:
      "La série de plateforme la plus universelle, référence pour situer les autres jeux.",
    familyIssues: [
      "Aucune violence réaliste : les affrontements sont symboliques et sans conséquence.",
      "Difficulté progressive, souvent le premier jeu autonome d'un enfant.",
      "Aucune interaction en ligne dans les modes principaux.",
    ],
  },
  {
    key: "hogwarts-legacy",
    name: "Hogwarts Legacy",
    aliases: ["hogwarts legacy"],
    parentNote:
      "Monde ouvert Harry Potter très demandé par les lecteurs de la saga, souvent plus jeunes que le jeu.",
    familyIssues: [
      "Duels magiques et créatures pouvant impressionner, dans un univers connu des enfants par les livres et les films.",
      "L'attachement à la licence amène la demande bien avant l'âge du jeu.",
      "Aventure solo : pas de chat ni de joueurs inconnus.",
    ],
  },
  {
    key: "assassins-creed",
    name: "Assassin's Creed",
    aliases: ["assassin's creed", "assassins creed"],
    catalogueTitles: ["assassin's creed shadows", "assassin's creed mirage", "assassin's creed valhalla", "assassin's creed"],
    parentNote:
      "Série d'action historique dont les épisodes ne partagent pas tous la même classification.",
    familyIssues: [
      "Violence armée à l'arme blanche, avec des épisodes classés différemment selon les opus.",
      "L'habillage historique et l'aspect éducatif de certains modes brouillent la lecture de l'âge.",
      "Aventure essentiellement solo, sans exposition aux inconnus.",
    ],
  },
  {
    key: "red-dead-redemption",
    name: "Red Dead Redemption",
    aliases: ["red dead redemption"],
    catalogueTitles: ["red dead redemption 2", "red dead redemption"],
    parentNote:
      "Western en monde ouvert du même éditeur que GTA, classé pour adultes.",
    familyIssues: [
      "Violence réaliste et thèmes adultes, classé pour un public adulte.",
      "Le rythme contemplatif du jeu masque parfois la dureté de certaines scènes.",
      "Le mode en ligne expose aux mêmes questions d'inconnus que GTA Online.",
    ],
  },
  {
    key: "the-last-of-us",
    name: "The Last of Us",
    aliases: ["the last of us"],
    catalogueTitles: ["the last of us part i", "the last of us remastered", "the last of us"],
    parentNote:
      "Récit post-apocalyptique très commenté depuis la série, réclamé par des adolescents.",
    familyIssues: [
      "Violence réaliste et intense, classée pour un public adulte.",
      "La notoriété de la série télévisée fait descendre la demande vers des âges plus jeunes.",
      "Le poids émotionnel du récit compte autant que la violence dans l'évaluation.",
    ],
  },
  {
    key: "plants-vs-zombies",
    name: "Plants vs. Zombies",
    aliases: ["plants vs zombies", "plants vs. zombies"],
    parentNote:
      "Défense de jardin humoristique, souvent première rencontre avec le mot « zombie ».",
    familyIssues: [
      "Zombies traités sur un ton comique et cartoonesque, sans sang ni réalisme.",
      "Stratégie accessible, jouable par paliers courts.",
      "Les épisodes mobiles comportent davantage de publicités et d'achats que les versions PC ou console.",
    ],
  },
  {
    key: "terraria",
    name: "Terraria",
    aliases: ["terraria"],
    parentNote:
      "Bac à sable d'exploration en 2D souvent proposé comme alternative à Minecraft.",
    familyIssues: [
      "Exploration et construction avec une part de combat plus présente que dans Minecraft.",
      "Les créatures et boss peuvent surprendre les plus jeunes.",
      "Le multijoueur se joue surtout entre camarades connus, sur serveur privé.",
    ],
  },
  {
    key: "lego",
    name: "Jeux LEGO",
    aliases: ["lego"],
    catalogueTitles: ["lego star wars: the skywalker saga", "lego harry potter collection", "lego marvel super heroes"],
    parentNote:
      "Adaptations LEGO des grandes licences, valeur sûre du jeu à deux parent-enfant.",
    familyIssues: [
      "Humour et absence de conséquence : les personnages se reconstruisent après chaque chute.",
      "Coopération à deux sur le même écran, sans configuration en ligne.",
      "L'univers d'origine (Star Wars, Marvel…) reste plus dur que son adaptation LEGO.",
    ],
  },
  {
    key: "crash-bandicoot",
    name: "Crash Bandicoot",
    aliases: ["crash bandicoot"],
    catalogueTitles: ["crash bandicoot n. sane trilogy", "crash bandicoot 4: it's about time", "crash bandicoot"],
    parentNote:
      "Plateforme d'action rétro revenue en remaster, souvent découverte par les parents eux-mêmes.",
    familyIssues: [
      "Aucun contenu sensible : la difficulté est le seul vrai obstacle.",
      "Exigence de précision qui peut frustrer un jeune enfant.",
      "Jeu solo, sans interaction en ligne.",
    ],
  },
]
