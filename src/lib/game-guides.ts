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
  /**
   * The catalogue fiche this guide is about, when the seed's aliases would
   * pick another one (the most-voted GTA is V, not VI). Furniture only: the
   * age strip and imagery come from this row, the verdict stays on the fiche.
   */
  catalogueId?: string

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
  {
    key: "zelda-ocarina-of-time",
    name: "The Legend of Zelda: Ocarina of Time (Switch 2)",
    tagline: "Un jeu que vous avez peut-être connu revient, et cette fois vous pouvez y jouer avec votre enfant.",
    whatItIs:
      "Le remake, sur Nintendo Switch 2, d'une aventure sortie en 1998 sur Nintendo 64 et souvent citée parmi les jeux les plus marquants de son époque. Beaucoup de parents l'ont terminée eux-mêmes. On y incarne Link, un jeune garçon qui parcourt le royaume d'Hyrule, explore des donjons et voyage dans le temps pour revenir adulte. Tout se joue seul, sans boutique ni joueurs inconnus.",
    whatHappens: [
      "L'enfant explore un grand monde, parle aux habitants et suit une histoire découpée en donjons.",
      "Chaque donjon est un casse-tête : trouver la clé, actionner le bon mécanisme, comprendre comment atteindre une porte.",
      "Les combats se font à l'épée et au bouclier contre des monstres et des créatures fantastiques, avec un adversaire plus coriace au bout de chaque donjon.",
      "Une ocarina sert à jouer des mélodies qui ouvrent des passages ou changent l'heure du jour : il faut les retenir.",
      "On peut se perdre ou rester bloqué un moment. Cela fait partie du jeu, et c'est souvent là qu'un adulte devient utile.",
    ],
    whyKidsLove:
      "Le sentiment d'être un petit héros qui grandit, au sens propre puisque Link passe de l'enfance à l'âge adulte au milieu de l'histoire. Et la fierté de résoudre seul un donjon qui résistait depuis deux soirs. Pour beaucoup d'enfants, c'est aussi le jeu dont leurs parents parlent avec émotion, ce qui lui donne un attrait particulier.",
    decisions: [
      {
        question: "Jouer à côté, ou le laisser seul ?",
        detail:
          "C'est un jeu solo, donc aucune question de chat ou d'inconnus. La vraie question est l'accompagnement : certains passages demandent de la lecture, de la patience et un peu d'orientation. Un enfant qui lit encore lentement profitera davantage du jeu avec un adulte à côté qu'en autonomie.",
      },
      {
        question: "Les moments qui peuvent impressionner.",
        detail:
          "La classification porte sur des combats contre des créatures fantastiques. La sensibilité aux monstres et aux lieux sombres varie beaucoup d'un enfant à l'autre : jouer les premiers donjons ensemble est le moyen le plus simple de voir comment il réagit.",
      },
      {
        question: "Le temps, plutôt que le contenu.",
        detail:
          "Une aventure de ce type se joue sur des dizaines d'heures et se prête mal aux sessions de dix minutes. Convenir de sessions plus longues mais moins fréquentes évite de couper au milieu d'un donjon.",
      },
    ],
    advanced: [
      "Il s'agit d'un remake reconstruit pour la Switch 2, pas d'une simple conversion : Nintendo a présenté des scènes désormais doublées et un saut que l'on déclenche soi-même, absent de l'original. Si vous avez joué en 1998, ne vous fiez pas entièrement à vos souvenirs du rythme.",
      "Le remake porte exactement le même titre que l'original, et une version 3DS existe aussi depuis 2011. Au moment d'acheter, vérifiez que vous prenez bien la version Switch 2.",
      "L'original avait popularisé le verrouillage de cible pendant les combats, devenu depuis la norme des jeux d'aventure. C'est une bonne porte d'entrée pour un enfant qui découvre les jeux en 3D.",
    ],
    stateOfPlay: {
      // Date des recherches en ligne (21 nov. 2026), PAS une relecture humaine :
      // chaque fait ci-dessous attend sa vérification avant GAME_GUIDES_PUBLIC.
      verifiedOn: "2026-11-21",
      facts: [
        "Le remake est sorti en novembre 2026 et fonctionne uniquement sur Nintendo Switch 2.",
        "La fiche officielle de Nintendo l'affiche PEGI 12.",
        "L'application gratuite Contrôle parental Nintendo Switch permet de fixer un temps de jeu quotidien pour la console, d'accorder une prolongation ponctuelle et de consulter ce à quoi l'enfant a joué.",
        "Les logiciels peuvent être limités selon leur classification d'âge, depuis la console ou l'application.",
        "Pour un enfant de moins de 16 ans, la discussion GameChat de la Switch 2 ne fonctionne qu'une fois le contrôle parental configuré, et elle ne se règle que depuis l'application.",
        "Les achats sur le Nintendo eShop se restreignent dans les paramètres du compte Nintendo de l'enfant, pas dans l'application de contrôle parental.",
      ],
      doesNotDo: [
        "La limite de temps porte sur la console entière, pas sur un jeu en particulier.",
        "Le contrôle parental est attaché à la console : il ne suit pas l'enfant qui joue chez un ami.",
        "Le filtre par âge s'appuie sur la classification officielle du jeu. Il ne dit rien de la sensibilité de votre enfant à un donjon sombre ou à un monstre précis.",
        "Régler l'application ne bloque pas les achats : ceux-ci dépendent du compte Nintendo, à paramétrer à part.",
      ],
      officialLinks: [
        {
          label: "Présentation et FAQ du contrôle parental sur Nintendo Switch 2 et Nintendo Switch",
          url: "https://www.nintendo.com/fr-fr/Assistance/Controle-parental/Presentation-et-FAQ-sur-le-controle-parental-sur-Nintendo-Switch-2-et-Nintendo-Switch-1494768.html",
          source: "Nintendo",
        },
        {
          label: "Paramétrer ou modifier le contrôle parental de la Nintendo Switch 2",
          url: "https://www.nintendo.com/fr-fr/Assistance/Controle-parental/Comment-parametrer-modifier-ou-desactiver-le-controle-parental-de-la-console-Nintendo-Switch-2-2843839.html",
          source: "Nintendo",
        },
        {
          label: "Fiche officielle du jeu (boutique Nintendo, Royaume-Uni)",
          url: "https://www.nintendo.com/en-gb/Games/Nintendo-Switch-2-games/The-Legend-of-Zelda-Ocarina-of-Time-3115664.html",
          source: "Nintendo",
        },
        {
          label: "Rechercher la classification sur le site PEGI",
          url: "https://pegi.info/fr",
          source: "PEGI",
        },
      ],
    },
    playTogether: {
      intro:
        "C'est le guide où la question s'inverse : vous connaissez peut-être déjà ce jeu mieux que votre enfant. L'enjeu est de ne pas lui confisquer la manette pour autant.",
      ideas: [
        "Laissez-lui la manette et prenez le rôle du copilote : vous lisez les dialogues à voix haute, il décide où aller.",
        "Quand il bloque dans un donjon, posez-lui des questions plutôt que de donner la solution. « Qu'est-ce qu'on n'a pas encore essayé ? » marche mieux qu'un doigt sur l'écran.",
        "Apprenez les mélodies d'ocarina ensemble, sur un bout de papier ou en les chantant : c'est le moment du jeu qui reste le plus longtemps en mémoire.",
        "Racontez-lui comment vous y jouiez vous-même. Les enfants aiment savoir que leurs parents ont eux aussi été bloqués au même endroit.",
      ],
    },
  },
  {
    key: "gta",
    name: "Grand Theft Auto VI (GTA 6)",
    // The seed's aliases match every GTA, and by votes GTA V wins: pin VI.
    catalogueId: "57065822-8280-4fe1-9598-5ed442f4319c",
    tagline: "Votre enfant le réclame parce que toute sa classe en parle. Voici de quoi lui répondre.",
    whatItIs:
      "Le nouvel épisode de la série d'action criminelle de Rockstar Games, sorti en novembre 2026 sur PlayStation 5 et Xbox Series X|S. Le jeu a été conçu pour des adultes et classé comme tel. Si votre enfant vous le demande entre 11 et 15 ans, la question ne porte donc pas sur un réglage à trouver : il s'agit de savoir comment dire non, ou pas encore, sans en faire une guerre. Ce guide vaut aussi pour GTA V et GTA Online, que les enfants réclament pour les mêmes raisons.",
    whatHappens: [
      "Le joueur incarne un duo de criminels, Lucia et Jason, dans Leonida, un État fictif inspiré de la Floride qui comprend la ville de Vice City.",
      "Les missions tournent autour du crime : braquages, fusillades, poursuites en voiture.",
      "Entre les missions, le monde ouvert laisse le joueur aller où il veut et faire ce qu'il veut, y compris commettre des violences sans lien avec l'histoire.",
      "Les motifs de la classification européenne sont la violence, le contenu sexuel et la drogue.",
      "À sa sortie, le jeu se joue seul. La série a déjà eu un volet en ligne séparé, GTA Online, où l'on croise des inconnus.",
    ],
    whyKidsLove:
      "C'est d'abord un sujet de cour de récréation. Ce lancement était attendu depuis plus de dix ans, les bandes-annonces ont circulé partout, et un enfant qui n'y a pas accès a l'impression d'être le seul exclu de la conversation. Le monde ouvert fascine aussi pour lui-même : conduire où l'on veut, dans une ville qui ressemble à une vraie. Entendre cette envie sérieusement, sans s'en moquer, rend le « non » beaucoup plus facile à faire accepter.",
    decisions: [
      {
        question: "Non, pas encore : comment le dire sans guerre ?",
        detail:
          "Expliquez la raison plutôt que de vous retrancher derrière « c'est interdit » : le jeu est réservé aux adultes à cause de ce qu'il montre (sexe, drogue, violence sur des personnes), pas parce qu'il serait trop difficile. Reconnaissez le coût social, puis proposez quelque chose de concret : un âge où vous en reparlerez, ou un autre jeu en monde ouvert pensé pour son âge. Un « non » assorti d'une date se négocie bien mieux qu'un « non » tout court.",
      },
      {
        question: "Et les vidéos, vous les autorisez ?",
        detail:
          "Beaucoup d'enfants découvrent GTA sans jamais y jouer, en regardant des parties filmées ou commentées en direct. Aucun réglage de console ne touche à cela. Décidez si regarder relève de la même règle que jouer, et dites-le clairement : c'est souvent là que le sujet se règle en pratique.",
      },
      {
        question: "Que se passe-t-il chez les copains ?",
        detail:
          "Vous ne contrôlez pas la console des autres familles. Plutôt qu'une interdiction impossible à vérifier, dites à votre enfant ce que vous attendez de lui s'il se retrouve devant le jeu ailleurs, et parlez-en aux parents que vous connaissez.",
      },
      {
        question: "Quand le mode en ligne arrivera.",
        detail:
          "Rockstar n'a pas annoncé de date, mais si un volet en ligne voit le jour, il ajoutera des inconnus, un chat vocal et une boutique. Si vous avez dit « oui » au jeu solo pour un grand adolescent, ce « oui » ne vaut pas automatiquement pour le mode en ligne : la question se repose à ce moment-là.",
      },
    ],
    advanced: [
      "Le modèle économique de GTA V s'est surtout joué dans GTA Online, avec sa monnaie interne vendue en argent réel. C'est l'expérience à garder en tête pour le jour où un volet en ligne sera annoncé.",
      "Pour un adolescent qui veut surtout un grand monde ouvert à parcourir en voiture, les jeux de course en monde ouvert et les aventures d'action classées plus bas couvrent une bonne partie de l'envie. Regardez leur fiche avant de proposer un titre précis.",
      "Une console familiale partagée a souvent un compte adulte ouvert : un enfant qui y a accès contourne tous les réglages décrits ici. Le compte de l'enfant doit être un compte enfant, rattaché au vôtre.",
    ],
    stateOfPlay: {
      // Date des recherches en ligne (21 nov. 2026), PAS une relecture humaine :
      // chaque fait ci-dessous attend sa vérification avant GAME_GUIDES_PUBLIC.
      verifiedOn: "2026-11-21",
      facts: [
        "GTA VI est disponible sur PlayStation 5 et Xbox Series X|S depuis le 19 novembre 2026. Aucune version PC n'est disponible à ce jour.",
        "Il est classé PEGI 18 pour la violence, le contenu sexuel et la drogue. PEGI signale des achats intégrés, mais pas d'objets aléatoires payants.",
        "À sa sortie, le jeu se joue en solo : Rockstar n'a pas annoncé de date pour un mode en ligne.",
        "Sur PlayStation 5, un compte enfant rattaché à votre compte peut être limité aux jeux d'une certaine classification d'âge : un jeu au-dessus ne se lance pas.",
        "PlayStation permet aussi de fixer un plafond de dépenses mensuel, de restreindre la communication avec d'autres joueurs et de limiter le temps de jeu jour par jour, depuis la console ou l'application PlayStation Family.",
        "Sur Xbox, les paramètres familiaux permettent de filtrer les jeux selon leur classification d'âge, d'exiger votre accord avant un achat, et de choisir avec qui l'enfant peut jouer et discuter en ligne : personne, ses amis, ou tout le monde.",
        "Ces réglages Xbox se gèrent aussi depuis l'application gratuite Xbox Family Settings, sur votre téléphone.",
      ],
      doesNotDo: [
        "Les limites d'âge de la console n'empêchent pas votre enfant de regarder des parties en vidéo ou en direct, sur son téléphone ou un ordinateur.",
        "Elles ne s'appliquent qu'à son compte, sur votre console : chez un ami, ou sur un compte adulte resté ouvert, rien ne s'y oppose.",
        "Elles ne protègent pas d'un second compte créé avec une fausse date de naissance. Vérifiez de temps en temps quels comptes existent sur la console.",
        "Le plafond de dépenses et l'accord avant achat portent sur les achats faits avec le compte de l'enfant, pas sur une carte prépayée utilisée sur un autre compte.",
      ],
      officialLinks: [
        {
          label: "Contrôle parental et limites de dépenses sur PlayStation",
          url: "https://www.playstation.com/fr-fr/support/account/ps5-parental-controls-spending-limits/",
          source: "Sony Interactive Entertainment",
        },
        {
          label: "L'application PlayStation Family",
          url: "https://www.playstation.com/fr-fr/parental-controls/",
          source: "Sony Interactive Entertainment",
        },
        {
          label: "Jouer en famille sur Xbox (paramètres familiaux)",
          url: "https://www.xbox.com/fr-FR/family-hub",
          source: "Microsoft",
        },
        {
          label: "Rechercher la classification sur le site PEGI",
          url: "https://pegi.info/fr",
          source: "PEGI",
        },
        {
          label: "Grand Theft Auto VI (site officiel)",
          url: "https://www.rockstargames.com/VI",
          source: "Rockstar Games",
        },
      ],
    },
    playTogether: {
      intro:
        "Jouer à GTA VI avec un enfant de 12 ans n'est pas la piste de ce guide. En revanche, s'intéresser à ce qui l'attire dans le jeu, c'est jouer avec lui sur un autre terrain.",
      ideas: [
        "Demandez-lui ce qu'il a vu passer et ce qui lui plaît : la ville, les voitures, l'histoire, ou le fait que tout le monde en parle. La réponse oriente vers l'alternative à lui proposer.",
        "Choisissez ensemble un jeu en monde ouvert adapté à son âge, en lisant les fiches à deux. Il ne vit plus votre décision comme une simple privation.",
        "Si vous jouez vous-même à GTA, dites-le-lui et expliquez pourquoi vous attendez pour lui. L'incohérence perçue est l'argument qu'il vous opposera en premier.",
        "Fixez dès maintenant la date à laquelle vous en reparlerez, et tenez-la.",
      ],
    },
  },
  {
    key: "brawl-stars",
    name: "Brawl Stars",
    catalogueId: "8fe148bb-81ca-4a12-a57c-b40713c5a872",
    tagline: "Des parties de trois minutes, des récompenses au hasard : les deux sujets à régler avec votre enfant.",
    whatItIs:
      "Un jeu d'affrontement en équipe sur téléphone et tablette, édité par Supercell. Des parties très courtes, un style de dessin animé et une collection de personnages, les « brawlers », à débloquer. Le jeu est gratuit à installer et se finance par une monnaie payante et un passe de saison.",
    whatHappens: [
      "Une partie oppose le plus souvent deux équipes de trois joueurs et dure quelques minutes.",
      "Les combats sont stylisés, sans sang : un personnage éliminé réapparaît ou quitte la manche.",
      "Une grande partie des récompenses arrive sous forme de tirages au contenu aléatoire, ce qui pousse à jouer « encore une » pour voir ce qui va tomber.",
      "Les joueurs peuvent rejoindre un club, avec son propre fil de discussion écrite.",
      "Une boutique propose personnages, apparences et passes contre de l'argent réel.",
    ],
    whyKidsLove:
      "Les parties sont courtes, nerveuses et lisibles, on progresse vite et on joue avec ses copains d'école. La collection de personnages nourrit les conversations de récréation, et c'est aussi ce qui rend la demande d'achat si insistante.",
    decisions: [
      {
        question: "Combien d'argent, et qui valide ?",
        detail:
          "C'est la décision principale. Fixez le principe avant le montant : rien du tout, le passe de saison de temps en temps, ou une somme d'argent de poche. Puis faites en sorte que chaque achat passe par vous, via les réglages du téléphone plutôt que via une promesse.",
      },
      {
        question: "Comment parler des récompenses au hasard ?",
        detail:
          "Le ressort du tirage aléatoire est celui des jeux de hasard : l'envie de recommencer vient de l'incertitude. Le nommer avec votre enfant, sans dramatiser, l'aide à reconnaître le moment où il joue pour le tirage plutôt que pour la partie.",
      },
      {
        question: "Le club : avec qui ?",
        detail:
          "Un club entre camarades de classe ne pose pas les mêmes questions qu'un club ouvert à des inconnus. Demandez à voir lequel il a rejoint.",
      },
      {
        question: "Comment on s'arrête.",
        detail:
          "Trois minutes par partie, c'est peu, et c'est justement le piège : « une dernière » se répète facilement. Un nombre de parties ou un créneau fixe tient mieux qu'un temps qui s'étire.",
      },
    ],
    advanced: [
      "Supercell a retiré ses anciens coffres en 2022 avant d'introduire de nouveaux tirages, les Starr Drops : le mécanisme aléatoire a changé de forme sans disparaître.",
      "Depuis octobre 2026, PEGI relève progressivement à 16 la classification des jeux numériques qui vendent des objets aléatoires payants. La classification affichée par la boutique au moment de l'installation est la plus à jour : regardez-la plutôt qu'un souvenir.",
      "Le même éditeur publie Clash Royale et Clash of Clans, avec un compte commun (Supercell ID). Les conseils de ce guide s'y appliquent presque tels quels.",
    ],
    stateOfPlay: {
      // Date des recherches en ligne (21 nov. 2026), PAS une relecture humaine :
      // chaque fait ci-dessous attend sa vérification avant GAME_GUIDES_PUBLIC.
      verifiedOn: "2026-11-21",
      facts: [
        "Le jeu ne propose pas de compte parent intégré : pour les achats et le temps d'écran, Supercell renvoie aux réglages de l'appareil.",
        "Supercell conseille de créer le compte Supercell ID de l'enfant avec une adresse e-mail que vous gérez. Vous pouvez alors suivre l'activité du compte et sa liste d'amis.",
        "Sur iPhone et iPad, l'option « Demander l'autorisation d'achat » du partage familial fait passer chaque achat de l'enfant par une demande que vous acceptez ou refusez.",
        "Sur Android, Family Link permet d'exiger votre approbation pour les achats intégrés aux applications.",
      ],
      doesNotDo: [
        "Bloquer les achats ne supprime pas les tirages aléatoires gagnés en jouant : le ressort reste, seule la dépense est coupée.",
        "Sur Android, l'approbation ne couvre que les achats payés via Google Play, pas un autre moyen de paiement.",
        "Les réglages du téléphone ne modèrent pas la discussion du club.",
        "Si votre enfant se connecte à son compte sur un autre appareil, celui d'un aîné par exemple, les réglages du vôtre ne le suivent pas.",
      ],
      officialLinks: [
        {
          label: "Guide pour les parents (Supercell)",
          url: "https://supercell.com/en/parents/fr",
          source: "Supercell",
        },
        {
          label: "Approuver les achats de vos enfants avec « Demander l'autorisation d'achat »",
          url: "https://support.apple.com/fr-fr/105055",
          source: "Apple",
        },
        {
          label: "Approbation des achats sur Google Play (Family Link)",
          url: "https://support.google.com/families/answer/7039872?hl=fr",
          source: "Google",
        },
        {
          label: "PEGI met à jour la classification des jeux contenant des objets aléatoires payants",
          url: "https://pegi.info/news/pegi-updates-age-ratings-existing-games-paid-random-items",
          source: "PEGI",
        },
      ],
    },
    playTogether: {
      intro:
        "Les parties sont si courtes qu'un parent peut s'y essayer entre deux tâches, et c'est la meilleure façon de comprendre ce que votre enfant y vit.",
      ideas: [
        "Faites une partie en équipe avec lui, sur deux appareils ou en vous passant le téléphone. Vous verrez vite où sont la pression et le plaisir.",
        "Ouvrez un tirage à ses côtés et demandez-lui ce qu'il espérait. La conversation sur le hasard vient toute seule.",
        "Regardez la boutique ensemble avant de décider d'un achat : ce qui coûte quoi, ce qui disparaît bientôt, et pourquoi c'est présenté ainsi.",
        "Demandez-lui de vous expliquer ses brawlers préférés. Un enfant qui explique un jeu prend aussi un peu de recul sur lui.",
      ],
    },
  },
  {
    key: "ea-sports-fc",
    name: "EA Sports FC (ex-FIFA)",
    // Current edition. The seed pins FC 26 for the pillar page; the guide
    // speaks about the series and shows the edition on sale now.
    catalogueId: "1dc26c31-2f13-40a9-89a0-00b5d90c1cd8",
    tagline: "Un jeu de foot sans histoire, et un mode, Ultimate Team, qui mérite toute votre attention.",
    whatItIs:
      "La simulation de football d'Electronic Arts, longtemps vendue sous le nom FIFA. Une nouvelle édition sort chaque automne. Le jeu de football lui-même ne pose guère de questions. Le point de vigilance tient presque entièrement dans un mode, Ultimate Team, où l'on construit son équipe à partir de pochettes de joueurs au contenu tiré au hasard.",
    whatHappens: [
      "En match rapide, en carrière ou à plusieurs sur le même canapé, on joue au football, sans rien acheter.",
      "En Ultimate Team, l'enfant compose une équipe de rêve en ouvrant des pochettes dont il ne connaît pas le contenu à l'avance.",
      "Ces pochettes se gagnent en jouant ou s'achètent avec des FC Points, une monnaie vendue en argent réel.",
      "Les matchs en ligne opposent l'enfant à d'autres joueurs, et les événements à durée limitée invitent à se connecter souvent.",
    ],
    whyKidsLove:
      "C'est le football qu'ils aiment, avec les vrais clubs et les vrais joueurs. Ouvrir une pochette et y trouver une star procure une vraie montée d'émotion, que les copains commentent ensuite. C'est ce moment-là qu'il faut comprendre avant de parler d'argent.",
    decisions: [
      {
        question: "Ultimate Team, oui ou non ?",
        detail:
          "Vous pouvez autoriser le jeu sans ce mode, ou l'autoriser sans achats. Les deux options sont défendables. Laisser Ultimate Team ouvert avec un moyen de paiement enregistré est la seule configuration qui pose vraiment problème.",
      },
      {
        question: "Quelle règle pour l'argent ?",
        detail:
          "Les FC Points se dépensent en petits montants qui se cumulent vite. Décidez d'un principe clair, par exemple pas d'achat ou un montant fixe par saison, et faites-le respecter par les réglages plutôt que par la surveillance.",
      },
      {
        question: "Comment parler des pochettes ?",
        detail:
          "Une pochette est un tirage au sort payant. Expliquer cela à un enfant qui aime le foot ne le prive de rien : cela l'aide à voir la différence entre jouer et tirer.",
      },
    ],
    advanced: [
      "Le changement de nom en 2023 est une affaire de licence : EA a perdu le nom FIFA, pas le jeu. Les mécaniques d'Ultimate Team ont traversé le changement sans rupture.",
      "Les nouvelles règles PEGI de 2026 font des objets aléatoires payants un critère de classification. Deux éditions qui se ressemblent beaucoup peuvent donc afficher des classifications très différentes : fiez-vous à celle de l'édition que vous achetez.",
      "Les modes hors ligne à deux sur la même console restent l'usage le plus simple et le moins coûteux du jeu, et un bon terrain commun entre parent et enfant.",
    ],
    stateOfPlay: {
      // Date des recherches en ligne (21 nov. 2026), PAS une relecture humaine :
      // chaque fait ci-dessous attend sa vérification avant GAME_GUIDES_PUBLIC.
      verifiedOn: "2026-11-21",
      facts: [
        "EA Sports FC 27 est classé PEGI 16 à cause des pochettes payantes d'Ultimate Team. Les éditions précédentes étaient classées PEGI 3.",
        "Un compte EA d'adolescent a une limite de dépenses fixée à zéro par défaut. Seul un parent qui l'ajoute à son compte famille EA peut la modifier.",
        "L'outil FC Playtime, dans le jeu, montre le temps passé, les pochettes ouvertes et les FC Points achetés, et permet de se fixer des limites.",
        "Sur console, les plafonds de dépenses et l'accord parental avant achat de PlayStation et de Xbox s'appliquent aussi aux FC Points.",
      ],
      doesNotDo: [
        "Couper les achats ne retire pas les pochettes gagnées en jouant : le tirage au sort reste au cœur d'Ultimate Team.",
        "La nouvelle classification ne modifie pas le jeu : les pochettes payantes restent présentes dans les éditions classées plus bas.",
        "Les réglages de la console et ceux du compte EA sont indépendants. En régler un ne règle pas l'autre.",
      ],
      officialLinks: [
        {
          label: "Contrôle parental et compte famille EA",
          url: "https://help.ea.com/fr/help/ea/ea-app/player-controls-ea/",
          source: "Electronic Arts",
        },
        {
          label: "PEGI met à jour la classification des jeux contenant des objets aléatoires payants",
          url: "https://pegi.info/news/pegi-updates-age-ratings-existing-games-paid-random-items",
          source: "PEGI",
        },
        {
          label: "Contrôle parental et limites de dépenses sur PlayStation",
          url: "https://www.playstation.com/fr-fr/support/account/ps5-parental-controls-spending-limits/",
          source: "Sony Interactive Entertainment",
        },
        {
          label: "Jouer en famille sur Xbox (paramètres familiaux)",
          url: "https://www.xbox.com/fr-FR/family-hub",
          source: "Microsoft",
        },
      ],
    },
    playTogether: {
      intro:
        "C'est l'un des jeux les plus faciles à partager en famille : tout le monde connaît les règles du football, et un match en local ne coûte rien.",
      ideas: [
        "Jouez un match l'un contre l'autre, ou dans la même équipe contre l'ordinateur si l'écart de niveau est trop grand.",
        "Lancez une carrière ensemble avec votre club préféré : on y prend des décisions de long terme sans aucune pochette.",
        "Si Ultimate Team est autorisé, ouvrez une pochette gagnée en jouant avec lui et parlez de ce qu'il ressent quand le contenu déçoit.",
        "Regardez un vrai match, puis rejouez-le à la console. Le jeu devient un prolongement du sport plutôt qu'une fin en soi.",
      ],
    },
  },
  {
    key: "call-of-duty",
    name: "Call of Duty",
    // Warzone: free to play, so it is the episode younger players actually
    // reach first. The guide speaks about the series.
    catalogueId: "ce8a57ba-a920-4ff4-8adc-add3086c6d7c",
    tagline: "Un jeu de guerre pour adultes, et une version gratuite qui le met à portée de tous.",
    whatItIs:
      "Une série de jeux de tir militaires d'Activision, avec un nouvel épisode presque chaque année et un mode bataille royale gratuit, Warzone. Les épisodes se ressemblent de loin mais ne sont pas tous classés de la même façon. Comme pour GTA, la demande arrive souvent bien avant l'âge prévu, parce que les grands frères et les copains y jouent.",
    whatHappens: [
      "La campagne solo raconte une guerre à la manière d'un film d'action, avec une violence armée réaliste.",
      "Le multijoueur oppose des équipes de joueurs en ligne, dans des parties courtes qui s'enchaînent.",
      "Warzone, gratuit, réunit un grand nombre de joueurs sur une même carte jusqu'à la dernière équipe en vie.",
      "Le chat vocal met l'enfant en contact avec des inconnus, souvent adultes, dont le langage n'est pas filtré à la source.",
      "Une boutique vend apparences, armes cosmétiques et passe de combat contre une monnaie payante.",
    ],
    whyKidsLove:
      "C'est le jeu des grands : y jouer, c'est être admis dans le groupe. Les parties rapides, la progression permanente et le jeu en équipe avec les copains font le reste. La gratuité de Warzone retire en plus l'obstacle du prix d'achat, qui servait autrefois de garde-fou naturel.",
    decisions: [
      {
        question: "Quel épisode, exactement ?",
        detail:
          "Les parents confondent souvent les opus. Avant de répondre, regardez la classification de celui que votre enfant demande : c'est elle que le filtre de la console appliquera.",
      },
      {
        question: "Le chat vocal, c'est le vrai sujet.",
        detail:
          "Le contenu du jeu est une chose, les propos tenus en ligne en sont une autre. Un adolescent qui joue avec ses amis et coupe le chat avec les inconnus ne vit pas du tout le même jeu que celui qui joue seul, casque sur les oreilles, avec des adultes qu'il ne connaît pas.",
      },
      {
        question: "Non, pas encore : comment le dire ?",
        detail:
          "Comme pour tout jeu réservé aux adultes, expliquez la raison plutôt que d'invoquer l'interdit, reconnaissez la pression du groupe et fixez une date pour en reparler. Proposer un jeu d'équipe en ligne classé pour son âge rend le « non » plus facile à accepter.",
      },
    ],
    advanced: [
      "Chaque nouvel épisode s'intègre à Warzone : le jeu gratuit fait vivre la boutique des épisodes payants, et inversement.",
      "Le passe de combat récompense la régularité. La pression à se connecter souvent compte plus, en pratique, que la pression à payer.",
      "Si vous jouez à des jeux de tir, notez que le multijoueur de Call of Duty est bien plus rapide et punitif que la plupart des autres : un débutant y passe beaucoup de temps à mourir, ce qui pèse sur l'humeur de fin de partie.",
    ],
    stateOfPlay: {
      // Date des recherches en ligne (21 nov. 2026), PAS une relecture humaine :
      // chaque fait ci-dessous attend sa vérification avant GAME_GUIDES_PUBLIC.
      verifiedOn: "2026-11-21",
      facts: [
        "Les épisodes récents, dont Black Ops 7, sont classés PEGI 18.",
        "Warzone se télécharge et se joue gratuitement. Un numéro de téléphone lié au compte Activision peut être demandé pour jouer.",
        "Activision enregistre et analyse le chat vocal pour repérer les comportements toxiques, dont le harcèlement. Le français fait partie des langues analysées depuis Black Ops 6.",
        "Sur PlayStation et Xbox, vous pouvez limiter les jeux selon leur classification d'âge, choisir avec qui l'enfant peut communiquer et plafonner ou valider ses achats.",
      ],
      doesNotDo: [
        "L'analyse du chat vocal sanctionne après coup. Elle n'empêche pas votre enfant d'entendre une insulte au moment où elle est prononcée.",
        "Couper le chat dans le jeu n'empêche pas un groupe d'amis de se parler en parallèle sur une autre application vocale.",
        "Le filtre par âge de la console ne joue que si le compte de l'enfant est un compte enfant. Sur un compte adulte, il ne s'applique pas.",
        "La gratuité de Warzone ne dit rien de son contenu : un jeu gratuit passe aussi par le filtre de classification, encore faut-il qu'il soit activé.",
      ],
      officialLinks: [
        {
          label: "Modération du chat vocal dans Call of Duty",
          url: "https://support.activision.com/fr/articles/call-of-duty-voice-chat-moderation",
          source: "Activision",
        },
        {
          label: "Contrôle parental et limites de dépenses sur PlayStation",
          url: "https://www.playstation.com/fr-fr/support/account/ps5-parental-controls-spending-limits/",
          source: "Sony Interactive Entertainment",
        },
        {
          label: "Jouer en famille sur Xbox (paramètres familiaux)",
          url: "https://www.xbox.com/fr-FR/family-hub",
          source: "Microsoft",
        },
        {
          label: "Rechercher la classification sur le site PEGI",
          url: "https://pegi.info/fr",
          source: "PEGI",
        },
      ],
    },
    playTogether: {
      intro:
        "Si votre adolescent a l'âge du jeu, ou si vous avez décidé de l'autoriser, une partie à deux vaut mieux qu'un long débat sur la violence des jeux vidéo.",
      ideas: [
        "Jouez quelques parties dans la même équipe. Vous entendrez vous-même le ton du chat vocal, ce qui rend la discussion sur les réglages beaucoup plus concrète.",
        "Demandez-lui de vous montrer ses réglages audio : avec qui il parle, qui il a coupé, comment on signale un joueur.",
        "Si c'est encore non, cherchez ensemble un jeu d'équipe en ligne classé pour son âge, en lisant les fiches à deux.",
        "Mettez-vous d'accord sur une fin de session en nombre de parties, une partie interrompue pénalisant toute l'équipe.",
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
