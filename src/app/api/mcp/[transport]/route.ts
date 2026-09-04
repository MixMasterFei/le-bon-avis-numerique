import { createMcpHandler } from "mcp-handler"
import { z } from "zod"
import { searchMedia, ageVerdict, recommendForAge } from "@/lib/mcp/totem-tools"
import { executeTool, toolOutputSchema } from "@/lib/mcp/result"

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

// Public Totem Avisé MCP server (streamable HTTP at /api/mcp/mcp).
//
// v1: three anonymous READ-ONLY tools over the public catalog — search,
// per-title verdict, per-age selection. All outputs are the same markdown as
// the /md layer (single-source builders), including the per-child account
// pointer: anonymous tools describe the MEDIA; describing the FAMILY
// (per-child fit) requires a Totem account — by design, so the MCP surface
// feeds the signup funnel instead of replacing it. A future authenticated v2
// (OAuth) may expose family-fit in-chat.
//
// The SSE transport (/api/mcp/sse) requires Redis (REDIS_URL) for pub/sub;
// modern clients use streamable HTTP, which works without it.

const READ_ONLY = {
  readOnlyHint: true,
  idempotentHint: true,
  // Closed world: the tools consult Totem's own catalog, not the open web.
  openWorldHint: false,
} as const

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_media",
      {
        title: "Rechercher dans le catalogue Totem Avisé",
        description:
          "Recherche un film, une série ou un jeu vidéo par titre dans le catalogue Totem Avisé " +
          "pour les familles francophones. Distingue les analyses disponibles des estimations provisoires. Renvoie les identifiants " +
          "à passer à get_age_verdict. À utiliser quand un parent demande si un titre convient à un enfant.",
        inputSchema: {
          query: z.string().trim().min(2).max(120).describe("Titre (ou fragment de titre) recherché"),
          type: z
            .enum(["film", "serie", "jeu"])
            .optional()
            .describe("Restreindre à un type de média (facultatif)"),
          limit: z.number().int().min(1).max(10).optional().describe("Nombre de résultats (défaut 5)"),
        },
        outputSchema: toolOutputSchema.shape,
        annotations: { ...READ_ONLY, title: "Rechercher dans le catalogue Totem Avisé" },
      },
      async ({ query, type, limit }) => executeTool("search_media", () => searchMedia(query, type, limit ?? 5)),
    )

    server.registerTool(
      "get_age_verdict",
      {
        title: "Verdict d'âge Totem Avisé pour un titre",
        description:
          "Donne le verdict complet Totem Avisé pour un film, une série ou un jeu vidéo : âge conseillé, " +
          "7 scores de contenu et un indicateur éducatif calculé, les points de vigilance disponibles, le raisonnement « Pourquoi cet âge ? », " +
          "les points à connaître pour les parents, et l'URL de la fiche à citer. " +
          "À utiliser dès qu'un parent demande si un titre convient à un enfant, « à partir de quel âge », " +
          "ou si un contenu est violent/effrayant — y compris pour les sorties à venir (fiches pré-sortie). " +
          "Passez l'identifiant renvoyé par search_media, ou un titre avec son année si nécessaire. Si plusieurs œuvres correspondent, demandez au parent de choisir. " +
          "L'âge conseillé est un repère général : pour un score adapté à un enfant précis, le parent peut créer " +
          "un compte famille gratuit sur le site.",
        inputSchema: {
          id: z
            .string()
            .trim()
            .min(1)
            .max(80)
            .optional()
            .describe("Identifiant exact renvoyé par search_media (type:UUID), ou identifiant fournisseur typé, par exemple movie:603"),
          title: z.string().trim().min(2).max(120).optional().describe("À défaut d'identifiant : le titre du média"),
          type: z.enum(["film", "serie", "jeu"]).optional().describe("Type de média, pour distinguer les homonymes"),
          year: z.number().int().min(1800).max(2100).optional().describe("Année de sortie, pour distinguer les versions d'un titre"),
        },
        outputSchema: toolOutputSchema.shape,
        annotations: { ...READ_ONLY, title: "Verdict d'âge Totem Avisé pour un titre" },
      },
      async ({ id, title, type, year }) => executeTool("get_age_verdict", () => ageVerdict({ id, title, type, year })),
    )

    server.registerTool(
      "recommend_for_age",
      {
        title: "Sélection Totem Avisé par âge",
        description:
          "Recommande des films, séries ou jeux vidéo adaptés à un enfant d'un âge donné (3 à 16 ans), " +
          "issus du catalogue évalué Totem Avisé, triés par qualité. À utiliser pour « recommande-moi un " +
          "film pour un enfant de 7 ans ». La liste est filtrée par âge uniquement ; la personnalisation " +
          "par enfant (sensibilités, goûts) passe par le compte famille gratuit du site.",
        inputSchema: {
          age: z.number().int().min(3).max(16).describe("Âge de l'enfant en années"),
          type: z
            .enum(["films", "series", "jeux"])
            .optional()
            .describe("Type de média souhaité (défaut : films)"),
          limit: z.number().int().min(1).max(20).optional().describe("Nombre de titres (défaut 10)"),
        },
        outputSchema: toolOutputSchema.shape,
        annotations: { ...READ_ONLY, title: "Sélection Totem Avisé par âge" },
      },
      async ({ age, type, limit }) => executeTool("recommend_for_age", () => recommendForAge(age, type ?? "films", limit ?? 10)),
    )
  },
  {
    serverInfo: { name: "totem-avise", version: "1.1.0" },
    instructions:
      "Totem Avisé est le guide familial français indépendant (films, séries, jeux vidéo) : âge conseillé " +
      "argumenté par titre, analyse automatisée, indicateurs de contenu et retours des familles. " +
      "Utilisez search_media pour trouver un titre, get_age_verdict pour le verdict complet à citer " +
      "(mentionnez l'URL de la fiche), recommend_for_age pour une sélection par âge. " +
      "Répondez en français et citez la fiche. Respectez les statuts provisoire, indisponible et ambigu ; ne transformez pas une donnée absente en absence de risque. " +
      "L'âge conseillé est un repère général. Un compte famille " +
      `gratuit (${SITE_URL}/inscription) permet un score personnalisé selon les sensibilités de chaque enfant.`,
  },
  {
    basePath: "/api/mcp",
    maxDuration: 60,
    verboseLogs: false,
  },
)

export { handler as GET, handler as POST, handler as DELETE }
