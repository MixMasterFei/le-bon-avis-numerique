/**
 * Content of /assistants-ia — the public documentation of the connector that
 * lets an AI assistant consult Totem Avisé (MCP server, streamable HTTP).
 *
 * Kept as data so tests can pin it against the live server contract: the
 * connector URL, the tool names and the read-only promise must never drift
 * from src/app/api/mcp/[transport]/route.ts.
 *
 * Two rules for this text:
 *  - It names the assistants (Claude, Le Chat, ChatGPT) because that is where
 *    families use Totem — allowed only through Xavier's explicit exception to
 *    the CLAUDE.md naming rule, which is why the page sits behind
 *    AI_CONNECTORS_PAGE_PUBLIC (src/lib/ai-connectors-flag.ts).
 *  - It NEVER says which AI Totem uses internally. A test enforces it.
 */

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

/** Streamable HTTP endpoint: basePath "/api/mcp" + transport "mcp". */
export const CONNECTOR_URL = `${SITE_URL}/api/mcp/mcp`

export const SUPPORT_EMAIL = "contact@totemavise.com"

export interface ToolDoc {
  /** Exact tool name, as the server registers it. */
  name: string
  label: string
  desc: string
}

export const TOOLS: ToolDoc[] = [
  {
    name: "search_media",
    label: "Trouver un titre",
    desc:
      "l'assistant cherche un film, une série ou un jeu vidéo dans notre catalogue, y compris par son titre original.",
  },
  {
    name: "get_age_verdict",
    label: "Le verdict d'âge complet",
    desc:
      "âge conseillé, indicateurs de contenu (violence, sexualité, langage, alcool et drogues, consumérisme, " +
      "messages positifs…), " +
      "« Pourquoi cet âge ? », points de vigilance, et le lien vers la fiche pour vérifier par vous-même.",
  },
  {
    name: "recommend_for_age",
    label: "Une sélection par âge",
    desc: "des films, séries ou jeux adaptés à un enfant de 3 à 16 ans, choisis dans notre catalogue évalué.",
  },
]

/** Five questions a parent would actually ask — every title exists in the catalogue. */
export const EXAMPLE_QUESTIONS = [
  "Vice-Versa 2, c'est adapté à ma fille de 6 ans ?",
  "À partir de quel âge peut-on jouer à Minecraft ?",
  "La série Mercredi est-elle trop effrayante pour un enfant de 11 ans ?",
  "Propose-moi des films pour une soirée en famille avec un enfant de 7 ans.",
  "Quels jeux vidéo conseilles-tu pour un enfant de 9 ans ?",
]

export const PRIVACY_POINTS = [
  {
    label: "Aucun compte, aucune clé",
    desc: "le connecteur est public : son adresse suffit, vous n'avez rien à créer ni à fournir.",
  },
  {
    label: "Seulement ce qu'il faut pour répondre",
    desc:
      "l'assistant nous envoie le titre cherché, un âge ou un type de média. Jamais votre conversation, " +
      "ni votre nom, ni ceux de vos enfants.",
  },
  {
    label: "Rien de gardé sur vous",
    desc:
      "nous ne conservons pas ces recherches : nos journaux notent seulement l'outil appelé, " +
      "le résultat (trouvé, introuvable, erreur) et la durée, et nos statistiques comptent par jour " +
      "les appels et les fiches consultées, jamais le texte de la question. Comme pour toute visite " +
      "du site, notre hébergeur garde des journaux techniques de connexion.",
  },
  {
    label: "Lecture seule",
    desc: "le connecteur ne peut rien modifier, ni sur Totem Avisé, ni dans votre assistant.",
  },
  {
    label: "Votre conversation reste chez votre assistant",
    desc:
      "elle relève des règles de confidentialité de l'assistant que vous utilisez ; Totem Avisé n'y a pas accès.",
  },
]

export interface SetupGuide {
  id: string
  assistant: string
  /** Who can do it, in one line. */
  availability: string
  steps: string[]
  note?: string
}

export const SETUP_GUIDES: SetupGuide[] = [
  {
    id: "claude",
    assistant: "Claude",
    availability: "Tous les abonnements, y compris le gratuit (un connecteur personnalisé).",
    steps: [
      "Ouvrez « Personnaliser », puis « Connecteurs » (Customize › Connectors).",
      "Cliquez sur « Ajouter un connecteur personnalisé » (Add custom connector).",
      `Nom : Totem Avisé. Adresse : ${CONNECTOR_URL}. Laissez les champs d'authentification vides.`,
      "Cliquez sur « Ajouter », puis activez Totem Avisé dans le menu des outils d'une conversation.",
    ],
  },
  {
    id: "le-chat",
    assistant: "Le Chat (Mistral AI)",
    availability: "Dans une organisation, l'ajout d'un connecteur est réservé à un administrateur.",
    steps: [
      "Ouvrez la page « Connecteurs » (Connectors).",
      "Cliquez sur « + Ajouter un connecteur », puis choisissez l'onglet « Connecteur MCP personnalisé ».",
      `Nom : totemavise (sans espace ni caractère spécial). Adresse : ${CONNECTOR_URL}. Aucune authentification.`,
      "Validez, puis activez le connecteur dans une conversation.",
    ],
  },
  {
    id: "chatgpt",
    assistant: "ChatGPT (mode développeur)",
    availability: "Le mode développeur est une fonction en bêta, réservée à certains abonnements.",
    steps: [
      "Dans les paramètres, ouvrez « Applications et connecteurs », puis « Paramètres avancés », et activez le « Mode développeur ».",
      "Revenez à « Applications et connecteurs » et cliquez sur « Créer ».",
      `Nom : Totem Avisé. Adresse : ${CONNECTOR_URL}. Authentification : aucune.`,
      "Dans une nouvelle conversation, choisissez Totem Avisé dans le menu des outils.",
    ],
    note: "Les intitulés de ce menu changent souvent : s'il diffère, cherchez « connecteur » ou « MCP » dans les paramètres.",
  },
]

export const GOOD_TO_KNOW = [
  "L'âge conseillé est un repère général. Pour un avis adapté à chaque enfant (sensibilités, goûts), " +
    "le compte famille du site calcule une compatibilité personnalisée.",
  "Quand un âge est encore une estimation, l'assistant en est informé et peut vous le signaler.",
  "Les fiches sont rédigées en français ; votre assistant peut vous répondre dans votre langue.",
]

/** Short English section for directory reviewers. */
export const REVIEWER_SECTION = {
  title: "For reviewers (English)",
  paragraphs: [
    "Totem Avisé is an independent French family media guide: for each film, TV series and video game it " +
      "gives a recommended age with its reasoning, content scores and points of attention for parents.",
    `The connector is a public, read-only MCP server (streamable HTTP) at ${CONNECTOR_URL}. ` +
      "No authentication, no account, no personal data. It exposes three tools: search_media, " +
      "get_age_verdict and recommend_for_age. Content is in French; verdicts and selections link to the " +
      "source page on totemavise.com.",
    "Try it in two minutes: add the URL as a custom connector, then ask “Is The Wild Robot okay for a " +
      "5-year-old?”, “From what age can kids play Minecraft?” or “Suggest family films for a 7-year-old.”",
    "Logs keep only the tool name, outcome and duration. Usage statistics count calls per day, per tool and " +
      "per title consulted, by assistant — never the query text, IP addresses or anything personal. " +
      `Support: ${SUPPORT_EMAIL}.`,
  ],
}
