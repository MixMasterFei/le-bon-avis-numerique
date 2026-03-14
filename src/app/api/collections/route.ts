import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Thematic collections API — SEO-optimized "Top X" curated lists
// Collections use hand-picked item IDs for quality control.
// Dynamic fallback is used only for seasonal/time-based collections.

interface Collection {
  id: string
  title: string
  description: string
  intro: string
  emoji: string
  limit: number
  category: "top" | "seasonal"
  lastUpdated: string // "YYYY-MM" format
  // Hand-picked item IDs in display order (preferred)
  curatedIds?: string[]
  // Dynamic query fallback (only when curatedIds is absent)
  query?: {
    type?: "MOVIE" | "TV" | "GAME"
    topics?: string[]
    genres?: string[]
    maxAge?: number
    year?: number
    excludeGenres?: string[]
    requireLanguage?: string[]
  }
}

const COLLECTIONS: Collection[] = [
  // ── Top curated lists (permanent, high SEO value) ──────────────────
  {
    id: "top-films-animation-enfants",
    title: "Top 15 des films d'animation pour enfants",
    description: "Les meilleurs dessins animés pour les enfants, des classiques aux pépites récentes.",
    intro: "Certains films d'animation ont ce pouvoir de traverser les époques. Des classiques japonais aux pépites récentes, on a réuni nos 15 préférés pour les enfants, ceux qu'on regarde un mercredi pluvieux ou un dimanche matin sous la couette. Des histoires douces, drôles, parfois émouvantes, mais toujours adaptées aux plus jeunes.",
    emoji: "🎬",
    limit: 15,
    category: "top",
    lastUpdated: "2026-03",
    curatedIds: [
      "19cb35d9-e841-4048-ac9f-79ddffbfbf9f", // Le Robot sauvage (6 ans)
      "1745085c-82a7-4b1b-974d-cb914f83be8a", // Vice-versa 2 (8 ans)
      "b7c955de-9b73-4047-8d57-4629fdc42421", // Ratatouille (6 ans)
      "ac94cb19-24fb-4901-81a0-d426245b27a6", // Encanto (7 ans)
      "145c4ed8-6aa8-4507-aa9d-0e6e11a79d61", // Le Monde de Nemo (6 ans)
      "a4c78a98-7f7b-49cc-959c-17de8a3df228", // Mon voisin Totoro (6 ans)
      "72817572-0a12-498b-8522-845864035074", // Le Chat Potté 2 (7 ans)
      "e5110c5c-d632-4d20-932f-ae51d257de9a", // Raiponce (6 ans)
      "9334936b-9386-4fce-a5da-7927034e578c", // Luca (7 ans)
      "15658e6f-a228-4f46-a6c6-37ab05018e75", // Les Mitchell contre les machines (10 ans)
      "920a69a3-a570-4a25-bd99-079b2dca1d13", // Toy Story 2 (6 ans)
      "059a2f0d-d0d0-4131-b9d3-22ecd9154bbe", // Dragons (7 ans)
      "f00e2891-11ff-4aa2-b4fa-40623971d084", // Élémentaire (7 ans)
      "c419ae48-6f8a-45a8-910b-0aa66ddc996b", // Kung Fu Panda 4 (6 ans)
      "bcd59eb0-abfb-41f6-9aa1-49477c716025", // 1001 Pattes (6 ans)
    ],
  },
  {
    id: "top-films-famille",
    title: "Top 15 des meilleurs films en famille",
    description: "Les films parfaits pour une soirée ciné en famille : drôles, émouvants et adaptés à tous les âges.",
    intro: "La soirée ciné en famille, c'est sacré. Trouver LE film qui plaît à tout le monde, par contre, c'est un autre sujet. Les petits veulent du dessin animé, les grands veulent de l'action, les ados lèvent les yeux au ciel. Ces 15 films mettent tout le monde d'accord. On les a testés, et on n'a eu aucune mutinerie. Pop-corn non inclus.",
    emoji: "👨‍👩‍👧‍👦",
    limit: 15,
    category: "top",
    lastUpdated: "2026-03",
    curatedIds: [
      "19cb35d9-e841-4048-ac9f-79ddffbfbf9f", // Le Robot sauvage (6 ans)
      "64449909-82bc-468b-a0bd-5753681bdea8", // Paddington 2 (6 ans)
      "77db9a4a-5bd4-4482-9416-d5aceefc20ad", // Wonka (8 ans)
      "02ac7984-f7a8-41e3-ad2f-991f6340273c", // Super Mario Bros. (6 ans)
      "c99328a8-f5e2-4888-b9ce-802d419c9500", // Mary Poppins (6 ans)
      "6ca8951f-32ad-442d-ad33-9f916b22e89f", // L'enfant, la taupe, le renard et le cheval (6 ans)
      "15658e6f-a228-4f46-a6c6-37ab05018e75", // Les Mitchell contre les machines (10 ans)
      "76ded8ca-8d32-4722-9804-d291db9d06b6", // Charlie et la chocolaterie (7 ans)
      "79ef5951-745e-4b83-8377-b029f2a8050b", // Les Goonies (10 ans)
      "d548b4aa-3ddd-4e14-98f0-d6e23ab832bb", // Matilda (6 ans)
      "58e152ea-eb1d-4dbb-bde5-b6a612b7c2da", // Le Petit Prince (6 ans)
      "7794734b-8013-4338-a671-b11f0433a283", // Paddington au Pérou (6 ans)
      "25119819-de73-414f-958e-fb4deb05c64c", // Garfield (6 ans)
      "7dfef07e-6ed6-4832-8e36-0ae3ab21a901", // La Nuit au Musée (7 ans)
      "ed4e578e-4f4a-4ba0-82aa-741adbad1d62", // Stuart Little (6 ans)
    ],
  },
  {
    id: "top-disney",
    title: "Top 10 des classiques Disney",
    description: "Les grands classiques Disney qui ont marqué des générations.",
    intro: "On connaît les chansons par cœur. On pleure toujours aux mêmes scènes. Et on attend le bon moment pour les montrer à nos enfants, comme si on leur confiait un secret. Les classiques de la Renaissance des années 90 et ceux qui ont renouvelé la magie depuis, le tout en 10 films.",
    emoji: "🏰",
    limit: 10,
    category: "top",
    lastUpdated: "2026-03",
    curatedIds: [
      "1b5e96b1-9f15-4d20-86b2-6f948ca58163", // Aladdin (7 ans) — animated
      "eccc17de-fbcd-41b0-b9a9-3b57896baf66", // La Belle et la Bête (7 ans)
      "e5110c5c-d632-4d20-932f-ae51d257de9a", // Raiponce (6 ans)
      "ac94cb19-24fb-4901-81a0-d426245b27a6", // Encanto (7 ans)
      "65353c9b-585a-48e9-a864-2c0ea96583c5", // La Reine des neiges (6 ans)
      "158e050a-5231-43a6-91fb-f56e1946cd3c", // La Petite Sirène (6 ans)
      "ed28cd3c-4e70-4aa3-8528-e8b8cc2d9a85", // Les Aristochats (6 ans)
      "2155bfe4-7d15-4b8e-82be-47b3281d32bb", // Hercule (8 ans)
      "94f16129-4e66-4011-8365-17a5325ea431", // Kuzco (7 ans)
      "d7624f2d-53f1-4899-81e5-0553f8c418a8", // Mufasa : Le Roi Lion (6 ans)
    ],
  },
  {
    id: "top-pixar",
    title: "Top 10 des films Pixar",
    description: "Les chefs-d'œuvre du studio aux films inoubliables.",
    intro: "Depuis le milieu des années 90, ce studio n'a jamais vraiment baissé le niveau. Des films qui mettent des mots sur les émotions de nos enfants, qui parlent du deuil avec justesse, qui font pleurer tout le monde dès les dix premières minutes. Nos 10 préférés, ceux qui touchent autant les parents que les petits.",
    emoji: "🚀",
    limit: 10,
    category: "top",
    lastUpdated: "2026-03",
    curatedIds: [
      "b7c955de-9b73-4047-8d57-4629fdc42421", // Ratatouille (6 ans)
      "118ae7ce-5978-4b21-b165-23f66f436e51", // Monstres & Cie (6 ans)
      "145c4ed8-6aa8-4507-aa9d-0e6e11a79d61", // Le Monde de Nemo (6 ans)
      "1745085c-82a7-4b1b-974d-cb914f83be8a", // Vice-versa 2 (8 ans)
      "0966956e-feb1-45be-9288-99675b7283a3", // Les Indestructibles (8 ans)
      "920a69a3-a570-4a25-bd99-079b2dca1d13", // Toy Story 2 (6 ans)
      "9334936b-9386-4fce-a5da-7927034e578c", // Luca (7 ans)
      "f00e2891-11ff-4aa2-b4fa-40623971d084", // Élémentaire (7 ans)
      "b1bb3bf4-a0b5-4cbd-a7bf-152be04896e1", // En avant (8 ans)
      "5e1fe4df-cbc6-4b9e-bf62-31e22f64a9d0", // Rebelle (8 ans)
    ],
  },
  {
    id: "top-ghibli",
    title: "Top 10 Studio Ghibli",
    description: "L'univers poétique et enchanteur du studio japonais de Hayao Miyazaki.",
    intro: "Fondé en 1985 par deux maîtres de l'animation japonaise, ce studio a produit des films qu'on ne trouve nulle part ailleurs. Des œuvres récompensées aux Oscars et à Berlin, des musiques qui restent en tête pendant des semaines. Des forêts qui respirent, des esprits bienveillants, des héroïnes courageuses. Ça ne ressemble à rien d'autre.",
    emoji: "🌿",
    limit: 10,
    category: "top",
    lastUpdated: "2026-03",
    curatedIds: [
      "ef679898-cc44-4788-8e66-0fa171d5ae5e", // Le Voyage de Chihiro (8 ans)
      "a4c78a98-7f7b-49cc-959c-17de8a3df228", // Mon voisin Totoro (6 ans)
      "c3a73966-67eb-4e95-9391-0bdb9f8edf5e", // Le Château ambulant (8 ans)
      "de91e424-9bb9-4f5c-ad9b-3deb07fdf8af", // Ponyo sur la falaise (6 ans)
      "204f22c8-1cdb-40c1-9edb-8ad106120c56", // Kiki la petite sorcière (8 ans)
      "14ada3ab-e095-4961-826f-f54661bd1c48", // Le Château dans le ciel (8 ans)
      "4d279035-2828-4234-ab5e-a1d559c482e5", // Arrietty (7 ans)
      "63022d2d-0ee4-467a-b4a2-5f020789c660", // Le Garçon et le héron (10 ans)
      "7b2a36e2-e508-43e8-979d-f66937076294", // Le Royaume des chats (7 ans)
      "5a27072e-496c-4b93-9637-e3abea94587e", // Porco Rosso (10 ans)
    ],
  },
  {
    id: "top-films-aventure",
    title: "Top 10 des films d'aventure pour enfants",
    description: "Action, exploration et découvertes : les meilleurs films d'aventure adaptés aux enfants.",
    intro: "Un bon film d'aventure, et les enfants veulent explorer le jardin dès le générique de fin. Trésors cachés, héros qui se dépassent, territoires inconnus. Ces 10 films font briller les yeux, donnent envie de bouger, et passent le test du « on le remet ? » au moment du dîner.",
    emoji: "🗺️",
    limit: 10,
    category: "top",
    lastUpdated: "2026-03",
    curatedIds: [
      "ae95be8c-178f-4b18-9e30-df33de5f6d98", // Spider-Man : Across the Spider-Verse (10 ans)
      "d869e655-ac1c-4033-ab88-619d3df7dc20", // Spider-Man : New Generation (10 ans)
      "79ef5951-745e-4b83-8377-b029f2a8050b", // Les Goonies (10 ans)
      "059a2f0d-d0d0-4131-b9d3-22ecd9154bbe", // Dragons (7 ans)
      "c3a73966-67eb-4e95-9391-0bdb9f8edf5e", // Le Château ambulant (8 ans)
      "0d36ab3a-41b7-4257-8e92-c51f9c6848e5", // L'Empire contre-attaque (10 ans)
      "46457bf3-b2fb-4ee3-976c-7996482aa9c5", // Les Nouveaux Héros (8 ans)
      "696fbd3f-4b4d-4334-84f2-60ac90cb7073", // Sonic 2 (8 ans)
      "f26ba400-959e-479e-9920-b2f5bec3033e", // Indiana Jones et le Cadran de la destinée (10 ans)
      "b410c36a-0791-4a12-af48-c0044b26502a", // Jurassic World : Renaissance (10 ans)
    ],
  },
  {
    id: "top-comedies-ados",
    title: "Top 10 des comédies pour ados",
    description: "Les comédies les plus drôles et adaptées aux adolescents.",
    intro: "Faire rire un ado, c'est un art. Trop bébé, il décroche. Trop vulgaire, on n'est pas tranquille en tant que parent. Ces 10 comédies tapent juste. De l'humour qui fait vraiment rire, des personnages auxquels ils s'identifient, et zéro moment gênant quand on regarde ensemble sur le canapé.",
    emoji: "😂",
    limit: 10,
    category: "top",
    lastUpdated: "2026-03",
    curatedIds: [
      "5998a10a-65c9-4520-9bc6-c276abdefc34", // La Folle Journée de Ferris Bueller (13 ans)
      "643bf033-c627-46e1-9364-febdeaf20685", // Lolita malgré moi (12 ans)
      "77db9a4a-5bd4-4482-9416-d5aceefc20ad", // Wonka (8 ans)
      "f9cc99ab-37a1-4682-a835-3dd18845cc43", // Astérix (8 ans)
      "02ac7984-f7a8-41e3-ad2f-991f6340273c", // Super Mario Bros. (6 ans)
      "696fbd3f-4b4d-4334-84f2-60ac90cb7073", // Sonic 2 (8 ans)
      "7f6c83bb-2e16-443b-a446-b13c3bc46210", // Shrek 2 (6 ans)
      "8112331b-00ea-4510-8a81-e227772c3470", // Retour vers le futur III (10 ans)
      "25119819-de73-414f-958e-fb4deb05c64c", // Garfield (6 ans)
      "5bcd4be9-63dd-4e66-9d43-1b04a5367f79", // Jumanji : Next Level (10 ans)
    ],
  },
  {
    id: "top-super-heros",
    title: "Top 10 des films de super-héros",
    description: "Marvel, DC et autres aventures héroïques pour toute la famille.",
    intro: "Les super-héros, ça fait rêver les enfants. Le problème, c'est que beaucoup de films du genre sont trop sombres ou trop violents pour les plus jeunes. Ces 10-là font rêver sans donner de cauchemars. Du courage, de la solidarité, et des capes qui claquent au vent.",
    emoji: "🦸",
    limit: 10,
    category: "top",
    lastUpdated: "2026-03",
    curatedIds: [
      "ae95be8c-178f-4b18-9e30-df33de5f6d98", // Spider-Man : Across the Spider-Verse (10 ans)
      "d869e655-ac1c-4033-ab88-619d3df7dc20", // Spider-Man : New Generation (10 ans)
      "46457bf3-b2fb-4ee3-976c-7996482aa9c5", // Les Nouveaux Héros (8 ans)
      "0966956e-feb1-45be-9288-99675b7283a3", // Les Indestructibles (8 ans)
      "4e4dc9e2-2026-460f-96f1-9d9d5d924136", // Black Panther : Wakanda Forever (10 ans)
      "6c49d372-df92-45fc-ba2b-e33bc8414383", // Les 4 Fantastiques : Premiers pas (10 ans)
      "1c4019e6-60e2-460d-b268-b3735f92cb35", // Shazam! La Rage des Dieux (10 ans)
      "000453dd-64ea-4bd9-aeaf-2f0171046425", // Spider-Man : Homecoming (10 ans)
      "0e290fac-dc12-492a-9a27-5181648f40be", // Thunderbolts* (13 ans)
      "d71260c8-36ae-4df3-89ff-7cb01ec84dd0", // Avengers : Endgame (13 ans)
    ],
  },
  {
    id: "top-films-educatifs",
    title: "Top 10 des films éducatifs",
    description: "Apprendre en s'amusant : les films qui éveillent la curiosité des enfants.",
    intro: "Le secret d'un bon film éducatif, c'est que l'enfant ne se rend pas compte qu'il apprend. Il est juste captivé. Des documentaires qui rendent curieux, des histoires qui posent des questions, des personnages qui donnent envie de comprendre le monde. On en a retenu 10 qui font ça très bien.",
    emoji: "📚",
    limit: 10,
    category: "top",
    lastUpdated: "2026-03",
    curatedIds: [
      "d5787840-53f8-4735-9fd9-ba0e8fd64609", // Les Figures de l'ombre (10 ans)
      "8f9e0d08-6b82-44b5-89f5-d31b4fa55b1b", // Des étoiles sur la terre (12 ans)
      "30fd16bc-5c15-46c6-9099-914b7b2d65cf", // Le Cercle des poètes disparus (13 ans)
      "c7456714-23fe-431c-9d20-e70b99c97e7e", // Le Discours d'un roi (12 ans)
      "1a09ed00-d8e6-4050-ba49-929ff42ea962", // Gandhi (12 ans)
      "d548b4aa-3ddd-4e14-98f0-d6e23ab832bb", // Matilda (6 ans)
      "19cb35d9-e841-4048-ac9f-79ddffbfbf9f", // Le Robot sauvage (6 ans)
      "58e152ea-eb1d-4dbb-bde5-b6a612b7c2da", // Le Petit Prince (6 ans)
      "ef5a5fe2-4eae-42c9-b703-ba3ba3218ec9", // Pinocchio par Guillermo del Toro (10 ans)
      "b7c955de-9b73-4047-8d57-4629fdc42421", // Ratatouille (6 ans)
    ],
  },
  {
    id: "meilleurs-films-2025",
    title: "Meilleurs films 2025 pour les familles",
    description: "Les films sortis en 2025 les mieux notés et adaptés aux familles.",
    intro: "2025 a réservé de bonnes surprises au cinéma pour les familles. On met à jour cette liste au fil de l'année avec les films qui nous ont marqués, ceux qui font parler dans les cours de récré et ceux qu'on recommande sans hésiter.",
    emoji: "⭐",
    limit: 15,
    category: "top",
    lastUpdated: "2026-03",
    // Dynamic — keep updating as 2025 films get imported
    query: { type: "MOVIE", year: 2025, maxAge: 12, excludeGenres: ["Horreur"], requireLanguage: ["fr", "en", "es", "it", "de", "ja"] },
  },

  // ── Seasonal collections ───────────────────────────────────────────
  {
    id: "films-noel-famille",
    title: "Films de Noël en famille",
    description: "Les classiques et nouveautés pour des fêtes magiques en famille.",
    intro: "Le sapin est monté, les guirlandes clignotent, le chocolat chaud est prêt. Il manque le film. Classiques ou nouveautés, tous les camps trouveront leur bonheur ici, des tout-petits aux grands-parents. De quoi tenir toutes les soirées des vacances de Noël.",
    emoji: "🎄",
    limit: 15,
    category: "seasonal",
    lastUpdated: "2026-03",
    curatedIds: [
      "4e91710a-9183-44d2-a402-9edf603ad153", // L'Étrange Noël de monsieur Jack (8 ans)
      "200a4e59-608f-47b1-ad8e-8cb149287c17", // Le Grinch (6 ans)
      "928d5d0d-45a8-493a-b899-13dc3faba81a", // Klaus (6 ans)
      "b6a93618-e918-4c04-b8d7-3fc669d1c2d2", // Le Pôle express (6 ans)
      "c21237f6-b2e3-42b7-9ef3-7ddeed942e8d", // Miracle sur la 34e rue (6 ans)
      "97a45723-4f00-40e5-9a85-a84058d07b73", // Les Chroniques de Noël (7 ans)
      "5ea48e07-0b90-44f3-8724-a7abd2b247fd", // Noël chez les Muppets (6 ans)
      "4aabdb7c-00e2-4bc6-ae74-71bee2efdae4", // Scrooge (8 ans)
      "3da9b399-6b50-4502-84dd-e5beeb1ac726", // Maman, j'ai raté l'avion ! (6 ans)
      "65353c9b-585a-48e9-a864-2c0ea96583c5", // La Reine des neiges (6 ans)
      "d4f57f5a-31d8-4bc6-952f-184fbcecf351", // Dragons : Retrouvailles (6 ans)
      "3e5b2139-934b-4c16-b310-049015ef502a", // La vie est belle (8 ans)
      "edc35769-fc1f-4311-b9b4-0e4c2e1cd96f", // La Pat' Patrouille : La Mission de Noël (4 ans)
      "bb79762e-5665-4b93-ad29-d4c4470918ce", // Noël blanc (8 ans)
      "a0b5bcfe-ab1a-4765-acfd-87272badd879", // Christmas Story (8 ans)
    ],
  },
  {
    id: "films-halloween-enfants",
    title: "Films d'Halloween pour enfants",
    description: "Frissons légers et citrouilles : des films d'Halloween adaptés aux enfants, sans cauchemars.",
    intro: "Halloween, c'est l'occasion de se faire un peu peur. Mais juste un peu. Des citrouilles, des fantômes rigolos, des sorcières pas si méchantes. Pile ce qu'il faut pour entrer dans l'ambiance sans que personne ne finisse dans le lit des parents à 3h du matin.",
    emoji: "🎃",
    limit: 10,
    category: "seasonal",
    lastUpdated: "2026-03",
    curatedIds: [
      "4e91710a-9183-44d2-a402-9edf603ad153", // L'Étrange Noël de monsieur Jack (8 ans)
      "50b2661c-e5c4-4dd1-abbb-44fa2eefbe57", // Coraline (8 ans)
      "7f086433-c296-4ada-bc2d-d7e65d129fce", // Monster House (8 ans)
      "d1f3b08b-8b20-496f-b8f2-56c5abaac52d", // Casper (7 ans)
      "46b05ea3-a342-48f1-af9f-98a653c82977", // Hocus Pocus 2 (10 ans)
      "b113fb00-58cb-4315-9faa-50a4473ca126", // Hôtel Transylvanie (10 ans)
      "13ca64d1-7286-4189-9511-f02095b14261", // La Famille Addams 2 (8 ans)
      "ed4c60c6-9fbd-4306-b39f-a9d4c8ebef65", // Scooby-Doo et Krypto ! (6 ans)
      "118ae7ce-5978-4b21-b165-23f66f436e51", // Monstres & Cie (6 ans)
      "29828dbe-cfa0-4977-bee7-a9047089d362", // Scooby-Doo ! Sur l'île aux zombies (8 ans)
    ],
  },
  {
    id: "films-vacances-ete",
    title: "Films pour les vacances d'été",
    description: "Soleil, aventures et bonne humeur : la sélection parfaite pour les vacances.",
    intro: "Les grandes vacances, c'est aussi les jours de pluie, les après-midi trop chauds pour sortir et les longs trajets en voiture. Ces films sentent bon l'été, l'aventure et la liberté. Pile ce qu'il faut pour les journées où on veut rêver un peu sans bouger du canapé.",
    emoji: "☀️",
    limit: 15,
    category: "seasonal",
    lastUpdated: "2026-03",
    curatedIds: [
      "79ef5951-745e-4b83-8377-b029f2a8050b", // Les Goonies (10 ans)
      "15658e6f-a228-4f46-a6c6-37ab05018e75", // Les Mitchell contre les machines (10 ans)
      "9334936b-9386-4fce-a5da-7927034e578c", // Luca (7 ans)
      "02ac7984-f7a8-41e3-ad2f-991f6340273c", // Super Mario Bros. (6 ans)
      "f26ba400-959e-479e-9920-b2f5bec3033e", // Indiana Jones (10 ans)
      "b410c36a-0791-4a12-af48-c0044b26502a", // Jurassic World : Renaissance (10 ans)
      "0d36ab3a-41b7-4257-8e92-c51f9c6848e5", // L'Empire contre-attaque (10 ans)
      "059a2f0d-d0d0-4131-b9d3-22ecd9154bbe", // Dragons (7 ans)
      "ae95be8c-178f-4b18-9e30-df33de5f6d98", // Spider-Man : Across the Spider-Verse (10 ans)
      "5bcd4be9-63dd-4e66-9d43-1b04a5367f79", // Jumanji : Next Level (10 ans)
      "8112331b-00ea-4510-8a81-e227772c3470", // Retour vers le futur III (10 ans)
      "696fbd3f-4b4d-4334-84f2-60ac90cb7073", // Sonic 2 (8 ans)
      "a6579284-ce8e-4ba1-9dfa-bcc7c5730dd0", // Vaiana 2 (6 ans)
      "7794734b-8013-4338-a671-b11f0433a283", // Paddington au Pérou (6 ans)
      "d7624f2d-53f1-4899-81e5-0553f8c418a8", // Mufasa : Le Roi Lion (6 ans)
    ],
  },

  // ── Gaming collections ─────────────────────────────────────────────
  {
    id: "top-jeux-famille",
    title: "Top 10 des jeux vidéo en famille",
    description: "Les meilleurs jeux pour jouer ensemble : coopération, fun et fous rires garantis.",
    intro: "Jouer ensemble, c'est quand même mieux que chacun dans son coin avec son écran. On a cherché les jeux où parents et enfants s'amusent vraiment en même temps. Des jeux coopératifs, des jeux où on rigole, des jeux où même papa qui « ne joue jamais aux jeux vidéo » finit par demander une deuxième partie.",
    emoji: "🎮",
    limit: 10,
    category: "top",
    lastUpdated: "2026-03",
    curatedIds: [
      "a29de2ac-8207-4b26-bae1-34d64b06295a", // Mario Kart 8 Deluxe (3 ans)
      "1ecd39c9-3a87-4334-a31e-d313bd5e9b01", // Super Mario Party (7 ans)
      "748eb49a-97d9-4331-8d83-84c58f2f9821", // Nintendo Switch Sports (6 ans)
      "c895fdb5-0e23-4366-b36e-3ba26ae78cc4", // Animal Crossing: New Horizons (7 ans)
      "b45b6852-0cf0-4c46-80cb-23f44ad3eeac", // Kirby and the Forgotten Land (6 ans)
      "409c0b44-a466-44d5-9ba3-e7dd0e4ef48e", // LEGO Star Wars: The Skywalker Saga (8 ans)
      "74e7b043-8305-4f25-a59c-285a11fe9f80", // Overcooked! (8 ans)
      "3fa9a840-2cf6-47bd-ba7f-de0b4e1513db", // Rayman Legends (7 ans)
      "99be4cde-67aa-455a-bcc1-d8e5e84a5c4a", // It Takes Two (10 ans)
      "36bc5133-41c2-4d68-8d7b-c831de2afba2", // Paper Mario: The Origami King (8 ans)
    ],
  },
  {
    id: "top-jeux-multijoueur-local",
    title: "Top 10 des jeux multijoueur canapé",
    description: "Les meilleurs jeux à partager sur le même écran, parfaits pour les soirées en famille.",
    intro: "Tout le monde sur le canapé, les manettes qui s'échangent, et des fous rires. Du chaos en cuisine, des courses endiablées, des aventures à deux. Pas besoin de deux consoles ni de connexion internet. Juste un écran et l'envie de jouer ensemble.",
    emoji: "🛋️",
    limit: 10,
    category: "top",
    lastUpdated: "2026-03",
    curatedIds: [
      "74e7b043-8305-4f25-a59c-285a11fe9f80", // Overcooked! (8 ans)
      "a29de2ac-8207-4b26-bae1-34d64b06295a", // Mario Kart 8 Deluxe (3 ans)
      "1ecd39c9-3a87-4334-a31e-d313bd5e9b01", // Super Mario Party (7 ans)
      "99be4cde-67aa-455a-bcc1-d8e5e84a5c4a", // It Takes Two (10 ans)
      "748eb49a-97d9-4331-8d83-84c58f2f9821", // Nintendo Switch Sports (6 ans)
      "3fa9a840-2cf6-47bd-ba7f-de0b4e1513db", // Rayman Legends (7 ans)
      "b040a167-640d-478d-a4a1-26ead95b6106", // Splatoon 2 (10 ans)
      "409c0b44-a466-44d5-9ba3-e7dd0e4ef48e", // LEGO Star Wars (8 ans)
      "e8b5553c-a3a7-44a1-9100-af03368f64a1", // Unravel (8 ans)
      "36bc5133-41c2-4d68-8d7b-c831de2afba2", // Paper Mario (8 ans)
    ],
  },
  {
    id: "top-jeux-ados",
    title: "Top 10 des jeux pour ados",
    description: "Sélection de jeux adaptés aux adolescents : aventure, sport et stratégie.",
    intro: "Les ados veulent des jeux qui ne font pas « bébé » mais qui restent adaptés à leur âge. Pas toujours facile de trouver le bon équilibre. Ces 10 jeux cochent les deux cases : assez costauds pour les accrocher, assez clean pour que les parents soient tranquilles.",
    emoji: "🕹️",
    limit: 10,
    category: "top",
    lastUpdated: "2026-03",
    curatedIds: [
      "b8279f33-aeb6-493a-b12d-a0a9ad36ce52", // The Legend of Zelda: Breath of the Wild (10 ans)
      "99be4cde-67aa-455a-bcc1-d8e5e84a5c4a", // It Takes Two (10 ans)
      "b9deccff-df0b-4080-b14f-32d779c799b3", // Stardew Valley (10 ans)
      "b040a167-640d-478d-a4a1-26ead95b6106", // Splatoon 2 (10 ans)
      "31d33a9d-3014-46f7-bd09-d86b15eb6b67", // Undertale Yellow (10 ans)
      "d2dbe936-9643-4b41-a2f9-e7c4f92f0a10", // Paper Mario: The Thousand-Year Door (8 ans)
      "a29de2ac-8207-4b26-bae1-34d64b06295a", // Mario Kart 8 Deluxe (3 ans)
      "409c0b44-a466-44d5-9ba3-e7dd0e4ef48e", // LEGO Star Wars (8 ans)
      "74e7b043-8305-4f25-a59c-285a11fe9f80", // Overcooked! (8 ans)
      "748eb49a-97d9-4331-8d83-84c58f2f9821", // Nintendo Switch Sports (6 ans)
    ],
  },
]

export async function GET(request: NextRequest) {
  try {
  const searchParams = request.nextUrl.searchParams
  const collectionId = searchParams.get("id")

  // If no collection ID, return list of all collections with counts + preview posters
  if (!collectionId) {
    const collectionsWithCounts = await Promise.all(
      COLLECTIONS.map(async (collection) => {
        let count = 0
        let posters: (string | null)[] = []

        if (collection.curatedIds) {
          // Curated: fetch poster URLs for preview
          const items = await prisma.mediaItem.findMany({
            where: { id: { in: collection.curatedIds }, posterUrl: { not: null } },
            select: { id: true, posterUrl: true },
          })
          count = collection.curatedIds.length
          // Maintain curated order for posters
          const itemMap = new Map(items.map((i) => [i.id, i.posterUrl]))
          posters = collection.curatedIds
            .map((id) => itemMap.get(id) ?? null)
            .filter(Boolean)
            .slice(0, 4)
        } else if (collection.query) {
          // Dynamic: count matching items
          const where = buildWhereClause(collection.query)
          where.posterUrl = { not: null, notIn: ["/placeholder-poster.jpg", ""] }
          where.expertAgeRec = { not: null }
          where.releaseDate = { ...((where.releaseDate as object) || {}), lte: new Date() }

          const items = await prisma.mediaItem.findMany({
            where,
            select: { posterUrl: true, tmdbRating: true },
            orderBy: { tmdbRating: { sort: "desc", nulls: "last" } },
            take: collection.limit,
          })
          count = items.length
          posters = items
            .filter((i) => i.posterUrl)
            .slice(0, 4)
            .map((i) => i.posterUrl)
        }

        return {
          id: collection.id,
          title: collection.title,
          description: collection.description,
          emoji: collection.emoji,
          limit: collection.limit,
          category: collection.category,
          lastUpdated: collection.lastUpdated,
          count,
          previewPosters: posters,
        }
      })
    )

    const response = NextResponse.json({
      collections: collectionsWithCounts.filter((c) => c.count >= 3),
    })
    response.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200")
    return response
  }

  // Find the collection
  const collection = COLLECTIONS.find((c) => c.id === collectionId)
  if (!collection) {
    return NextResponse.json(
      { error: "Collection not found" },
      { status: 404 }
    )
  }

  // Fetch items — curated or dynamic
  const items = collection.curatedIds
    ? await getCuratedItems(collection.curatedIds)
    : await getDynamicItems(collection.query!, collection.limit)

  return NextResponse.json({
    collection: {
      id: collection.id,
      title: collection.title,
      description: collection.description,
      intro: collection.intro,
      emoji: collection.emoji,
      limit: collection.limit,
      category: collection.category,
      lastUpdated: collection.lastUpdated,
    },
    items,
    total: items.length,
  })
  } catch (error) {
    console.error("Collections API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch collections", details: String(error) },
      { status: 500 }
    )
  }
}

/** Fetch specific items by ID, preserving the curated order. */
async function getCuratedItems(ids: string[]) {
  const items = await prisma.mediaItem.findMany({
    where: { id: { in: ids } },
    include: { contentMetrics: true },
  })

  // Build a map for O(1) lookup, then return in curated order
  const itemMap = new Map(items.map((item) => [item.id, item]))

  return ids
    .map((id) => itemMap.get(id))
    .filter(Boolean)
    .map((item) => ({
      id: item!.id,
      title: item!.title,
      originalTitle: item!.originalTitle,
      type: item!.type,
      posterUrl: item!.posterUrl,
      releaseDate: item!.releaseDate?.toISOString().split("T")[0],
      expertAgeRec: item!.expertAgeRec,
      genres: item!.genres,
      synopsisFr: item!.synopsisFr,
      contentMetrics: item!.contentMetrics ? {
        violence: item!.contentMetrics.violence,
        positiveMessages: item!.contentMetrics.positiveMessages,
      } : null,
    }))
}

/** Fetch items dynamically via query filters. */
async function getDynamicItems(query: NonNullable<Collection["query"]>, limit: number) {
  const where = buildWhereClause(query)

  // Quality gates
  where.posterUrl = { not: null, notIn: ["/placeholder-poster.jpg", ""] }
  where.expertAgeRec = { not: null }
  where.releaseDate = { ...((where.releaseDate as object) || {}), lte: new Date() }

  const raw = await prisma.mediaItem.findMany({
    where,
    include: { contentMetrics: true },
    orderBy: [
      { tmdbRating: { sort: "desc", nulls: "last" } },
      { releaseDate: "desc" },
    ],
    take: limit * 3,
  })

  const items = raw
    .sort((a, b) => (b.tmdbRating ?? 7.0) - (a.tmdbRating ?? 7.0))
    .slice(0, limit)

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    originalTitle: item.originalTitle,
    type: item.type,
    posterUrl: item.posterUrl,
    releaseDate: item.releaseDate?.toISOString().split("T")[0],
    expertAgeRec: item.expertAgeRec,
    genres: item.genres,
    synopsisFr: item.synopsisFr,
    contentMetrics: item.contentMetrics ? {
      violence: item.contentMetrics.violence,
      positiveMessages: item.contentMetrics.positiveMessages,
    } : null,
  }))
}

function buildWhereClause(query: NonNullable<Collection["query"]>) {
  const where: Record<string, unknown> = {}

  if (query.type) {
    where.type = query.type
  }

  if (query.maxAge != null) {
    where.expertAgeRec = { lte: query.maxAge }
  }

  if (query.year) {
    where.releaseDate = {
      gte: new Date(`${query.year}-01-01`),
      lt: new Date(`${query.year + 1}-01-01`),
    }
  }

  if (query.topics && query.topics.length > 0) {
    where.topics = { hasSome: query.topics }
  }

  if (query.genres && query.genres.length > 0) {
    where.genres = { hasSome: query.genres }
  }

  if (query.excludeGenres && query.excludeGenres.length > 0) {
    where.NOT = { genres: { hasSome: query.excludeGenres } }
  }

  if (query.requireLanguage && query.requireLanguage.length > 0) {
    where.originalLanguage = { in: query.requireLanguage }
  }

  return where
}
