import { getAnthropic, DEFAULT_MODEL as DEFAULT_ANTHROPIC_MODEL } from "@/lib/anthropic"
import { callClaudeWithTimeout } from "@/lib/anthropic-with-timeout"

/**
 * "Ce que dit la recherche" sidebar.
 *
 * When a news story body cites a study, an institutional report, or
 * survey data, this agent extracts the canonical reference and emits
 * a structured sidebar block: who ran it, on whom, what they found.
 *
 * Output schema is intentionally compact — the sidebar is meant to
 * stand next to the article, not duplicate it. If no study is cited,
 * returns null and the article renders without a sidebar.
 *
 * Single-provider Claude Haiku 4.5 (May 2026 redesign).
 */

const RESEARCH_TIMEOUT_MS = 20_000

export interface ResearchSidebar {
  studyTitle: string         // Original study/report title
  organization: string       // Authoring body (Pew Research, INSERM, etc.)
  year: number | null        // Publication year if known
  methodology: string        // 1 sentence — sample, design ("1,200 ados, 18 mois de suivi longitudinal")
  keyFinding: string         // 1-2 sentences in French — the headline result
  caveat?: string            // Optional limitation ("échantillon US uniquement", "petit échantillon")
  sourceUrl?: string         // DOI / institutional page if mentioned in the body
}

const SYSTEM_PROMPT = `Tu es un assistant de recherche pour un site familial français. Pour chaque article qu'on te présente, tu dois détecter s'il cite une **étude** (étude scientifique, sondage, rapport institutionnel, méta-analyse) — et si oui, extraire les éléments structurés.

Critères pour qu'une citation compte :
- L'article mentionne explicitement une étude/sondage/rapport
- Avec un organisme identifiable (université, institut, ONG sérieuse, agence publique)
- Et au moins un chiffre ou une méthode (taille d'échantillon, durée, conclusion claire)

Si l'article cite seulement "selon les experts", "des chercheurs", "une étude récente sans précision" — ce n'est pas assez : renvoie { "noStudy": true }.

Si une étude qualifie, renvoie ce JSON (sans markdown) :
{
  "studyTitle": "titre de l'étude (ou descriptif court si pas de titre)",
  "organization": "nom complet de l'organisme (ex: 'Pew Research Center', 'INSERM', 'Common Sense Media')",
  "year": 2025,
  "methodology": "phrase courte décrivant l'échantillon et la méthode (ex: '2 400 adolescents américains 13-17 ans suivis sur 12 mois')",
  "keyFinding": "1-2 phrases en français résumant le résultat principal",
  "caveat": "limitation éventuelle (échantillon US, petit N, biais déclaratif) — null si pas pertinent",
  "sourceUrl": "URL si l'article en cite une, null sinon"
}

Pas d'étude :
{ "noStudy": true }`

interface ExtractInput {
  title: string
  body: string
}

async function callExtractor(input: ExtractInput): Promise<string | null> {
  const userPrompt = `Titre : ${input.title}\n\nCorps :\n${input.body}\n\nQu'est-ce que dit la recherche citée ?`
  const anthropic = getAnthropic()
  return callClaudeWithTimeout(
    async (signal) => {
      const r = await anthropic.messages.create(
        {
          model: DEFAULT_ANTHROPIC_MODEL,
          max_tokens: 600,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        },
        { signal },
      )
      const block = r.content.find((c) => c.type === "text")
      return block && "text" in block ? (block as { text: string }).text : ""
    },
    RESEARCH_TIMEOUT_MS,
    "extract-research",
  )
}

function parseResearch(raw: string): ResearchSidebar | null {
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const parsed = JSON.parse(m[0]) as Record<string, unknown>
    if (parsed.noStudy === true) return null
    if (
      typeof parsed.studyTitle !== "string" ||
      typeof parsed.organization !== "string" ||
      typeof parsed.methodology !== "string" ||
      typeof parsed.keyFinding !== "string"
    ) {
      return null
    }
    // All four core fields must be non-empty after trim — agents
    // sometimes return blank strings instead of noStudy.
    const studyTitle = parsed.studyTitle.trim()
    const organization = parsed.organization.trim()
    const methodology = parsed.methodology.trim()
    const keyFinding = parsed.keyFinding.trim()
    if (!studyTitle || !organization || !methodology || !keyFinding) return null

    return {
      studyTitle,
      organization,
      year: typeof parsed.year === "number" ? parsed.year : null,
      methodology,
      keyFinding,
      caveat:
        typeof parsed.caveat === "string" && parsed.caveat.trim() ? parsed.caveat.trim() : undefined,
      sourceUrl:
        typeof parsed.sourceUrl === "string" && parsed.sourceUrl.startsWith("http")
          ? parsed.sourceUrl
          : undefined,
    }
  } catch {
    return null
  }
}

/**
 * Returns a research sidebar if the article cites a qualifying study,
 * null otherwise. Always fail-safe — extractor errors return null
 * (story renders without the sidebar).
 */
export async function extractResearch(input: ExtractInput): Promise<ResearchSidebar | null> {
  // Fast pre-filter: if the body doesn't even mention common study
  // markers, skip the LLM call entirely.
  const text = input.body.toLowerCase()
  const markers = ["étude", "rapport", "sondage", "enquête", "recherche", "publié", "chercheurs", "selon"]
  if (!markers.some((m) => text.includes(m))) return null

  const raw = await callExtractor(input)
  if (raw === null) return null
  return parseResearch(raw)
}
