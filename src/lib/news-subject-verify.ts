import { getAnthropic, DEFAULT_MODEL } from "@/lib/anthropic"
import { callClaudeWithTimeout } from "@/lib/anthropic-with-timeout"

// LLM verification pass for the catalog linkifier. The text-based
// scan in news-linkify.ts produces *candidate* matches by looking
// for catalog titles in the story body — but it can't tell whether
// the title is the article's actual subject or just a passing
// mention. This verifier asks the model:
//
//   "Of these candidates, which are the article's real media subjects?"
//
// and returns only the subset that the model confirms. Mentions used
// as examples, comparisons, or background ("comme dans Up", "depuis
// Avatar (2009)") are filtered out.
//
// Single-provider Claude Haiku 4.5 (May 2026 redesign).
//
// Failure mode: the verifier is fail-closed. A missing related card is
// much less damaging than a wrong one, because these cards imply that
// the article is actually about a catalog title.

const VERIFY_TIMEOUT_MS = 20_000
const IDENTIFY_TIMEOUT_MS = 20_000

export interface SubjectCandidate {
  id: string
  title: string
  type: string                 // MOVIE | TV | GAME | BOOK | MANGA
  year: number | null          // from releaseDate when present
}

interface StoryContext {
  title: string
  summary: string
  body: string
}

export interface MediaSubjectTerms {
  isMediaNews: boolean
  subjectTerms: string[]
}

const IDENTIFY_SYSTEM_PROMPT = `You decide whether a French family-news article is about one or more specific media works or media franchises.

Media means: film, TV series, video game, book, manga, comic, or a named franchise/license in those domains.

Return:
- isMediaNews: true only if the article's main topic is a specific work, release, anniversary, adaptation, franchise, sequel, remake, platform arrival, creator/casting news, controversy, awards, or availability around a media title/license.
- subjectTerms: search terms to find matching catalog entries. Include the exact work title, the franchise/license name, and closely related work titles that a family catalog may contain. Do NOT include generic terms like "film", "jeu", "Nintendo", "Netflix", "Prime Video", "écrans", "ados", "parents".

Examples:
- Article: "Star Fox revient sur Switch 2, 29 ans après la N64" -> {"isMediaNews":true,"subjectTerms":["Star Fox"]}
- Article: "Le film Le Seigneur des Anneaux : La Communauté de l'Anneau a 25 ans" -> {"isMediaNews":true,"subjectTerms":["Le Seigneur des Anneaux","La Communauté de l'Anneau","Les Deux Tours","Le Retour du roi","Le Hobbit","Les Anneaux de Pouvoir"]}
- Article about teens, screens, online risks, school, science, or parenting in general -> {"isMediaNews":false,"subjectTerms":[]}

Return ONLY a JSON object: {"isMediaNews": boolean, "subjectTerms": ["..."]}. No prose, no markdown, no code fences.`

const SYSTEM_PROMPT = `You verify whether catalog items are real media subjects of a French family-news article.

Given an article and a list of candidate catalog items (films, séries, jeux vidéo, livres), return ONLY items that are real media subjects of the article.

ACCEPT:
  - the specific work the article is fundamentally about
  - other works in the same saga/franchise when the article explicitly discusses that broader saga/franchise. Do not require every related work's exact title to appear in the article if the candidate clearly belongs to the saga being discussed.
  - IMPORTANT example: an anniversary article about "Le Seigneur des Anneaux : La Communauté de l'Anneau" should keep the three Lord of the Rings films, The Hobbit works, and the Amazon Prime series "Les Anneaux de Pouvoir" when those candidates are provided, because they are part of the same Tolkien / Middle-earth franchise context.
  - a candidate with an ambiguous title like "Elle" ONLY if the article clearly says it is about the film/series/game/book with that title

Be strict: if the article is mainly about parenting, schools, screen time, online safety, science, regulation, or another broad topic, return an empty array even if a candidate title appears as a normal word in the body.

REJECT items that:
  - are mentioned only as casual examples, comparisons, or background in an article about another topic ("comme dans X", "à la manière de Y", "depuis le succès de Z")
  - share their title with a common word that happens to appear in the body
  - are referenced via a different work (e.g. "le réalisateur de X" — X is not the subject)
  - appear once with no contextual depth, in an article whose topic is clearly different

Return ONLY a JSON object: {"subjectIds": ["id1", "id2", ...]}. Empty array if none of the candidates is the article's true subject. No prose, no markdown, no code fences.`

function buildPrompt(story: StoryContext, candidates: SubjectCandidate[]): string {
  const candidateBlock = candidates
    .map((c) => {
      const year = c.year ? ` (${c.year})` : ""
      return `  - id="${c.id}" | type=${c.type} | titre="${c.title}"${year}`
    })
    .join("\n")

  return `ARTICLE
Titre : ${story.title}
Résumé : ${story.summary}

Corps :
${story.body}

CANDIDATS DU CATALOGUE
${candidateBlock}

Lesquels (s'il y en a) sont de vrais sujets média de l'article ? Réponds en JSON : {"subjectIds": [...]}.`
}

function buildIdentifyPrompt(story: StoryContext): string {
  return `ARTICLE
Titre : ${story.title}
Résumé : ${story.summary}

Corps :
${story.body}

Cette news est-elle principalement à propos d'un film, d'une série TV, d'un jeu vidéo, d'un livre/manga/BD ou d'une licence média précise ? Si oui, quels termes faut-il chercher dans le catalogue Totem Avisé ?`
}

function parseMediaSubjectTerms(raw: string): MediaSubjectTerms {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "")
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) return { isMediaNews: false, subjectTerms: [] }
  try {
    const parsed = JSON.parse(match[0]) as { isMediaNews?: unknown; subjectTerms?: unknown }
    const isMediaNews = parsed.isMediaNews === true
    const subjectTerms = Array.isArray(parsed.subjectTerms)
      ? parsed.subjectTerms
          .filter((term): term is string => typeof term === "string")
          .map((term) => term.trim())
          .filter((term) => term.length >= 3)
          .slice(0, 12)
      : []
    return { isMediaNews, subjectTerms: isMediaNews ? subjectTerms : [] }
  } catch {
    return { isMediaNews: false, subjectTerms: [] }
  }
}

export async function identifyMediaSubjectTerms(story: StoryContext): Promise<MediaSubjectTerms> {
  const prompt = buildIdentifyPrompt(story)
  const anthropic = getAnthropic()
  const raw = await callClaudeWithTimeout(
    async (signal) => {
      const res = await anthropic.messages.create(
        {
          model: DEFAULT_MODEL,
          max_tokens: 300,
          system: IDENTIFY_SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
        },
        { signal },
      )
      const block = res.content.find((c) => c.type === "text")
      return block && "text" in block ? (block as { text: string }).text : ""
    },
    IDENTIFY_TIMEOUT_MS,
    "media-subject-identify",
  )

  if (raw === null) {
    console.warn(`[media-subject-identify] timed out for "${story.title.slice(0, 60)}"`)
    return { isMediaNews: false, subjectTerms: [] }
  }

  return parseMediaSubjectTerms(raw)
}

function parseSubjectIds(raw: string, candidates: SubjectCandidate[]): string[] {
  // Strip code fences just in case the model adds them despite the
  // "no markdown" instruction.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "")
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) return [] // No object → conservative drop (the model said "none")
  try {
    const parsed = JSON.parse(match[0]) as { subjectIds?: unknown }
    const raw = parsed.subjectIds
    if (!Array.isArray(raw)) return []
    const allowed = new Set(candidates.map((c) => c.id))
    // Only return ids the model was actually shown — guards against
    // hallucinated ids leaking into relatedMediaIds.
    return raw.filter((id): id is string => typeof id === "string" && allowed.has(id))
  } catch {
    return []
  }
}

/**
 * Returns the subset of `candidates` that the LLM confirms is the
 * story's real subject. Order is preserved from the input list (the
 * original linkifier sorts by first-mention position so #1 is the
 * primary subject — we keep that ranking intact for the mini-cards).
 *
 * Fail-closed: any error/timeout returns no subjects. A silently-empty
 * result list is fine; false positives are worse than missing cards.
 */
export async function verifyCatalogSubjects(
  story: StoryContext,
  candidates: SubjectCandidate[],
): Promise<string[]> {
  if (candidates.length === 0) return []

  const prompt = buildPrompt(story, candidates)
  const anthropic = getAnthropic()
  const raw = await callClaudeWithTimeout(
    async (signal) => {
      const res = await anthropic.messages.create(
        {
          model: DEFAULT_MODEL,
          max_tokens: 200,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
        },
        { signal },
      )
      const block = res.content.find((c) => c.type === "text")
      return block && "text" in block ? (block as { text: string }).text : ""
    },
    VERIFY_TIMEOUT_MS,
    "subject-verify",
  )

  if (raw === null) {
    console.warn(
      `[subject-verify] timed out for "${story.title.slice(0, 60)}", dropping ${candidates.length} candidates`,
    )
    return []
  }

  const confirmed = parseSubjectIds(raw, candidates)
  // Preserve original input order (which is first-mention order)
  return candidates.map((c) => c.id).filter((id) => confirmed.includes(id))
}
