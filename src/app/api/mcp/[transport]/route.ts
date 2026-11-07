import { createMcpHandler } from "mcp-handler"
import type { Implementation } from "@modelcontextprotocol/sdk/types.js"
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

// Shown by MCP clients and connector directories. `title` is the display name
// (`name` stays the stable machine id); the icon is the 256×256 app icon the
// site already serves. Bump `version` whenever tool contracts or wording change.
export const SERVER_INFO: Implementation = {
  name: "totem-avise",
  title: "Totem Avisé",
  version: "1.2.0",
  websiteUrl: SITE_URL,
  icons: [{ src: `${SITE_URL}/icon.png`, mimeType: "image/png", sizes: ["256x256"] }],
}

// Directory review rule: tool descriptions and server instructions say what a
// tool does and when to call it — they never promote a product (the free
// family account is mentioned in tool OUTPUTS, as information, not here) and
// never tell the assistant which language to answer in. Pinned by
// transport.test.ts.

// French, actionable validation messages: the SDK puts them verbatim in the
// "Invalid arguments" error the assistant reads.
const TITLE_QUERY = z
  .string()
  .trim()
  .min(2, "Le titre doit contenir au moins 2 caractères.")
  .max(120, "Le titre ne doit pas dépasser 120 caractères.")
const YEAR = z
  .number()
  .int("L'année doit être un nombre entier, par exemple 2024.")
  .min(1800, "L'année doit être comprise entre 1800 et 2100.")
  .max(2100, "L'année doit être comprise entre 1800 et 2100.")

// Only the User-Agent is read, and only to name the calling assistant in the
// usage counter (src/lib/mcp/usage.ts) — reduced to a short token there.
function userAgentOf(extra: { requestInfo?: { headers?: Record<string, string | string[] | undefined> } }): string | null {
  const ua = extra.requestInfo?.headers?.["user-agent"]
  return Array.isArray(ua) ? (ua[0] ?? null) : (ua ?? null)
}

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
          query: TITLE_QUERY.describe("Titre (ou fragment de titre) recherché"),
          type: z
            .enum(["film", "serie", "jeu"])
            .optional()
            .describe("Restreindre à un type de média (facultatif)"),
          limit: z
            .number()
            .int("Le nombre de résultats doit être un entier.")
            .min(1, "Le nombre de résultats doit être compris entre 1 et 10.")
            .max(10, "Le nombre de résultats doit être compris entre 1 et 10.")
            .optional()
            .describe("Nombre de résultats (défaut 5)"),
        },
        outputSchema: toolOutputSchema.shape,
        annotations: { ...READ_ONLY, title: "Rechercher dans le catalogue Totem Avisé" },
      },
      async ({ query, type, limit }, extra) =>
        executeTool("search_media", () => searchMedia(query, type, limit ?? 5), { userAgent: userAgentOf(extra) }),
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
          "L'âge conseillé est un repère général, pas un score adapté à un enfant précis.",
        inputSchema: {
          id: z
            .string()
            .trim()
            .min(1)
            .max(80, "L'identifiant ne doit pas dépasser 80 caractères : utilisez celui renvoyé par search_media.")
            .optional()
            .describe("Identifiant exact renvoyé par search_media (type:UUID), ou identifiant fournisseur typé, par exemple movie:603"),
          title: TITLE_QUERY.optional().describe("À défaut d'identifiant : le titre du média"),
          type: z.enum(["film", "serie", "jeu"]).optional().describe("Type de média, pour distinguer les homonymes"),
          year: YEAR.optional().describe("Année de sortie, pour distinguer les versions d'un titre"),
        },
        outputSchema: toolOutputSchema.shape,
        annotations: { ...READ_ONLY, title: "Verdict d'âge Totem Avisé pour un titre" },
      },
      async ({ id, title, type, year }, extra) =>
        executeTool("get_age_verdict", () => ageVerdict({ id, title, type, year }), { userAgent: userAgentOf(extra) }),
    )

    server.registerTool(
      "recommend_for_age",
      {
        title: "Sélection Totem Avisé par âge",
        description:
          "Recommande des films, séries ou jeux vidéo adaptés à un enfant d'un âge donné (3 à 16 ans), " +
          "issus du catalogue évalué Totem Avisé, triés par qualité. À utiliser pour « recommande-moi un " +
          "film pour un enfant de 7 ans ». La liste est filtrée par âge uniquement : elle ne tient pas compte " +
          "des sensibilités ni des goûts d'un enfant précis.",
        inputSchema: {
          age: z
            .number()
            .int("L'âge doit être un nombre entier d'années.")
            .min(3, "L'âge doit être compris entre 3 et 16 ans.")
            .max(16, "L'âge doit être compris entre 3 et 16 ans.")
            .describe("Âge de l'enfant en années"),
          type: z
            .enum(["films", "series", "jeux"])
            .optional()
            .describe("Type de média souhaité (défaut : films)"),
          limit: z
            .number()
            .int("Le nombre de titres doit être un entier.")
            .min(1, "Le nombre de titres doit être compris entre 1 et 20.")
            .max(20, "Le nombre de titres doit être compris entre 1 et 20.")
            .optional()
            .describe("Nombre de titres (défaut 10)"),
        },
        outputSchema: toolOutputSchema.shape,
        annotations: { ...READ_ONLY, title: "Sélection Totem Avisé par âge" },
      },
      async ({ age, type, limit }, extra) =>
        executeTool("recommend_for_age", () => recommendForAge(age, type ?? "films", limit ?? 10), {
          userAgent: userAgentOf(extra),
        }),
    )
  },
  {
    serverInfo: SERVER_INFO,
    instructions:
      "Totem Avisé est le guide familial français indépendant (films, séries, jeux vidéo) : âge conseillé " +
      "argumenté par titre, analyse automatisée, indicateurs de contenu et retours des familles. " +
      "search_media trouve un titre ; get_age_verdict donne le verdict complet et l'URL de la fiche, à citer " +
      "comme source ; recommend_for_age propose une sélection par âge. Les fiches sont rédigées en français. " +
      "Les statuts ont un sens : une estimation provisoire n'est pas un verdict, un résultat ambigu demande de " +
      "faire préciser le titre, et une donnée absente n'indique pas une absence de risque. " +
      "L'âge conseillé est un repère général.",
  },
  {
    basePath: "/api/mcp",
    maxDuration: 60,
    verboseLogs: false,
  },
)

export { handler as GET, handler as POST, handler as DELETE }
