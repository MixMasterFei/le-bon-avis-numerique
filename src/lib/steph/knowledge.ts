/**
 * Le contenu éditorial de l'espace /steph : la présentation du projet et la
 * carte mentale.
 *
 * Un seul fichier pour les deux surfaces, volontairement : la carte est le
 * plan, la présentation est le récit, et les deux doivent raconter la même
 * chose. Tout ce qui est écrit ici est repris des documents de référence du
 * dépôt (docs/marketing/brand-brief.md, docs/roadmap/growth-plan-2026-Q3.md,
 * src/app/notre-methode/notre-methode.data.ts) — pas d'invention.
 *
 * Les chiffres qui bougent (taille du catalogue, comptes, brèves) ne sont PAS
 * écrits en dur : ils sont marqués `{ live: "..." }` et remplis à l'affichage
 * depuis la base. Un document de présentation qui ment sur ses chiffres au
 * bout de trois mois ne sert plus à rien.
 */

// ── Chiffres vivants ──────────────────────────────────────────────────

export type LiveKey =
  | "catalogueTotal"
  | "movies"
  | "series"
  | "games"
  | "analysed"
  | "accounts"
  | "members"
  | "newsTotal"

export type LiveValues = Record<LiveKey, number>

/** Une valeur figée (texte) ou un chiffre lu dans la base au chargement. */
export type StatValue = string | { live: LiveKey; suffix?: string }

// ── Présentation ──────────────────────────────────────────────────────

export type DeckBlock =
  | { kind: "text"; body: string[] }
  | { kind: "points"; title?: string; items: Array<{ label: string; desc: string }> }
  | { kind: "quote"; text: string; source?: string }
  | { kind: "stats"; items: Array<{ value: StatValue; label: string; note?: string }> }
  | { kind: "versus"; title: string; leftTitle: string; rightTitle: string; rows: Array<[string, string]> }
  | { kind: "steps"; items: Array<{ title: string; desc: string }> }
  | { kind: "callout"; tone: "info" | "warn" | "good"; title: string; body: string }
  | { kind: "links"; items: Array<{ label: string; href: string; desc: string }> }
  | { kind: "glossary"; items: Array<{ term: string; desc: string }> }

export interface DeckChapter {
  id: string
  eyebrow: string
  title: string
  lead: string
  blocks: DeckBlock[]
}

export const DECK: DeckChapter[] = [
  // ── 1 ──────────────────────────────────────────────────────────────
  {
    id: "cest-quoi",
    eyebrow: "Chapitre 1",
    title: "C'est quoi, Totem Avisé",
    lead: "Un site qui répond à une question que se posent tous les parents, tous les soirs : « est-ce que c'est pour mon enfant ? »",
    blocks: [
      {
        kind: "text",
        body: [
          "Totem Avisé est un guide familial français. On y cherche un film, une série ou un jeu vidéo, et on obtient un âge conseillé — pas une interdiction légale, un conseil — accompagné de son explication : ce qu'il y a dedans, ce qui peut marquer un enfant, pourquoi cet âge-là plutôt qu'un autre.",
          "Le site est gratuit, sans publicité, sans lien d'affiliation, et n'accepte rien des studios. C'est un choix de fond : le jour où l'on gagne de l'argent sur une recommandation, la recommandation ne vaut plus rien.",
          "Il est construit et tenu par une seule personne, Xavier, aidée d'une machine encadrée. Ce n'est pas une rédaction : c'est une méthode appliquée à l'identique à tout le catalogue, publiée, et corrigée par les familles qui votent.",
        ],
      },
      {
        kind: "quote",
        text: "Totem Avisé est le guide familial qui répond avant tout le monde, pour votre enfant en particulier. Films, séries et jeux — un âge conseillé argumenté dès l'annonce du titre, des critères publiés et vérifiables, affinés par les votes des familles, et des recommandations qui connaissent les sensibilités de vos enfants. Indépendant, sans publicité, gratuit.",
        source: "Phrase de positionnement officielle — à utiliser telle quelle en presse et en publicité",
      },
      {
        kind: "stats",
        items: [
          { value: { live: "catalogueTotal" }, label: "titres au catalogue", note: "films, séries, jeux et mangas" },
          { value: { live: "analysed" }, label: "titres analysés à fond", note: "les 8 dimensions de contenu sont remplies" },
          { value: "3", label: "familles de médias couvertes", note: "films, séries, jeux vidéo — personne d'autre ne fait les trois en France" },
          { value: "0 €", label: "coût pour les familles", note: "et zéro publicité" },
        ],
      },
      {
        kind: "points",
        title: "Le nom",
        items: [
          {
            label: "Totem",
            desc: "L'emblème protecteur autour duquel la tribu — la famille — se rassemble. Un repère stable, qui se transmet.",
          },
          {
            label: "Avisé",
            desc: "Informé, prudent, de bon conseil. Le nom dit exactement le produit : un repère de confiance pour la tribu.",
          },
          {
            label: "Une maison, pas un produit isolé",
            desc: "« Totem » est pensée comme une marque ombrelle. Totem Avisé en est le premier produit ; d'autres sont en exploration (Totem Quest, missions familiales). Le seul communiqué publiquement aujourd'hui reste Totem Avisé.",
          },
        ],
      },
    ],
  },

  // ── 2 ──────────────────────────────────────────────────────────────
  {
    id: "le-probleme",
    eyebrow: "Chapitre 2",
    title: "Le problème qu'on résout",
    lead: "« Tous publics » ne veut rien dire pour un parent. C'est de là que tout part.",
    blocks: [
      {
        kind: "text",
        body: [
          "En France, la classification officielle répond à une question légale : a-t-on le droit de montrer ce film ? Elle ne répond jamais à la question que se posent les parents : est-ce une bonne idée, ce soir, pour cet enfant-là ? Résultat : la même mention « Tous publics » couvre un dessin animé et la plupart des drames pour adultes.",
          "Face à ce vide, les parents avaient trois options, toutes insuffisantes. Le site américain de référence, en anglais et avec des repères culturels américains. Le site français historique, remarquable mais tenu à la main par un bénévole : films seulement, pas de jeux vidéo, et rien sur les nouveautés tant qu'il n'a pas pu les voir. Et les moteurs de recherche, qui donnent une moyenne — une moyenne qui ne connaît pas votre enfant.",
          "Pendant ce temps, les enfants réclament Fortnite, Roblox, la série dont toute la cour de récré parle, le film qui sort mercredi.",
        ],
      },
      {
        kind: "callout",
        tone: "info",
        title: "L'histoire fondatrice, en une ligne",
        body: "Totem Avisé est né d'un parent qui ne trouvait pas de réponse. Il a construit celle qu'il aurait voulu trouver.",
      },
      {
        kind: "text",
        body: [
          "Il existe une publicité de référence pour raconter tout ça, écrite et jamais tournée — elle s'appelle « La Surprise ». Une mère installe sa fille de 7 ans devant un film marqué « dès 8 ans », puis part dîner en amoureux. Bande-son qui monte, explosions, et l'enfant en larmes qui débarque entre les deux bougies.",
          "Le twist est exactement le positionnement du site : le film ÉTAIT « dès 8 ans », et c'était vrai — en moyenne. Le drame vient de ce que cette enfant-là est sensible aux explosions. La classification n'a pas menti : elle ne connaissait pas cette enfant.",
        ],
      },
      {
        kind: "quote",
        text: "Un âge moyen ne connaît pas votre enfant.",
        source: "La phrase qui résume le produit — et la réponse aux réponses automatiques des moteurs de recherche",
      },
    ],
  },

  // ── 3 ──────────────────────────────────────────────────────────────
  {
    id: "promesse",
    eyebrow: "Chapitre 3",
    title: "La promesse, les valeurs, le ton",
    lead: "Ce qu'on garantit aux familles, dans l'ordre de priorité. Et la façon de leur parler.",
    blocks: [
      {
        kind: "points",
        title: "Les quatre valeurs, par ordre de priorité",
        items: [
          {
            label: "1. Indépendance",
            desc: "Ni publicité, ni affiliation, ni influence des studios. C'est la condition de la confiance, et elle n'est pas négociable. C'est aussi, à terme, ce qui donne sa valeur commerciale à nos données.",
          },
          {
            label: "2. Honnêteté radicale",
            desc: "On dit ce qu'on sait, comment on le sait, et ce qu'on ne sait pas encore. Les fiches non confirmées le disent en toutes lettres (« à confirmer »). La méthode est publique : verdict ET raisonnement, jamais de boîte noire.",
          },
          {
            label: "3. Chaque enfant est différent",
            desc: "Un âge conseillé est une moyenne. Le produit existe pour aller au-delà : sensibilités, goûts et réactions de VOS enfants.",
          },
          {
            label: "4. Des repères, pas des verdicts",
            desc: "Totem éclaire la décision des parents, il ne la remplace jamais. Ni moralisateur, ni anxiogène, ni anti-écrans.",
          },
        ],
      },
      {
        kind: "versus",
        title: "Le ton de voix",
        leftTitle: "Totem Avisé est",
        rightTitle: "Totem Avisé n'est pas",
        rows: [
          ["Chaleureux, complice, concret", "Moralisateur, culpabilisant"],
          ["Précis, factuel, sourcé", "Alarmiste, anxiogène"],
          ["Honnête sur ses limites (« à confirmer »)", "Péremptoire, boîte noire"],
          ["Légèrement malicieux (l'humour des parents entre eux)", "Ironique envers les enfants ou les parents"],
          ["Pro-familles, pragmatique sur les écrans", "Anti-écrans, nostalgique"],
        ],
      },
      {
        kind: "points",
        title: "Les mots de la marque",
        items: [
          {
            label: "À utiliser",
            desc: "repères · âge conseillé · pour votre enfant en particulier · éviter les surprises · en toute indépendance · « Pourquoi cet âge ? » · votre compagnon de choix.",
          },
          {
            label: "À bannir",
            desc: "interdit / autorisé (registre légal — nous ne sommes pas la loi) · danger / toxique (registre panique) · « l'IA a décidé » (la machine propose avec ses garde-fous, les familles affinent, les parents décident) · tout superlatif invérifiable.",
          },
          {
            label: "Registre",
            desc: "Vouvoiement, phrases courtes, français impeccable. L'humour vise la situation des parents (la soirée qui déraille), jamais un enfant ou un parent.",
          },
        ],
      },
      {
        kind: "callout",
        tone: "warn",
        title: "La règle d'or des revendications",
        body: "On ne revendique que le vérifiable. « Numéro 1 en France » est interdit tant qu'aucune mesure indépendante ne le soutient — c'est un risque juridique (publicité trompeuse) et un risque de crédibilité : le site français historique a aujourd'hui plus d'audience que nous. Les équivalents autorisés sont tout aussi forts : « le seul guide qui couvre films, séries et jeux vidéo », « le catalogue familial le plus large de France », « le seul à vous répondre avant la sortie ».",
      },
    ],
  },

  // ── 4 ──────────────────────────────────────────────────────────────
  {
    id: "catalogue",
    eyebrow: "Chapitre 4",
    title: "Ce qu'il y a dans le catalogue",
    lead: "Quatre types de contenus, rangés par tranches d'âge, chacun avec sa fiche.",
    blocks: [
      {
        kind: "stats",
        items: [
          { value: { live: "movies" }, label: "films" },
          { value: { live: "series" }, label: "séries" },
          { value: { live: "games" }, label: "jeux vidéo" },
          { value: { live: "newsTotal" }, label: "brèves d'actualité en réserve", },
        ],
      },
      {
        kind: "points",
        title: "Les rayons du site",
        items: [
          { label: "Films — /films", desc: "Le rayon historique. Inclut « En ce moment au cinéma », alimenté en direct par les sorties en salle en France." },
          { label: "Séries — /series", desc: "Séries TV et plateformes, avec les mêmes repères que les films." },
          { label: "Jeux vidéo — /jeux", desc: "Notre vrai terrain de différenciation : aucun guide familial français ne couvre les jeux sérieusement. Comprend « Guides parents » pour les gros titres (contrôles parentaux, chat, achats intégrés) et la verticale « [jeu] quel âge »." },
          { label: "Mangas — /mangas", desc: "Ouverture récente, encore réservée à l'équipe le temps de fiabiliser les données. Les livres et les applications, eux, ont été abandonnés : certains vieux documents marketing les mentionnent encore à tort." },
          { label: "Actualités — pas encore publiques", desc: "Les brèves famille sont produites quatre fois par jour et stockées avec leurs sources, plus un dossier de fond deux fois par semaine. Mais la page publique /actualites n'est pas encore ouverte : le flux n'est visible que dans le Coin Famille (privé) et sur les aperçus réservés à l'équipe. C'est du contenu déjà payé qui ne travaille pas encore." },
          { label: "Blog — /blog", desc: "Articles de fond sur le temps d'écran et la parentalité numérique. Géré depuis Sanity, un outil d'édition séparé du code." },
          { label: "Collections & guides", desc: "Sélections thématiques éditorialisées (par âge, par occasion, par thème)." },
        ],
      },
      {
        kind: "points",
        title: "Les six tranches d'âge (les couleurs du site)",
        items: [
          { label: "2–4 ans · Tout-petits", desc: "Aucune violence, aucun gros mot, rien de sexuel. La tranche la plus pauvre du catalogue — une tâche automatique va chercher des séries jeunesse chaque jour pour l'étoffer." },
          { label: "5–7 ans · Enfants", desc: "Tolère un soupçon de tension et de langage." },
          { label: "8–10 ans · Grands enfants", desc: "Aventure, tension modérée." },
          { label: "11–12 ans · Pré-ados", desc: "Sujets plus complexes, tension plus marquée." },
          { label: "13–15 ans · Ados", desc: "Le champ s'ouvre largement." },
          { label: "16 ans et + · Jeunes adultes", desc: "Sans plafond de contenu." },
        ],
      },
      {
        kind: "callout",
        tone: "info",
        title: "Deux états pour une fiche — c'est important à comprendre",
        body: "Une fiche entre d'abord avec un âge ESTIMÉ, calculé à partir de la classification officielle et du genre : elle est visible tout de suite, badgée « Âge provisoire · à confirmer ». Elle passe ensuite par l'analyse approfondie et devient une fiche complète, avec ses 8 dimensions et son « Pourquoi cet âge ? ». Deux règles à connaître : l'analyse attend au moins 7 jours après la sortie réelle du titre (avant, il n'existe aucune matière fiable — la machine inventerait), et il n'y a aucun bouton « publier » sur ce site : c'est le score de complétude qui décide automatiquement qu'une fiche est prête. Les fiches provisoires n'apparaissent que dans la recherche, les nouveautés et le cinéma — jamais en page d'accueil ni dans les recommandations personnalisées.",
      },
    ],
  },

  // ── 5 ──────────────────────────────────────────────────────────────
  {
    id: "methode",
    eyebrow: "Chapitre 5",
    title: "Comment on décide d'un âge",
    lead: "C'est le cœur du produit, et le sujet sur lequel il ne faut jamais improviser une explication : la méthode est publiée sur le site.",
    blocks: [
      {
        kind: "steps",
        items: [
          {
            title: "1. On lit ce qui est public",
            desc: "Synopsis, classifications officielles (CNC/CSA pour les films et séries, PEGI pour les jeux), genres, thèmes, données publiques. Aucune œuvre n'est visionnée : ce n'est pas une rédaction de critiques.",
          },
          {
            title: "2. On applique la même grille à tout le monde",
            desc: "Une grille publiée, fondée sur le développement de l'enfant, appliquée à l'identique aux milliers de titres du catalogue. C'est la force de la méthode : une cohérence qu'aucune équipe humaine ne peut tenir. Le principe a fait ses preuves ailleurs — aux Pays-Bas, la classification Kijkwijzer guide les parents depuis plus de 25 ans sur un principe voisin.",
          },
          {
            title: "3. Les garde-fous passent en dernier, et ils ne peuvent que monter l'âge",
            desc: "Des règles fixes, sans intelligence artificielle, s'appliquent après coup et ne savent faire qu'une chose : relever un âge, jamais l'abaisser. Le PEGI d'un jeu est un plancher absolu ; l'horreur ne descend jamais sous 14 ans ; les sujets de guerre ont leur propre plancher ; l'animation bénéficie d'une remise, une bagarre dessinée ne pesant pas comme une scène réaliste. Et pour les films, la classification française est délibérément ignorée dans ce calcul, précisément pour qu'un visa indulgent ne puisse jamais tirer notre conseil vers le bas.",
          },
          {
            title: "4. Les familles corrigent",
            desc: "Sur chaque fiche, deux pouces : j'approuve / je conteste. À partir de 5 votes et 70 % d'accord, un badge de consensus apparaît. Les retours des familles remplacent progressivement l'estimation initiale.",
          },
        ],
      },
      {
        kind: "points",
        title: "Les 8 dimensions de contenu (notées de 0 à 5)",
        items: [
          { label: "Violence", desc: "Une scène d'action stylisée ne pèse pas comme une scène réaliste équivalente." },
          { label: "Sexe et nudité", desc: "Le repère le plus strict par défaut sur les profils enfants." },
          { label: "Langage", desc: "Grossièretés, insultes, vulgarité." },
          { label: "Substances", desc: "Alcool, tabac, drogues — présence et traitement." },
          { label: "Consumérisme", desc: "Placement de produit et, pour les jeux, les achats intégrés (microtransactions). C'est l'un des deux repères mis en avant sur les fiches de jeux." },
          { label: "Messages positifs", desc: "Ce que l'œuvre transmet." },
          { label: "Modèles positifs", desc: "Les personnages auxquels un enfant peut s'identifier." },
          { label: "Valeur éducative", desc: "Un 5/5 déclenche le badge « Éducatif »." },
        ],
      },
      {
        kind: "points",
        title: "Ce qui est visible sur une fiche, et à quoi ça sert",
        items: [
          { label: "« Pourquoi cet âge ? »", desc: "Le bloc qui détaille en clair les éléments qui pèsent dans la recommandation. C'est notre actif de marque le plus précieux : c'est ce qui nous distingue d'une boîte noire, et ce que les moteurs de recherche citent." },
          { label: "« Ce que les parents doivent savoir »", desc: "3 à 5 points d'attention extraits du contenu analysé." },
          { label: "« Ce qui peut marquer »", desc: "Les points de vigilance précis (mort d'un animal, harcèlement, séparation des parents, scène effrayante…), issus d'une liste fermée. Replié par défaut, parce que les nommer divulgâche l'histoire — c'est au parent d'ouvrir." },
          { label: "Le badge « à confirmer »", desc: "Dit honnêtement qu'une fiche n'est pas encore passée par l'analyse complète. Le montrer est un choix : mieux vaut une estimation annoncée qu'un silence." },
        ],
      },
      {
        kind: "callout",
        tone: "warn",
        title: "Comment en parler sans se tromper",
        body: "Ne dites jamais « l'IA a décidé de l'âge ». La formulation juste, celle de la marque : une analyse automatisée propose une première estimation selon des critères publiés, des garde-fous stricts l'empêchent de sous-estimer un contenu sensible, et les votes des familles l'affinent. Les parents décident.",
      },
    ],
  },

  // ── 6 ──────────────────────────────────────────────────────────────
  {
    id: "audience",
    eyebrow: "Chapitre 6",
    title: "Pour qui on travaille",
    lead: "Un cœur de cible très net, et deux moments de vérité complètement différents.",
    blocks: [
      {
        kind: "text",
        body: [
          "Le cœur de cible est le parent décideur du foyer, 30 à 45 ans, avec des enfants de 3 à 15 ans. C'est la personne qui organise la soirée et qui vérifie avant.",
        ],
      },
      {
        kind: "points",
        title: "Les deux moments de vérité",
        items: [
          {
            label: "Le moment Google — « [titre] à partir de quel âge »",
            desc: "Le parent a une question précise et veut une réponse immédiate, nette, argumentée. C'est notre porte d'entrée : environ 92 % de notre trafic de recherche est sur cette intention. Il n'a pas de compte, il ne veut pas en créer, et il repartira dans 30 secondes.",
          },
          {
            label: "Le moment canapé — « on regarde quoi ce soir ? »",
            desc: "Le parent n'a pas de titre en tête et veut une suggestion qui connaisse sa famille. C'est LA raison de créer un compte, et c'est là que se joue la valeur à long terme du site.",
          },
        ],
      },
      {
        kind: "points",
        title: "Trois personas de travail",
        items: [
          { label: "La mère organisatrice", desc: "Planifie la soirée, vérifie avant, déteste la mauvaise surprise. Sensible à « éviter les pleurs et les cauchemars »." },
          { label: "Le père joueur", desc: "À l'aise avec les jeux, mais dépassé par Roblox et Fortnite côté chat, achats intégrés et inconnus en ligne. Sensible au sérieux du PEGI complété d'un regard de parent." },
          { label: "Les grands-parents / la baby-sitter", desc: "Prescripteurs occasionnels. Besoin d'une réponse simple et sûre, sans créer de compte." },
        ],
      },
      {
        kind: "callout",
        tone: "info",
        title: "Les cibles secondaires, à garder en tête",
        body: "Médiathèques, enseignants (réseau CLEMI), comités d'entreprise. Conséquence concrète pour tout ce qu'on produit : la marque doit rester crédible sur une borne de médiathèque comme dans une story Instagram.",
      },
    ],
  },

  // ── 7 ──────────────────────────────────────────────────────────────
  {
    id: "compte-famille",
    eyebrow: "Chapitre 7",
    title: "Le compte famille, et pourquoi il change tout",
    lead: "C'est la seule chose qu'aucune réponse automatique de moteur de recherche ne pourra jamais copier.",
    blocks: [
      {
        kind: "text",
        body: [
          "Un parent inscrit peut créer jusqu'à 10 profils, un par enfant. Chaque profil porte son année de naissance, ses genres préférés et détestés, ses sensibilités sur cinq axes (violence, peur, sexuel, langage, substances), ce qu'il aime voir mis en avant (messages positifs, modèles, valeur éducative), les sujets à éviter et ses centres d'intérêt.",
          "À partir de là, chaque fiche donne un verdict par enfant. C'est notre différenciateur le plus fort : « dès 8 ans » devient « Très adapté pour Léa, À vérifier pour Tom ». Un score de 0 à 100 tourne bien en coulisses, mais on ne le montre jamais tel quel : un parent n'a pas besoin d'un pourcentage, il a besoin d'une phrase. Les quatre verdicts affichés sont « Très adapté », « Bon choix », « À vérifier » et « Trop tôt ».",
        ],
      },
      {
        kind: "steps",
        items: [
          { title: "Marche 1 — créer un compte", desc: "Par Google ou par e-mail. En soi, ça ne sert encore à rien." },
          { title: "Marche 2 — créer un profil par enfant", desc: "Prénom, année de naissance, avatar. C'est là que le site commence à servir à quelque chose." },
          { title: "Marche 3 — le quiz de préférences", desc: "Un questionnaire en deux temps : un tour rapide de 7 étapes (environ 3 minutes : genres aimés, genres à éviter, quatre sensibilités) puis un approfondissement facultatif de 6 étapes (5 minutes : substances, contenus positifs, sujets à éviter, centres d'intérêt, style de jeu, titres repères). C'est ce qui fait passer le score de « correct » à « juste »." },
          { title: "Marche 4 — les réactions", desc: "Après chaque visionnage, le parent note ce que l'enfant en a pensé (adoré, a eu peur, s'est ennuyé…). Le site apprend, et les recommandations s'affinent toutes seules." },
        ],
      },
      {
        kind: "points",
        title: "Comment le score de compatibilité est calculé",
        items: [
          { label: "D'abord les interdits", desc: "Un genre détesté ou un sujet à éviter fait tomber le score au plancher, quoi qu'il arrive ensuite. Ce sont des barrières, pas des malus." },
          { label: "Ensuite la pondération", desc: "L'âge pèse le plus lourd (28 %), puis les sensibilités (22 %), puis à parts plus petites les genres, les centres d'intérêt, les affinités, le ton, les contenus positifs, les sujets à éviter, et l'apprentissage issu des réactions passées." },
          { label: "Un malus pour les mineurs", desc: "Un contenu adulte est pénalisé pour un profil mineur, en plus de tout le reste." },
        ],
      },
      {
        kind: "callout",
        tone: "good",
        title: "Le chiffre à retenir sur l'escalier",
        body: "Chaque marche perd du monde, et la première est la plus coûteuse. C'est pour ça que la priorité numéro un du plan de croissance est de demander l'inscription au bon endroit — sur la fiche, juste après la réponse sur l'âge — plutôt que dans un bandeau générique.",
      },
    ],
  },

  // ── 8 ──────────────────────────────────────────────────────────────
  {
    id: "tuyaux",
    eyebrow: "Chapitre 8",
    title: "Comment le site se remplit tout seul",
    lead: "Personne ne saisit de fiche à la main. Comprendre ça, c'est comprendre pourquoi une personne seule peut tenir des milliers de titres.",
    blocks: [
      {
        kind: "text",
        body: [
          "Une trentaine de tâches automatiques tournent chaque nuit et chaque semaine. Elles vont chercher les nouveautés, les analysent, calculent les scores, vérifient la cohérence, publient les actualités, et se surveillent les unes les autres.",
          "Le détail complet, avec l'état en direct de chaque tâche, est sur le tableau de bord. Voici les six familles.",
        ],
      },
      {
        kind: "steps",
        items: [
          { title: "Remplir le catalogue", desc: "Chaque nuit, on va chercher les nouveaux films et séries, les nouveaux jeux, et des séries jeunesse pour la tranche 2–4 ans. Une tâche hebdomadaire s'occupe des gros noms du jeu vidéo que les parents recherchent le plus." },
          { title: "Comprendre les œuvres", desc: "L'analyse de contenu, l'analyse approfondie pour les cas délicats, le score de complétude, la relecture des résumés, le plancher d'âge, les plateformes de streaming, les titres proches." },
          { title: "Écrire et vérifier", desc: "Les actualités quatre fois par jour, le dossier de fond deux fois par semaine, la liste des priorités éditoriales le lundi, et le rappel mensuel de relecture des guides parents." },
          { title: "Se rendre visible", desc: "Chaque jeudi, on repère dans Search Console les recherches où l'on est en deuxième page et on retouche les fiches concernées pour les faire passer en première." },
          { title: "Servir les familles", desc: "Les alertes de sortie : prévenir les parents qui ont cliqué « Prévenez-moi » sur un titre à venir." },
          { title: "Surveiller la machine", desc: "Un superviseur quotidien, un battement de cœur hébergé ailleurs qui surveille le superviseur, et un bilan hebdomadaire par e-mail." },
        ],
      },
      {
        kind: "callout",
        tone: "warn",
        title: "La seule chose qu'aucune machine ne fait",
        body: "Les blocs « état du jeu » des guides parents — ce qui décrit les contrôles parentaux, le chat vocal, les achats intégrés d'un jeu — ne sont JAMAIS revérifiés automatiquement. Un rappel mensuel dit seulement « ces blocs ont x mois, ces liens éditeurs ne répondent plus ». La vérification des faits est humaine, délibérément : décrire un contrôle parental qui n'existe plus, c'est tromper un parent.",
      },
      {
        kind: "links",
        items: [
          { label: "Voir l'état des tâches en direct", href: "/steph", desc: "Le tableau de bord, section « Les tuyaux »." },
        ],
      },
    ],
  },

  // ── 9 ──────────────────────────────────────────────────────────────
  {
    id: "acquisition",
    eyebrow: "Chapitre 9",
    title: "Comment les gens nous trouvent",
    lead: "Presque tout le trafic vient de Google, sur une seule intention. C'est une force considérable et une fragilité datée.",
    blocks: [
      {
        kind: "stats",
        items: [
          { value: "92,8 %", label: "des clics viennent d'une recherche « quel âge »", note: "une seule intention porte tout le site" },
          { value: "96 %", label: "des clics atterrissent sur une fiche", note: "presque personne n'entre par la page d'accueil" },
          { value: "24,7 %", label: "des clics pour un seul titre", note: "« L'Odyssée » — le trafic est très concentré" },
          { value: "0", label: "clic sur la marque « Totem Avisé »", note: "en trois mois : personne ne nous cherche par notre nom" },
        ],
      },
      {
        kind: "text",
        body: [
          "Ces chiffres viennent de l'étude de marché de juillet 2026, la plus récente. À la même date, le site faisait environ 440 clics par semaine, après six semaines de croissance forte (71, puis 94, 194, 257, 377, 439).",
        ],
      },
      {
        kind: "points",
        title: "Les canaux, du plus fort au plus faible",
        items: [
          {
            label: "1. Google, sur « [titre] à partir de quel âge »",
            desc: "Notre autoroute. Chaque fiche est une page de réponse à une question précise, et le titre de la page reprend désormais la formulation exacte de la recherche.",
          },
          {
            label: "2. La verticale jeux vidéo",
            desc: "« Fortnite quel âge », « Roblox quel âge » : aucune autorité française n'occupe ces recherches. Une page pilier /jeux/quel-age existe, et une tâche hebdomadaire importe les gros titres manquants.",
          },
          {
            label: "3. Les fiches publiées avant la sortie",
            desc: "Une fiche publiée dès l'annonce d'un film se classe avant sa première. « L'Odyssée » avait déjà fait 475 clics avant sa sortie. C'est notre avantage le plus difficile à copier — et celui qu'une réponse automatique ne peut pas résumer, faute de matière à résumer.",
          },
          {
            label: "4. Les assistants IA",
            desc: "Le chantier le plus abouti du site, et le plus invisible : les robots d'IA sont explicitement autorisés, un fichier llms.txt les oriente, une couche de pages en texte brut leur est réservée, et un petit serveur permet à un assistant d'interroger directement le catalogue. Chaque surface se termine par la même invitation : l'âge conseillé est une moyenne, créez un compte famille gratuit.",
          },
          {
            label: "5. Les actualités et le blog",
            desc: "Beaucoup de contenu produit, presque aucun trafic. Voir l'encadré ci-dessous : c'est la anomalie la plus facile à corriger de tout le site.",
          },
          {
            label: "6. Les réseaux sociaux",
            desc: "Zéro. Aucun compte @totemavise n'existe, sur aucun réseau, et le site ne renvoie vers aucun profil.",
          },
          {
            label: "7. La presse et les partenariats",
            desc: "Rien d'envoyé. Le communiqué de presse est prévu au plan mais n'a jamais été écrit. Le contact le plus aligné est le CLEMI, le réseau d'éducation aux médias de l'Éducation nationale.",
          },
        ],
      },
      {
        kind: "callout",
        tone: "warn",
        title: "L'anomalie à corriger en premier : les actualités ne rapportent rien",
        body: "Plus de 500 brèves ont été produites, plus deux dossiers de fond par semaine. Elles vivent sous une adresse (/apercudecouverte/actualites) que les moteurs de recherche ont pour consigne de ne pas explorer, et elles ne figurent dans aucun plan de site. Autrement dit : du contenu déjà produit et déjà payé, qui n'amène pas un seul visiteur. Ouvrir une vraie page publique /actualites est le geste au meilleur rapport effort/résultat du moment.",
      },
      {
        kind: "callout",
        tone: "warn",
        title: "Le nuage à l'horizon, et il est daté",
        body: "Les réponses automatiques de Google (les « AI Overviews ») arrivent en France, attendues d'ici le 23 septembre 2026. Là où elles sont déjà actives — Belgique, Suisse francophone — nos propres relevés montrent un taux de clic inférieur de 55 à 85 % à la France, à position égale. Attendu : environ la moitié du rendement du référencement pur perdue en deux ans. D'où la stratégie, qui n'est pas discutable : convertir la vague actuelle en familles inscrites MAINTENANT, et déplacer la valeur vers ce qu'aucune réponse automatique ne sait servir — le verdict par enfant, la communauté, la marque.",
      },
      {
        kind: "points",
        title: "Les concurrents, en trafic mensuel",
        items: [
          { label: "filmspourenfants.net — environ 224 000 visites/mois", desc: "Le site historique. Tenu à la main par un bénévole, environ 2 000 fiches, films uniquement. Plus d'audience que nous : c'est la raison pour laquelle on n'a pas le droit de se dire « numéro 1 »." },
          { label: "Ayther.fr — environ 221 000 visites/mois", desc: "75 % de son trafic vient de la recherche, comme nous." },
          { label: "Benshi — environ 124 000 visites/mois", desc: "Positionnement éditorial et prescription cinéma." },
          { label: "PédaGoJeux — environ 9 600 visites/mois", desc: "Le seul acteur français sur les jeux, et il est mort en recherche (5 % de trafic search). D'où le terrain vide qu'on occupe." },
          { label: "Common Sense Media — environ 6,4 millions/mois", desc: "Le modèle américain. Zéro présence dans les résultats français : le créneau est libre." },
        ],
      },
    ],
  },

  // ── 10 ─────────────────────────────────────────────────────────────
  {
    id: "prochaines-etapes",
    eyebrow: "Chapitre 10",
    title: "Ce qui reste à faire — et c'est là que ça devient intéressant",
    lead: "Le plan de croissance comptait huit priorités. La quasi-totalité de ce qui relevait du code est faite. Tout ce qui bloque aujourd'hui demande un humain.",
    blocks: [
      {
        kind: "callout",
        tone: "good",
        title: "Le constat en une phrase",
        body: "Presque tout ce qui pouvait être codé a été codé. Ce qui n'a pas eu lieu, c'est tout ce qui suppose d'envoyer un e-mail, d'ouvrir un compte, ou d'appuyer sur « publier ». C'est exactement là qu'une deuxième personne change tout — et c'est du travail qui ne demande pas une ligne de code.",
      },
      {
        kind: "points",
        title: "Les huit priorités du plan, et où elles en sont",
        items: [
          {
            label: "P1 — Transformer les visites en inscriptions ✅ codé",
            desc: "L'accroche de sauvegarde est en place sur les fiches : un visiteur non connecté qui veut enregistrer un titre voit une invitation à créer un compte, sans que le contenu soit jamais caché. Reste à mesurer si ça marche : l'événement d'inscription ne dit pas d'où venait la personne, donc l'indicateur phare du plan (« fiche → inscription ») n'est pas encore mesurable.",
          },
          {
            label: "P2 — Ouvrir le Coin Famille ✅ fait",
            desc: "Public pour tous les inscrits depuis juillet 2026.",
          },
          {
            label: "P3 — Se préparer aux réponses automatiques ✅ largement fait",
            desc: "La phrase de verdict citable existe et est partagée par les fiches, la page pilier des jeux et la couche destinée aux assistants. Le lien vers la méthode part du badge d'âge. Reste le suivi mensuel du taux de clic France contre Belgique/Suisse — aujourd'hui un export manuel que personne ne fait.",
          },
          {
            label: "P4 — Prendre le terrain des jeux ✅ codé",
            desc: "Le titre de toutes les fiches reprend la formulation « quel âge », l'import hebdomadaire des gros titres tourne, et la liste de référence est passée à 44 jeux. Reste l'angle éditorial par titre : le pourquoi, et les alternatives par âge.",
          },
          {
            label: "P5 — Publier les 15 articles de blog ⛔ bloqué sur un humain",
            desc: "Les 15 articles sont écrits et relus. Ils sont restés à l'état de brouillon : le script de publication crée des brouillons par défaut, et personne n'a appuyé sur publier. Deux par semaine était la cadence prévue.",
          },
          {
            label: "P6 — Systématiser les fiches avant sortie ◐ en cours",
            desc: "L'âge provisoire est posé dès l'import ; il reste à brancher le calendrier des sorties familiales 2026-2027 pour n'en manquer aucune.",
          },
          {
            label: "P7 — Ouvrir la porte des médiathèques ⛔ jamais commencé",
            desc: "Le catalogue de coopération numérique de la BPI est le seul canal professionnel accessible à une personne seule. Inscription gratuite, mais il exige une grille tarifaire publique — qui n'existe pas. Rien n'a été contacté.",
          },
          {
            label: "P8 — Les bases de la marque ⛔ jamais commencé",
            desc: "Zéro clic de marque en trois mois. C'est pourtant la seule demande qu'aucune réponse automatique ne peut intercepter. Le dossier de presse annoncé dans le plan n'existe pas : il est à écrire.",
          },
        ],
      },
      {
        kind: "points",
        title: "Les chantiers qui n'attendent que quelqu'un",
        items: [
          {
            label: "Publier les 15 articles du blog",
            desc: "Écrits, relus, en brouillon. Deux par semaine. C'est le stock le plus prêt à l'emploi du projet.",
          },
          {
            label: "Ouvrir une page publique pour les actualités",
            desc: "500 brèves existent déjà et ne rapportent rien parce que leur adresse est fermée aux moteurs de recherche.",
          },
          {
            label: "Ouvrir les réseaux sociaux",
            desc: "Instagram, TikTok, Facebook. Aucun compte n'existe. Le plan prévoyait cinq carrousels et trois vidéos « À partir de quel âge ? » pour démarrer.",
          },
          {
            label: "Écrire et envoyer le dossier de presse",
            desc: "Angle : « un Common Sense Media à la française ». Cibles nommées : CLEMI et Réseau Canopé côté éducation ; MagicMaman, Parents, Enfant.com côté parentalité ; Numerama, Maddyness côté tech.",
          },
          {
            label: "Publier le baromètre « Tous publics »",
            desc: "Une étude maison montrant à quel point la mention « Tous publics » recouvre n'importe quoi. C'est un cadeau pour un journaliste. Le calcul est fait, mais la méthodologie impose cinq vérifications avant publication : le chiffre brut du premier passage ne doit surtout pas sortir tel quel.",
          },
          {
            label: "Ouvrir la newsletter",
            desc: "Le formulaire existe sur une seule page et reste réservé à l'équipe. Il manque aussi la confirmation par e-mail et l'envoi lui-même.",
          },
          {
            label: "Relire les guides parents chaque mois",
            desc: "Les blocs « état du jeu » de Roblox, Minecraft et Fortnite. Un rappel automatique dit quoi relire le 1er du mois ; la vérification, elle, est humaine. C'est ce qui empêche ces pages d'être publiques aujourd'hui.",
          },
          {
            label: "Aller sur les forums parents",
            desc: "r/ParentingFR, Doctissimo, MagicMaman. Jamais approchés.",
          },
        ],
      },
      {
        kind: "points",
        title: "Les objectifs chiffrés à 90 jours (référence : juillet 2026)",
        items: [
          { label: "Clics hebdomadaires depuis Google", desc: "440 → 1 500 et plus." },
          { label: "Conversion fiche → inscription", desc: "0,5 % → 2 % minimum." },
          { label: "Familles inscrites (hors équipe)", desc: "12 → 100 et plus." },
          { label: "Votes de la communauté par semaine", desc: "moins de 2 → 25 et plus." },
          { label: "Clics sur la marque", desc: "0 → une première tendance non nulle." },
          { label: "Fidélité des familles actives", desc: "au moins 40 % des foyers actifs dans le mois reviennent chaque semaine." },
        ],
      },
    ],
  },

  // ── 11 ─────────────────────────────────────────────────────────────
  {
    id: "modele",
    eyebrow: "Chapitre 11",
    title: "Comment ça tiendra debout",
    lead: "Gratuit aujourd'hui, et volontairement non monétisé. Mais l'ordre des étapes est déjà écrit.",
    blocks: [
      {
        kind: "text",
        body: [
          "Le site coûte quelques euros par mois à faire tourner. Tant qu'on est sous les 50 000 visites mensuelles, chaque heure passée sur la monétisation est une heure volée à la construction du parcours d'inscription. La patience est donc gratuite — c'est un choix, pas un renoncement.",
        ],
      },
      {
        kind: "points",
        title: "L'ordre des pistes, quand le moment viendra",
        items: [
          { label: "1. Les médiathèques", desc: "Via le catalogue de coopération de la BPI. Tickets de l'ordre de 1 000 à 5 000 € par an et par collectivité." },
          { label: "2. Les comités d'entreprise", desc: "Via les agrégateurs du marché. Acquisition peu coûteuse, possibilité d'une offre en marque blanche." },
          { label: "3. La licence de données", desc: "Le pari asymétrique : personne en France ne vend de données de compatibilité familiale titre par titre. Cible : les fournisseurs de métadonnées des programmes TV." },
          { label: "4. L'adhésion de soutien", desc: "« Ami de Totem », autour de 25 € par an — annuel d'abord, jamais du micro-paiement mensuel (deux fois moins de conversion, valeur client sept fois plus faible)." },
          { label: "5. La personnalisation premium", desc: "Autour de 39 € par an, et seulement une fois que la version gratuite aura prouvé qu'elle retient les familles semaine après semaine." },
        ],
      },
      {
        kind: "callout",
        tone: "warn",
        title: "Ce qu'on ne fera jamais",
        body: "Pas de publicité display, pas d'affiliation, pas de classement payant. Ce n'est pas de la coquetterie : la promesse d'indépendance EST ce qui donnera sa valeur à la licence de données. On ne peut pas vendre les deux.",
      },
    ],
  },

  // ── 12 ─────────────────────────────────────────────────────────────
  {
    id: "vocabulaire",
    eyebrow: "Chapitre 12",
    title: "Le vocabulaire maison",
    lead: "Les mots qui reviennent dans les conversations et les e-mails automatiques, traduits une bonne fois pour toutes.",
    blocks: [
      {
        kind: "glossary",
        items: [
          { term: "Fiche", desc: "La page d'un titre (un film, une série, un jeu). C'est l'unité de base du site et la page où atterrissent 96 % des visiteurs." },
          { term: "Enrichissement", desc: "L'analyse approfondie d'un titre : c'est ce qui produit l'âge conseillé argumenté et les 8 dimensions. Une fiche « non enrichie » n'a qu'une estimation." },
          { term: "Âge provisoire / à confirmer", desc: "L'âge estimé d'une fiche pas encore analysée à fond. Affiché honnêtement avec son badge." },
          { term: "Les 8 dimensions", desc: "Violence, sexe et nudité, langage, substances, consumérisme, messages positifs, modèles positifs, valeur éducative. Notées de 0 à 5." },
          { term: "Garde-fous / plancher d'âge", desc: "Les règles automatiques qui empêchent un contenu sensible de recevoir un âge trop bas. Repassées chaque samedi sur tout le catalogue." },
          { term: "Score de compatibilité (family fit)", desc: "La correspondance entre un titre et un enfant précis, calculée à partir de son profil. Chiffrée sur 100 en interne, montrée aux parents sous forme de verdict : Très adapté, Bon choix, À vérifier, Trop tôt." },
          { term: "Cron / tâche automatique", desc: "Un programme qui se déclenche tout seul à heure fixe. C'est ce qu'on appelle « les tuyaux »." },
          { term: "Superviseur", desc: "La tâche quotidienne qui vérifie que les autres ont bien tourné, en relance certaines, et envoie un e-mail en cas d'anomalie." },
          { term: "GSC / Search Console", desc: "L'outil gratuit de Google qui dit sur quelles recherches le site apparaît, à quelle position et avec combien de clics. La source de vérité du trafic." },
          { term: "Maillage interne", desc: "Les liens entre nos propres pages. Plus une fiche est reliée aux autres, mieux Google la comprend et la classe." },
          { term: "Striking distance", desc: "Les recherches où l'on est entre la 8ᵉ et la 20ᵉ place — juste hors de la première page. Le levier de trafic le moins cher, traité chaque jeudi." },
          { term: "AI Overviews", desc: "Les réponses automatiques que Google affiche au-dessus des résultats. Elles répondent à la place du site et font chuter les clics." },
          { term: "PEGI / CNC-CSA", desc: "Les classifications officielles : PEGI pour les jeux vidéo, CNC/CSA pour les films et séries en France. Nous les affichons à côté de notre propre conseil, jamais à sa place." },
          { term: "Coin Famille", desc: "L'espace personnalisé d'un foyer inscrit : recommandations par enfant, soirée cinéma, listes." },
          { term: "Vercel / Supabase / Sanity", desc: "Les trois prestataires techniques : Vercel héberge le site, Supabase héberge la base de données, Sanity sert à écrire les articles de blog." },
        ],
      },
      {
        kind: "links",
        items: [
          { label: "Notre méthode (page publique)", href: "/notre-methode", desc: "La version que lisent les parents. À connaître par cœur." },
          { label: "Nos valeurs", href: "/nos-valeurs", desc: "L'engagement d'indépendance, tel qu'il est publié." },
          { label: "À propos", href: "/a-propos", desc: "L'histoire du projet côté visiteurs." },
        ],
      },
    ],
  },
]

// ── Carte mentale ─────────────────────────────────────────────────────

/** Où en est un sujet — sert de pastille de couleur sur la carte. */
export type NodeStatus = "done" | "wip" | "todo"

export interface MindNode {
  id: string
  label: string
  /** Une phrase d'explication, affichée sous le libellé. */
  note?: string
  status?: NodeStatus
  /** Lien vers le site ou vers une autre page de cet espace. */
  href?: string
  children?: MindNode[]
}

export interface MindBranch extends MindNode {
  /** Couleur d'identité de la branche. */
  color: string
  /** Ce que la branche répond, en une question. */
  question: string
}

export const MINDMAP_ROOT = {
  label: "Totem Avisé",
  note: "Le guide familial français qui répond « à partir de quel âge ? » — pour votre enfant en particulier.",
}

export const MINDMAP: MindBranch[] = [
  // ── 1 ──────────────────────────────────────────────────────────────
  {
    id: "identite",
    label: "Ce que c'est",
    question: "Qu'est-ce qu'on vend, et à quoi on ne touche pas ?",
    color: "#D16A4A",
    note: "L'identité, la promesse et les limites qu'on s'est fixées.",
    children: [
      {
        id: "promesse",
        label: "La promesse",
        note: "Un âge conseillé argumenté, dès l'annonce du titre, adapté à chaque enfant.",
        children: [
          { id: "promesse-avant", label: "Avant tout le monde", note: "Une fiche existe dès l'annonce, badgée « à confirmer ».", status: "done" },
          { id: "promesse-perso", label: "Pour votre enfant", note: "Score de compatibilité par profil, pas une moyenne.", status: "done" },
          { id: "promesse-3", label: "Trois médias", note: "Films, séries, jeux vidéo dans une même base.", status: "done" },
        ],
      },
      {
        id: "valeurs",
        label: "Les valeurs",
        note: "Dans l'ordre : indépendance, honnêteté, chaque enfant est différent, des repères pas des verdicts.",
        children: [
          { id: "val-indep", label: "Indépendance", note: "Ni pub, ni affiliation, ni influence des studios. Non négociable.", status: "done" },
          { id: "val-honnete", label: "Honnêteté radicale", note: "Méthode publiée, « à confirmer » assumé, jamais de boîte noire.", status: "done" },
          { id: "val-enfant", label: "Chaque enfant est différent", note: "Un âge est une moyenne ; le produit sert à dépasser la moyenne.", status: "done" },
          { id: "val-reperes", label: "Des repères, pas des verdicts", note: "Ni moralisateur, ni anxiogène, ni anti-écrans.", status: "done" },
        ],
      },
      {
        id: "ton",
        label: "Le ton",
        note: "Le guide de confiance : l'ami parent qui a déjà vérifié pour vous.",
        children: [
          { id: "ton-oui", label: "Chaleureux, précis, malicieux", note: "Vouvoiement, phrases courtes, humour sur la situation des parents." },
          { id: "ton-non", label: "Jamais alarmiste ni moralisateur", note: "Mots bannis : interdit, danger, toxique, « l'IA a décidé »." },
        ],
      },
      {
        id: "marque",
        label: "La marque",
        note: "Palette crème et terracotta, typographie de magazine, badge d'âge comme signature.",
        children: [
          { id: "marque-nom", label: "Totem + Avisé", note: "L'emblème de la tribu, et le bon conseil." },
          { id: "marque-ombrelle", label: "Une maison « Totem »", note: "Totem Avisé est le premier produit ; Totem Quest est en exploration.", status: "wip" },
          { id: "marque-book", label: "Brand book", note: "Le brief est écrit et prêt à partir chez un studio. Rien n'est commandé.", status: "todo" },
        ],
      },
    ],
  },

  // ── 2 ──────────────────────────────────────────────────────────────
  {
    id: "catalogue",
    label: "Ce qu'on couvre",
    question: "Qu'est-ce qu'il y a dans le magasin, et comment c'est rangé ?",
    color: "#E8A87C",
    note: "Les rayons du site, les tranches d'âge et la méthode d'évaluation.",
    children: [
      {
        id: "rayons",
        label: "Les rayons",
        children: [
          { id: "r-films", label: "Films", href: "/films", note: "Inclut « En ce moment au cinéma », en direct des sorties en salle.", status: "done" },
          { id: "r-series", label: "Séries", href: "/series", status: "done" },
          { id: "r-jeux", label: "Jeux vidéo", href: "/jeux", note: "Notre terrain de différenciation. Avec les guides parents et la verticale « quel âge ».", status: "done" },
          { id: "r-mangas", label: "Mangas", href: "/mangas", note: "Ouverture récente, encore réservée à l'équipe.", status: "wip" },
          { id: "r-actus", label: "Actualités", note: "Produites 4 fois par jour + dossier 2 fois/semaine, mais la page publique n'est pas ouverte : visibles seulement dans le Coin Famille et les aperçus de l'équipe.", status: "wip" },
          { id: "r-blog", label: "Blog", href: "/blog", note: "15 articles relus attendent d'être publiés.", status: "todo" },
          { id: "r-collections", label: "Collections & guides", href: "/collections", note: "Sélections thématiques éditorialisées.", status: "done" },
        ],
      },
      {
        id: "ages",
        label: "Les 6 tranches d'âge",
        note: "Chaque tranche a sa couleur et ses plafonds de contenu.",
        children: [
          { id: "a-2-4", label: "2–4 · Tout-petits", note: "Zéro violence, zéro langage, zéro sexuel. La tranche la plus pauvre du catalogue." },
          { id: "a-5-7", label: "5–7 · Enfants" },
          { id: "a-8-10", label: "8–10 · Grands enfants" },
          { id: "a-11-12", label: "11–12 · Pré-ados" },
          { id: "a-13-15", label: "13–15 · Ados" },
          { id: "a-16", label: "16+ · Jeunes adultes" },
        ],
      },
      {
        id: "methode",
        label: "La méthode",
        href: "/notre-methode",
        note: "Publiée sur le site — c'est notre actif de crédibilité.",
        children: [
          { id: "m-grille", label: "Une grille identique pour tous", note: "Synopsis + classifications officielles + genres, appliqués à tout le catalogue.", status: "done" },
          { id: "m-8dim", label: "8 dimensions notées 0–5", note: "Violence, sexe, langage, substances, consumérisme, messages, modèles, éducatif.", status: "done" },
          { id: "m-gardefous", label: "Les garde-fous", note: "Un contenu sensible ne peut jamais recevoir un âge trop bas. Repassés chaque samedi.", status: "done" },
          { id: "m-pourquoi", label: "« Pourquoi cet âge ? »", note: "Le raisonnement publié sur chaque fiche. Notre meilleure protection contre la boîte noire.", status: "done" },
          { id: "m-votes", label: "Les votes des familles", note: "5 votes + 70 % d'accord = badge de consensus.", status: "done" },
          { id: "m-marquer", label: "« Ce qui peut marquer »", note: "Points de vigilance précis, liste fermée, repliés par défaut pour ne pas divulgâcher.", status: "done" },
        ],
      },
    ],
  },

  // ── 3 ──────────────────────────────────────────────────────────────
  {
    id: "audience",
    label: "Pour qui",
    question: "Qui vient, à quel moment, et pourquoi il repart ?",
    color: "#8DBDC9",
    note: "Le cœur de cible, les deux moments de vérité et les cibles secondaires.",
    children: [
      {
        id: "coeur",
        label: "Le parent décideur",
        note: "30–45 ans, enfants de 3 à 15 ans. C'est lui qui organise la soirée.",
        children: [
          { id: "p-mere", label: "La mère organisatrice", note: "Vérifie avant, déteste la mauvaise surprise. « Éviter les pleurs et les cauchemars »." },
          { id: "p-pere", label: "Le père joueur", note: "À l'aise sur les jeux, dépassé par le chat et les achats intégrés." },
          { id: "p-grands", label: "Grands-parents & baby-sitters", note: "Prescripteurs occasionnels. Veulent une réponse simple, sans créer de compte." },
        ],
      },
      {
        id: "moments",
        label: "Les 2 moments de vérité",
        children: [
          { id: "mom-google", label: "Le moment Google", note: "« [titre] à partir de quel âge » — 92 % du trafic de recherche. Réponse immédiate exigée.", status: "done" },
          { id: "mom-canape", label: "Le moment canapé", note: "« On regarde quoi ce soir ? » — c'est LA raison de créer un compte.", status: "wip" },
        ],
      },
      {
        id: "escalier",
        label: "L'escalier de l'engagement",
        note: "Chaque marche perd du monde. La première est la plus coûteuse.",
        children: [
          { id: "e-visite", label: "Visiteur anonyme", note: "Lit la fiche, repart en 30 secondes.", status: "done" },
          { id: "e-compte", label: "Compte créé", note: "Ne sert encore à rien tant qu'il n'y a pas de profil enfant.", status: "wip" },
          { id: "e-profil", label: "Profil enfant créé", note: "Le score de compatibilité devient possible.", status: "wip" },
          { id: "e-quiz", label: "Quiz de préférences", note: "7 étapes par enfant. Fait passer le score de « correct » à « juste ».", status: "wip" },
          { id: "e-reactions", label: "Réactions après visionnage", note: "Le site apprend, les recommandations s'affinent seules.", status: "wip" },
        ],
      },
      {
        id: "b2b",
        label: "Cibles secondaires (B2B)",
        note: "La marque doit rester crédible sur une borne de médiathèque comme dans une story Instagram.",
        children: [
          { id: "b-media", label: "Médiathèques", note: "Via le catalogue de coopération de la BPI. Le seul canal pro accessible à une personne seule.", status: "todo" },
          { id: "b-ecoles", label: "Enseignants / CLEMI", note: "Alignement de mission parfait, et un lien depuis un site public.", status: "todo" },
          { id: "b-cse", label: "Comités d'entreprise", note: "Via les agrégateurs du marché.", status: "todo" },
        ],
      },
    ],
  },

  // ── 4 ──────────────────────────────────────────────────────────────
  {
    id: "produit",
    label: "Le compte famille",
    question: "Qu'est-ce qu'on offre qu'aucun moteur de recherche ne peut copier ?",
    color: "#B8D89A",
    note: "La personnalisation : le seul terrain où les réponses automatiques ne peuvent pas nous suivre.",
    children: [
      {
        id: "profils",
        label: "Les profils enfants",
        note: "Jusqu'à 10 par compte.",
        children: [
          { id: "pr-identite", label: "Identité", note: "Prénom, année de naissance, avatar, centres d'intérêt." },
          { id: "pr-gouts", label: "Goûts", note: "Genres préférés et genres détestés." },
          { id: "pr-sensi", label: "Sensibilités", note: "Violence, peur, sexuel, langage, substances — chacune de 0 à 3." },
          { id: "pr-positif", label: "Contenus positifs souhaités", note: "Messages, modèles, valeur éducative." },
          { id: "pr-eviter", label: "Sujets à éviter", note: "Liste explicite, qui agit comme une barrière." },
        ],
      },
      {
        id: "score",
        label: "Le verdict par enfant",
        note: "Calculé sur 100 en coulisses, affiché en toutes lettres : Très adapté · Bon choix · À vérifier · Trop tôt.",
        children: [
          { id: "sc-barrieres", label: "D'abord les barrières", note: "Genre détesté ou sujet à éviter : le score tombe au plancher, quoi qu'il arrive." },
          { id: "sc-age", label: "L'âge pèse le plus (28 %)", note: "Puis les sensibilités (22 %), puis genres, intérêts, affinités, ton, positif, apprentissage." },
          { id: "sc-apprend", label: "Ça apprend", note: "Les réactions passées nourrissent un profil de goûts qui affine les suggestions." },
        ],
      },
      {
        id: "surfaces",
        label: "Les surfaces personnalisées",
        children: [
          { id: "su-profil", label: "Espace profil", href: "/profil", note: "Le hub du foyer : recommandations, membres, listes.", status: "done" },
          { id: "su-soiree", label: "Soirée cinéma", note: "Trouve un titre qui convient à plusieurs enfants à la fois.", status: "done" },
          { id: "su-coin", label: "Coin Famille", href: "/coin-famille", note: "L'espace quotidien du foyer, ouvert à tous les inscrits depuis juillet 2026.", status: "done" },
          { id: "su-totem", label: "Totem, l'assistant", note: "Un chatbot qui répond aux questions des parents. Encore en alpha, réservé à l'équipe, avec plafonds de coût et interrupteur d'arrêt.", status: "wip" },
          { id: "su-alertes", label: "Alertes de sortie", note: "« Prévenez-moi » sur un titre à venir. La seule notification qu'on envoie.", status: "done" },
        ],
      },
    ],
  },

  // ── 5 ──────────────────────────────────────────────────────────────
  {
    id: "machine",
    label: "Les tuyaux",
    question: "Comment une seule personne tient des milliers de fiches à jour ?",
    color: "#A79BC7",
    note: "Une trentaine de tâches automatiques, réparties en six familles. État en direct sur le tableau de bord.",
    href: "/steph",
    children: [
      {
        id: "t-remplir",
        label: "Remplir le catalogue",
        note: "Chaque nuit : nouveaux films et séries, nouveaux jeux, séries jeunesse. Le lundi : les gros noms du jeu vidéo.",
        status: "done",
      },
      {
        id: "t-comprendre",
        label: "Comprendre les œuvres",
        note: "Analyse de contenu, analyse approfondie, score de complétude, relecture des résumés, plancher d'âge, streaming, titres proches.",
        status: "done",
      },
      {
        id: "t-ecrire",
        label: "Écrire et vérifier",
        note: "Actualités 4×/jour, dossier 2×/semaine, priorités éditoriales le lundi, relecture des guides parents le 1er du mois.",
        status: "done",
      },
      {
        id: "t-visible",
        label: "Se rendre visible",
        note: "Chaque jeudi : repérer les recherches en 2ᵉ page et retoucher les fiches pour passer en 1re.",
        status: "done",
      },
      {
        id: "t-familles",
        label: "Servir les familles",
        note: "Les alertes de sortie, tous les jours.",
        status: "done",
      },
      {
        id: "t-surveiller",
        label: "Surveiller la machine",
        note: "Superviseur quotidien, battement de cœur hébergé ailleurs, bilan hebdomadaire par e-mail.",
        status: "done",
      },
      {
        id: "t-humain",
        label: "Ce qui reste humain",
        note: "Les blocs « état du jeu » des guides parents ne sont jamais revérifiés par une machine. Un rappel mensuel dit quoi relire.",
        status: "wip",
      },
    ],
  },

  // ── 6 ──────────────────────────────────────────────────────────────
  {
    id: "acquisition",
    label: "Se faire connaître",
    question: "D'où viennent les visiteurs, et qu'est-ce qui pourrait couper le robinet ?",
    color: "#F8D775",
    note: "Presque tout vient de Google, sur une intention très précise.",
    children: [
      {
        id: "seo",
        label: "Le référencement",
        note: "92 % du trafic de recherche sur « quel âge ». 96 % des clics arrivent sur une fiche.",
        children: [
          { id: "seo-quelage", label: "La verticale « quel âge »", note: "Notre autoroute. Revendiquée titre par titre.", status: "done" },
          { id: "seo-jeux", label: "« Fortnite quel âge », « Roblox quel âge »", note: "Aucune autorité française sur ces recherches. Terrain vide qu'on prend.", status: "wip" },
          { id: "seo-avant", label: "Les fiches avant la sortie", note: "Notre avantage le plus dur à copier.", status: "wip" },
          { id: "seo-striking", label: "Les pages en 2ᵉ page", note: "Traitées automatiquement chaque jeudi.", status: "done" },
        ],
      },
      {
        id: "ia",
        label: "Les assistants IA",
        note: "Une couche technique lisible par les assistants, pour être cité correctement.",
        children: [
          { id: "ia-couche", label: "Couche pour agents", note: "Le site expose ses fiches dans un format que les assistants savent lire.", status: "done" },
          { id: "ia-citable", label: "Verdict citable en haut de fiche", note: "Une phrase que les réponses automatiques peuvent reprendre telle quelle.", status: "todo" },
        ],
      },
      {
        id: "contenu",
        label: "Le contenu éditorial",
        children: [
          { id: "c-actus", label: "Actualités", note: "Produites automatiquement 4×/jour — mais la page publique n'est pas encore ouverte.", status: "wip" },
          { id: "c-dossiers", label: "Dossiers de fond", note: "Deux fois par semaine, même situation que les brèves.", status: "wip" },
          { id: "c-blog", label: "Blog", note: "15 articles relus attendent. Deux publications par semaine seraient la bonne cadence.", status: "todo" },
          { id: "c-guides", label: "Guides parents (jeux)", note: "Trois gros jeux couverts, réservés à l'équipe le temps d'une relecture humaine complète.", status: "wip" },
        ],
      },
      {
        id: "social",
        label: "Réseaux & presse",
        children: [
          { id: "s-insta", label: "Instagram / TikTok / Facebook", note: "@totemavise — aucun compte ouvert à ce jour.", status: "todo" },
          { id: "s-presse", label: "Dossier de presse", note: "Écrit, jamais envoyé. Angle : « un Common Sense Media à la française ».", status: "todo" },
          { id: "s-influ", label: "Influenceurs parentalité", note: "Dix contacts identifiés, aucun approché.", status: "todo" },
          { id: "s-forums", label: "Forums & communautés", note: "r/ParentingFR, Doctissimo, MagicMaman.", status: "todo" },
          { id: "s-newsletter", label: "Newsletter", note: "L'inscription existe, encore en bêta réservée à l'équipe.", status: "wip" },
        ],
      },
      {
        id: "menace",
        label: "⚠ La menace datée",
        note: "Les réponses automatiques de Google arrivent en France. Là où elles existent déjà (Belgique, Suisse), nos clics sont 55 à 85 % plus bas à position égale.",
        children: [
          { id: "me-convertir", label: "Convertir la vague maintenant", note: "Transformer le trafic actuel en familles inscrites avant qu'il ne rétrécisse.", status: "todo" },
          { id: "me-deplacer", label: "Déplacer la valeur", note: "Vers ce qu'aucune réponse automatique ne sert : le score par enfant, la communauté, la marque.", status: "wip" },
          { id: "me-mesurer", label: "Mesurer chaque mois", note: "Comparer le taux de clic France vs Belgique/Suisse : c'est notre meilleur baromètre.", status: "todo" },
        ],
      },
    ],
  },

  // ── 7 ──────────────────────────────────────────────────────────────
  {
    id: "avenir",
    label: "La suite",
    question: "Qu'est-ce qu'on fait ensuite, et comment ça tiendra debout ?",
    color: "#D89AB0",
    note: "Le plan de croissance par effet de levier, et l'ordre des pistes de revenus.",
    children: [
      {
        id: "priorites",
        label: "Les priorités, dans l'ordre",
        children: [
          { id: "pri-1", label: "P1 · Fiche → inscription ⭐", note: "L'accroche après la réponse sur l'âge + la sauvegarde de favoris. Objectif 0,5 % → 2 %.", status: "todo" },
          { id: "pri-2", label: "P2 · Ouvrir le Coin Famille", note: "Prêt techniquement. C'est la raison de s'inscrire.", status: "todo" },
          { id: "pri-3", label: "P3 · Préparer les réponses automatiques", note: "Verdict citable, données structurées, lien vers la méthode partout.", status: "wip" },
          { id: "pri-4", label: "P4 · Prendre le terrain des jeux", note: "Un angle parents par gros titre.", status: "wip" },
          { id: "pri-5", label: "P5 · Publier les 15 articles", note: "Deux par semaine.", status: "todo" },
          { id: "pri-6", label: "P6 · Fiches avant sortie systématiques", note: "Chaque sortie familiale 2026-2027.", status: "wip" },
          { id: "pri-7", label: "P7 · Une médiathèque pilote", note: "Ancrage de crédibilité pour la presse et la suite.", status: "todo" },
          { id: "pri-8", label: "P8 · Les bases de la marque", note: "Nom cohérent partout, dossier de presse envoyé, suivi des recherches de marque.", status: "todo" },
        ],
      },
      {
        id: "revenus",
        label: "Les revenus, plus tard",
        note: "Rien avant 50 000 visites mensuelles. Le site coûte quelques euros par mois : la patience est gratuite.",
        children: [
          { id: "rev-1", label: "1 · Médiathèques", note: "1 000 à 5 000 € / an / collectivité.", status: "todo" },
          { id: "rev-2", label: "2 · Comités d'entreprise", note: "Via les agrégateurs, possible en marque blanche.", status: "todo" },
          { id: "rev-3", label: "3 · Licence de données", note: "Le pari asymétrique : personne en France ne vend ces données titre par titre.", status: "todo" },
          { id: "rev-4", label: "4 · Adhésion de soutien", note: "« Ami de Totem », ~25 €/an, annuel d'abord.", status: "todo" },
          { id: "rev-5", label: "5 · Personnalisation premium", note: "~39 €/an, seulement après preuve de rétention.", status: "todo" },
        ],
      },
      {
        id: "jamais",
        label: "Ce qu'on ne fera jamais",
        note: "Pas de publicité, pas d'affiliation, pas de classement payant. L'indépendance EST ce qui donnera sa valeur à la licence de données.",
        status: "done",
      },
    ],
  },
]

/** Libellés des pastilles d'avancement de la carte. */
export const STATUS_LABEL: Record<NodeStatus, string> = {
  done: "En place",
  wip: "En cours",
  todo: "À faire",
}

export const STATUS_COLOR: Record<NodeStatus, string> = {
  done: "#5C8A5C",
  wip: "#D9A521",
  todo: "#D16A4A",
}
