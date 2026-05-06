import { getAnthropic, DEFAULT_MODEL } from "@/lib/anthropic"
import { callClaudeWithTimeout } from "@/lib/anthropic-with-timeout"

// LLM verification pass for the catalog linkifier. The text-based
// scan in news-linkify.ts produces *candidate* matches by looking
// for catalog titles in the story body — but it can't tell whether
// the title is the article's actual subject or just a passing
// mention. This verifier asks the model:
//
//   "Of these candidates, which is the article *fundamentally about*?"
//
// and returns only the subset that the model confirms. Mentions used
// as examples, comparisons, or background ("comme dans Up", "depuis
// Avatar (2009)") are filtered out.
//
// Single-provider Claude Haiku 4.5 (May 2026 redesign).
//
// Failure mode: the verifier is fail-open. Any error / timeout /
// malformed JSON returns the original candidate list unchanged so a
// transient API blip can't silently strip valid related cards.

const VERIFY_TIMEOUT_MS = 20_000

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

const SYSTEM_PROMPT = `You verify whether catalog items are the actual subject of a French family-news article.

Given an article and a list of candidate catalog items (films, séries, jeux vidéo, livres), return ONLY the items that the article is FUNDAMENTALLY ABOUT — meaning the article reports on an event or development concerning that specific work (release, review, news about its creators, controversy, sequel, anniversary, awards…).

REJECT items that:
  - are mentioned only as examples, comparisons, or background ("comme dans X", "à la manière de Y", "depuis le succès de Z")
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

Lesquels (s'il y en a) sont le sujet réel de l'article ? Réponds en JSON : {"subjectIds": [...]}.`
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
 * Fail-open: any error/timeout returns the input candidates unchanged.
 * A silently-empty result list is fine as long as it came from a clean
 * model response; transient failures must not strip valid links.
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
      `[subject-verify] timed out for "${story.title.slice(0, 60)}", keeping all ${candidates.length} candidates`,
    )
    return candidates.map((c) => c.id)
  }

  const confirmed = parseSubjectIds(raw, candidates)
  // Preserve original input order (which is first-mention order)
  return candidates.map((c) => c.id).filter((id) => confirmed.includes(id))
}
