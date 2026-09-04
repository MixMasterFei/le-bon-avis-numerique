/**
 * Per-game Parents' Guides — the "Guide parents" surface behind each game fiche.
 *
 * SHAPE IS EVIDENCE-DRIVEN, and it is deliberately NOT a screenshotted
 * step-by-step walkthrough. Two independent research passes converged:
 *
 *  - MAINTENANCE. These are among the fastest-rotting pages on the web. Roblox
 *    alone shipped 4-6 guide-invalidating changes in 24 months: the in-app
 *    parent PIN died in Nov 2024 for a linked-parent-account model, a facial
 *    age check became mandatory before any chat in Jan 2026, and Kids (5-8) /
 *    Select (9-15) account types landed mid-2026. The churn is regulator-driven,
 *    so it accelerates rather than settles. Twenty guides at menu-path fidelity
 *    is ~100-200 h/year of pure upkeep; the same twenty written as concepts +
 *    outcome-phrased settings + deep links drop to ~30-60 h.
 *
 *  - SEARCH. The procedural half ("comment configurer X") is owned by the
 *    publishers' own French docs — which are the correct source of truth and
 *    cannot honestly be outranked — and is being absorbed by AI Overviews, live
 *    in France since 22 July 2026, where informational queries trigger at
 *    70-80% and citation clicks run under 1%. Winning there earns impressions,
 *    not visits. The judgement half is what Google still hedges on for
 *    child-safety YMYL, and what an answer engine cannot synthesise.
 *
 * So the document has two layers:
 *
 *   1. UNDERSTANDING — what the game is, what actually happens when your child
 *      plays, and the handful of decisions a parent has to make. Long half-life
 *      (3-5 years), rarely edited, no date needed.
 *   2. ÉTAT DU JEU — the current, perishable facts. Quarantined in its own
 *      block, explicitly dated, phrased by OUTCOME ("réglez qui peut parler à
 *      votre enfant sur « Amis uniquement »") rather than by PATH
 *      ("Paramètres > Confidentialité > Chat"), and deep-linked to the vendor's
 *      own help page instead of transcribing its menu tree. When a step goes
 *      stale it discredits one dated block, not the whole page.
 *
 * NON-NEGOTIABLE: a guide is NOT an age-verdict page. Every game fiche already
 * ships `<title>` "{titre} — À partir de quel âge ? Dès N ans" (see
 * src/lib/fiche-title.ts) plus a FAQPage asking that exact question (see
 * src/lib/quick-answer.ts). If the guide also answers "à partir de quel âge",
 * two pages on a low-authority domain split the ranking signal — and the page
 * they would split it with is the 1 860-fiche asset the whole games strategy
 * rests on. The fiche keeps "à partir de quel âge"; the guide answers "comment
 * on s'y prend". So: cite the age once in passing if at all, link the fiche as
 * the canonical verdict, and emit no FAQPage here.
 *
 * `doesNotDo` is not decoration. The dominant risk here is not staleness but
 * confident wrongness — a parent who believes they capped spending when they
 * did not. Every guide states the limits of the controls it describes.
 */

import { TOP_GAMES } from "@/app/jeux/quel-age/topGames.data"

export interface GuideLink {
  label: string
  url: string
  /** Who publishes it — shown so the reader can weigh the source. */
  source: string
}

export interface GuideDecision {
  question: string
  /** Plain-language framing of the trade-off. Not a Totem verdict. */
  detail: string
}

export interface GameGuide {
  /** Matches TopGameSeed.key in topGames.data.ts. */
  key: string
  name: string
  /** One line, for the fiche button and meta description. */
  tagline: string

  // ── Layer 1 — understanding. Long half-life. ─────────────────────────
  whatItIs: string
  whatHappens: string[]
  whyKidsLove: string
  decisions: GuideDecision[]
  /** For parents who game, just not this one. Skips the basics. */
  advanced: string[]

  // ── Layer 2 — état du jeu. Perishable, dated, quarantined. ───────────
  stateOfPlay: {
    /** ISO date this block was last verified by a human. */
    verifiedOn: string
    /** Outcome-phrased current facts. Never menu paths. */
    facts: string[]
    /** What these controls do NOT do. The anti-false-reassurance block. */
    doesNotDo: string[]
    officialLinks: GuideLink[]
  }

  // ── Play together ────────────────────────────────────────────────────
  playTogether: {
    intro: string
    ideas: string[]
  }
}

export const GAME_GUIDES: GameGuide[] = [
  {
    key: "roblox",
    name: "Roblox",
    tagline: "Ce n'est pas un jeu, c'est une plateforme — et c'est toute la difficulté.",
    whatItIs:
      "Roblox n'est pas un jeu mais une plateforme qui héberge des millions de jeux créés par ses utilisateurs, dont beaucoup par des adolescents ou des amateurs. Dire « mon enfant joue à Roblox » renseigne à peu près autant que « mon enfant regarde des vidéos » : tout dépend desquelles.",
    whatHappens: [
      "Votre enfant choisit une « expérience » dans un catalogue immense, du parcours d'obstacles enfantin à la simulation d'horreur.",
      "Chaque expérience a ses propres règles, sa propre monnaie interne et son propre ton — la modération n'est pas homogène d'un jeu à l'autre.",
      "Les Robux, la monnaie de la plateforme, s'achètent en argent réel et se dépensent par petits montants répétés dans les expériences.",
      "Le social est central : les enfants y retrouvent leurs camarades de classe, ce qui explique la pression à y être.",
    ],
    whyKidsLove:
      "C'est autant une cour de récréation qu'un jeu. L'enfant y crée, y invite ses amis, y montre ce qu'il possède. L'exclure de Roblox, c'est souvent l'exclure d'une conversation collective — un coût réel qu'il vaut mieux nommer avant d'en décider.",
    decisions: [
      {
        question: "Avec qui votre enfant peut-il parler ?",
        detail:
          "C'est la décision la plus structurante, avant même le temps d'écran. Le chat peut être coupé, limité aux amis, ou ouvert. Les signalements documentés d'adultes entrant en contact avec des enfants passent par là, la conversation se déplaçant ensuite souvent hors plateforme.",
      },
      {
        question: "Quel niveau de contenu autorisez-vous ?",
        detail:
          "Roblox classe les expériences par niveau de maturité. Le réglage détermine ce que l'enfant peut même ouvrir, ce qui est plus efficace que d'essayer de surveiller jeu par jeu.",
      },
      {
        question: "Y a-t-il de l'argent en jeu, et combien ?",
        detail:
          "Décidez du principe avant le montant : les Robux sont-ils un cadeau occasionnel, un argent de poche mensuel, ou pas du tout ? Sans règle explicite, la dépense se fait par petites touches invisibles.",
      },
      {
        question: "Jouer seul ou dans la pièce commune ?",
        detail:
          "Sur une plateforme sociale, la localisation de l'écran fait plus pour la sécurité que la plupart des réglages.",
      },
    ],
    advanced: [
      "Le modèle économique est un système à deux monnaies : les créateurs sont payés en Robux qu'ils ne peuvent convertir en euros qu'au-delà d'un seuil, ce qui retient la valeur dans la plateforme.",
      "La modération est en grande partie automatisée et travaille à l'échelle de millions d'expériences — d'où des faux positifs sur le chat et, à l'inverse, du contenu limite qui passe.",
      "Les « condo games », expériences à contenu adulte déguisées, sont un phénomène récurrent : elles sont fermées régulièrement et réapparaissent sous d'autres noms. C'est un jeu du chat et de la souris, pas un problème résolu.",
      "Si vous venez du jeu PC ou console, l'analogie utile n'est pas Minecraft mais un magasin d'applications : vous n'évaluez pas un jeu, vous évaluez une politique de plateforme.",
    ],
    stateOfPlay: {
      verifiedOn: "2026-08-19",
      facts: [
        "Les contrôles parentaux passent par un compte parent distinct, vérifié, lié au compte de l'enfant — le code PIN à quatre chiffres dans l'application appartient au passé.",
        "Depuis janvier 2026, une estimation d'âge par selfie est requise avant que le chat ne fonctionne, et les joueurs sont ensuite répartis en tranches d'âge qui ne peuvent discuter qu'entre elles.",
        "Depuis mi-2026, deux types de comptes existent pour les plus jeunes, avec chat désactivé par défaut et accès restreint aux contenus les plus doux, l'enfant basculant automatiquement vers un régime plus large en grandissant.",
        "Les expériences portent une étiquette de maturité, et le compte parent permet de fixer le niveau maximal accessible.",
        "Un plafond de dépense mensuel peut être défini depuis le compte parent.",
      ],
      doesNotDo: [
        "L'estimation d'âge par selfie se trompe : un adolescent peut être classé plus jeune ou plus vieux qu'il n'est, et le classement conditionne avec qui il parle.",
        "Aucun de ces réglages ne limite le temps de jeu — Roblox ne fournit pas de minuteur ; cela se règle au niveau de l'appareil ou de la console.",
        "Le filtrage par niveau de maturité porte sur l'étiquette déclarée de l'expérience, pas sur ce qui s'y passe réellement en jeu.",
        "Les déploiements sont échelonnés par pays : une fonctionnalité annoncée n'est pas nécessairement active en France le même mois.",
      ],
      officialLinks: [
        {
          label: "Contrôles parentaux et sécurité (documentation Roblox)",
          url: "https://about.roblox.com/parental-controls",
          source: "Roblox",
        },
        {
          label: "Centre d'aide Roblox — compte parent",
          url: "https://en.help.roblox.com/hc/fr",
          source: "Roblox",
        },
      ],
    },
    playTogether: {
      intro:
        "Roblox se prête mieux au jeu partagé qu'on ne le croit, à condition d'accepter que votre enfant soit le guide. C'est d'ailleurs le meilleur angle : lui demander de vous montrer inverse le rapport habituel et vous apprend en vingt minutes ce qu'aucune fiche ne vous dira.",
      ideas: [
        "Demandez-lui de vous faire visiter son expérience préférée et de vous expliquer ce qu'on y gagne — vous verrez immédiatement si le ressort est la création, la collection ou la dépense.",
        "Créez votre propre compte parent et rejoignez-le sur une expérience simple : vous comprendrez le fonctionnement du chat de l'intérieur.",
        "Essayez ensemble Roblox Studio, l'outil de création : beaucoup d'enfants passent de consommateur à créateur, et c'est le versant le plus intéressant de la plateforme.",
        "Fixez le rendez-vous plutôt que la durée : « on joue ensemble le samedi matin » se négocie mieux qu'un décompte de minutes.",
      ],
    },
  },
  {
    key: "minecraft",
    name: "Minecraft",
    tagline: "Le jeu lui-même est calme — la question, c'est où votre enfant y joue.",
    whatItIs:
      "Un bac à sable : un monde fait de blocs que l'on casse et empile, sans score, sans fin et sans obligation de gagner. C'est l'un des rares titres régulièrement cités comme parmi les plus sûrs du marché, et le point de vigilance n'est presque jamais le jeu lui-même.",
    whatHappens: [
      "En mode créatif, l'enfant construit sans contrainte ni danger.",
      "En mode survie, il collecte des ressources et affronte des créatures simples, la nuit venue — la tension y est réelle mais enfantine.",
      "Le jeu peut se pratiquer seul, en réseau local à plusieurs, ou sur des serveurs en ligne tenus par des tiers.",
      "Un catalogue payant de contenus additionnels existe dans certaines versions.",
    ],
    whyKidsLove:
      "C'est un jeu de construction sans échec possible. Il récompense la patience et l'imagination plutôt que les réflexes, ce qui le rend accessible tôt et jouable très longtemps.",
    decisions: [
      {
        question: "Solo, entre amis, ou serveurs publics ?",
        detail:
          "C'est la seule décision qui compte vraiment. Le jeu solo ou en réseau local ne pose aucune des questions habituelles. Les serveurs publics tiers ne sont pas modérés par l'éditeur et peuvent héberger chat libre et contenus non filtrés.",
      },
      {
        question: "Quelle version ?",
        detail:
          "Les différentes éditions ne se comportent pas de la même façon en matière de multijoueur, d'achats et de réglages familiaux. Vérifiez laquelle votre enfant utilise avant de chercher les bons réglages.",
      },
      {
        question: "Le temps, plutôt que le contenu.",
        detail:
          "Minecraft n'a pas de fin : c'est un jeu où l'on s'absorbe. La négociation porte donc sur le rythme, pas sur ce que l'enfant y voit.",
      },
    ],
    advanced: [
      "Le vrai débat est mods et serveurs, pas le jeu de base : un serveur communautaire change entièrement l'expérience sociale, et c'est là que se joue le contenu.",
      "Le passage au compte Microsoft a centralisé les réglages familiaux au niveau du compte plutôt que du jeu — ce que vous cherchez est probablement dans les paramètres familiaux Microsoft, pas dans Minecraft.",
      "Si vous cherchez un premier jeu à faire découvrir en accompagnant, c'est le meilleur candidat de cette liste : aucune pression de progression, aucune monnaie aléatoire, et une courbe d'apprentissage qui supporte un adulte débutant.",
    ],
    stateOfPlay: {
      verifiedOn: "2026-08-19",
      facts: [
        "Les réglages familiaux (temps d'écran, achats, communication) se gèrent au niveau du compte Microsoft de l'enfant plutôt que dans le jeu.",
        "Le multijoueur en ligne et le chat peuvent être autorisés ou refusés depuis ces réglages familiaux.",
        "Les serveurs tiers ne relèvent pas de la modération de l'éditeur.",
      ],
      doesNotDo: [
        "Les réglages du compte ne filtrent pas le contenu d'un serveur tiers une fois l'enfant connecté.",
        "Aucun réglage ne distingue un serveur communautaire sérieux d'un serveur mal tenu — cela se vérifie à la main.",
      ],
      officialLinks: [
        {
          label: "Paramètres familiaux Microsoft",
          url: "https://support.microsoft.com/fr-fr/family",
          source: "Microsoft",
        },
        {
          label: "Minecraft — contrôle parental (page officielle)",
          url: "https://www.minecraft.net/fr-fr/article/parental-controls",
          source: "Mojang / Microsoft",
        },
      ],
    },
    playTogether: {
      intro:
        "Minecraft est probablement le meilleur jeu de cette liste pour jouer réellement avec son enfant, y compris en partant de zéro. Le mode créatif supprime toute pression et laisse la place à un projet commun.",
      ideas: [
        "Lancez un monde en créatif à deux et donnez-vous un projet : une maison, un pont, une reproduction de votre rue.",
        "Laissez votre enfant mener : c'est un des rares terrains où il est légitimement plus compétent que vous, et cela vaut beaucoup.",
        "En réseau local, aucun réglage en ligne n'est nécessaire — c'est la façon la plus simple de commencer.",
        "Le mode survie à deux, avec un adulte débutant, est une bonne école de coopération : il faut se répartir les rôles pour tenir la première nuit.",
      ],
    },
  },
  {
    key: "fortnite",
    name: "Fortnite",
    tagline: "La violence n'est pas le sujet — le chat vocal et la boutique le sont.",
    whatItIs:
      "Un jeu d'affrontement en ligne où cent joueurs s'éliminent jusqu'au dernier survivant, dans un univers coloré et sans réalisme. Il a depuis largement débordé du seul mode bataille : concerts virtuels, modes créatifs, cartes construites par les joueurs.",
    whatHappens: [
      "Les parties durent une vingtaine de minutes et s'enchaînent sans point d'arrêt naturel.",
      "L'élimination est stylisée : le personnage disparaît, il n'y a ni sang ni corps.",
      "Le chat vocal met l'enfant en relation avec des coéquipiers qu'il ne connaît pas nécessairement.",
      "Une boutique fait tourner des tenues et objets cosmétiques, achetés avec une monnaie interne payante.",
    ],
    whyKidsLove:
      "C'est un lieu de rendez-vous autant qu'un jeu : on y retrouve ses amis, on y voit les nouveautés, on y montre ce que l'on porte. La pression sociale des cosmétiques est réelle et mérite d'être prise au sérieux plutôt que moquée.",
    decisions: [
      {
        question: "Le chat vocal, avec qui ?",
        detail:
          "C'est le vrai sujet du jeu, bien avant la violence. Il peut être coupé, limité aux amis, ou laissé ouvert à des inconnus. Sans réglage, l'ouverture est la valeur par défaut.",
      },
      {
        question: "Qui valide les achats ?",
        detail:
          "La boutique change en permanence, ce qui entretient une pression d'achat constante. Une validation parentale obligatoire pour chaque achat désamorce l'essentiel du problème.",
      },
      {
        question: "Comment on s'arrête.",
        detail:
          "Comme une partie ne peut pas être quittée sans pénaliser l'équipe, l'arrêt est structurellement conflictuel. Convenir d'un nombre de parties plutôt que d'une heure fonctionne généralement mieux.",
      },
    ],
    advanced: [
      "Le modèle est entièrement cosmétique : rien de ce qui s'achète ne donne d'avantage en jeu. Cela change la conversation — l'enjeu est social, pas compétitif.",
      "Le passe de combat récompense la régularité plutôt que la dépense, ce qui crée une pression à se connecter quotidiennement bien plus forte que la pression à payer.",
      "Les modes créatifs et les cartes de joueurs constituent un second jeu dans le jeu, avec sa propre modération et ses propres contenus — c'est souvent là que l'enfant passe le plus de temps.",
      "Si vous venez des jeux de tir compétitifs, notez que la construction a longtemps été la vraie barrière de compétence ; les modes sans construction ont rendu le jeu bien plus accessible aux débutants, y compris adultes.",
    ],
    stateOfPlay: {
      verifiedOn: "2026-08-19",
      facts: [
        "Les contrôles parentaux d'Epic permettent de couper le chat vocal et textuel, et d'exiger une validation parentale pour chaque achat.",
        "Ces réglages ne sont pas actifs par défaut : ils se mettent en place depuis le compte.",
        "Des comptes à périmètre réduit existent pour les plus jeunes, avec les fonctions sociales désactivées tant qu'un parent ne les autorise pas.",
      ],
      doesNotDo: [
        "Couper le chat dans le jeu n'empêche pas l'enfant de discuter en parallèle via une autre application vocale, ce que font beaucoup de groupes d'amis.",
        "Les contrôles ne limitent pas le temps de jeu — cela se règle au niveau de la console ou de l'appareil.",
        "La validation des achats couvre la boutique du jeu, pas les cartes prépayées reçues par ailleurs.",
      ],
      officialLinks: [
        {
          label: "Contrôle parental Fortnite (page officielle)",
          url: "https://www.fortnite.com/parental-controls?lang=fr",
          source: "Epic Games",
        },
      ],
    },
    playTogether: {
      intro:
        "Fortnite se joue mieux à deux qu'on ne l'imagine, et l'écart de niveau y est moins pénalisant qu'ailleurs : en duo, un adulte débutant reste utile même sans viser juste.",
      ideas: [
        "Jouez en duo plutôt que d'observer : vous comprendrez la pression du chat d'équipe de l'intérieur.",
        "Essayez les modes sans construction, nettement plus accessibles à un adulte qui débute.",
        "Faites-vous expliquer la boutique et le passe de combat — c'est le meilleur point d'entrée pour parler d'argent sans que ce soit un reproche.",
        "Les modes créatifs permettent de jouer ensemble sans affrontement, si l'élimination vous gêne.",
      ],
    },
  },
]

/** Guide for a seed key, or null. */
export function getGameGuide(key: string): GameGuide | null {
  return GAME_GUIDES.find((g) => g.key === key) ?? null
}

/** Seed keys that have a written guide — used to decide whether to show the CTA. */
export function guideKeys(): string[] {
  return GAME_GUIDES.map((g) => g.key)
}

/**
 * Resolve a catalogue title to a guide key.
 *
 * Reuses the TOP_GAMES alias table rather than duplicating a second matching
 * list: those aliases are already maintained against real catalogue titles
 * ("Minecraft: Java Edition", "Fortnite OG: Chapter 1 Season 7"), so a guide
 * written for "minecraft" attaches to every edition without extra wiring.
 */
export function guideKeyForTitle(title: string): string | null {
  const t = title.toLowerCase()
  for (const guide of GAME_GUIDES) {
    const seed = TOP_GAMES.find((s) => s.key === guide.key)
    const aliases = seed?.aliases ?? [guide.key]
    if (aliases.some((a) => t.includes(a))) return guide.key
  }
  return null
}
