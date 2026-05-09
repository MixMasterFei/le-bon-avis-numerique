import { prisma } from "@/lib/prisma"

/**
 * Candidate generation for catalog links in news stories.
 *
 * This module intentionally does not decide whether a match is valid.
 * It only turns LLM-extracted title/license terms into plausible
 * catalog candidates. The verifier in news-subject-verify.ts then
 * decides whether the article is genuinely about those works.
 */

export interface LinkableMedia {
  id: string
  title: string
  originalTitle: string | null
  // Type + year are surfaced to the LLM subject verifier so it can
  // disambiguate same-titled works across formats and eras.
  type: string
  releaseYear: number | null
  // Used downstream to gate adult-rated catalog matches into
  // PENDING_REVIEW instead of auto-publishing them on the family page.
  expertAgeRec: number | null
}

interface StoryText {
  title: string
  summary?: string | null
  body: string
}

/**
 * Pre-load a working set of catalog titles for the linkifier.
 */
export async function loadCatalogIndex(): Promise<LinkableMedia[]> {
  const rows = await prisma.mediaItem.findMany({
    where: {
      title: { not: "" },
    },
    orderBy: [
      { tmdbVoteCount: { sort: "desc", nulls: "last" } },
    ],
    take: 5000,
    select: { id: true, title: true, originalTitle: true, type: true, releaseDate: true, expertAgeRec: true },
  })

  return rows
    .filter((r) => r.title.length >= 5)
    .map((r) => ({
      id: r.id,
      title: r.title,
      originalTitle: r.originalTitle,
      type: r.type,
      releaseYear: r.releaseDate ? new Date(r.releaseDate).getFullYear() : null,
      expertAgeRec: r.expertAgeRec,
    }))
}

// Single-word titles that collide with common French/English words.
// They are not removed from the catalog: they just require media
// context before becoming candidates.
const COMMON_WORD_TITLES = new Set<string>([
  "from", "with", "into", "over", "down", "back", "home", "love",
  "life", "time", "year", "good", "best", "first", "last",
  "after", "again", "alone", "alive", "dead", "lost", "found",
  "elle", "elles", "il", "ils", "lui", "toi", "moi", "nous", "vous", "leur", "leurs",
  "tout", "tous", "rien", "alors", "ainsi", "donc", "encore", "meme", "tres",
  "plus", "moins", "aussi", "comme", "voici", "voila", "ici", "celui", "celle",
  "cela", "depuis", "pendant", "avant", "apres", "selon", "dans", "sans",
  "pour", "avec", "par", "sur", "sous", "vers", "chez",
  "phenomene", "ressource", "guide", "carte", "classe", "famille", "familles",
  "enfant", "enfants", "parent", "parents",
  "up", "it", "on", "you", "her", "him", "us", "we",
  "le", "la", "les", "un", "une", "des", "du", "de",
])

const MEDIA_CONTEXT_RE =
  /\b(film|films|cin[ée]ma|long-m[ée]trage|s[ée]rie|s[ée]ries|saison|[ée]pisode|prime video|amazon|netflix|disney\+|jeu|jeux|jeu vid[ée]o|sortie|bande-annonce|casting|acteur|actrice|r[ée]alisateur|r[ée]alisatrice|adaptation|trilogie|saga|franchise|suite|spin-?off|remake|reboot|anniversaire|festival|box-office|streaming|plateforme|livre|roman|manga|bd)\b/i

export function findInCatalog(catalog: LinkableMedia[], id: string): LinkableMedia | undefined {
  return catalog.find((c) => c.id === id)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

function isSingleWordTitle(title: string): boolean {
  return !/[\s:;,.!?()[\]{}|/\\]/.test(title.trim())
}

function startsLowercase(text: string): boolean {
  const first = text.trim().charAt(0)
  return first !== "" && first === first.toLocaleLowerCase("fr-FR") && first !== first.toLocaleUpperCase("fr-FR")
}

function isAmbiguousSingleWordTitle(title: string): boolean {
  return isSingleWordTitle(title) && COMMON_WORD_TITLES.has(normalizeText(title))
}

function storyText(story: StoryText): string {
  return `${story.title}\n${story.summary ?? ""}\n${story.body}`
}

function hasMediaContext(story: StoryText): boolean {
  return MEDIA_CONTEXT_RE.test(storyText(story))
}

function shouldKeepExactMatch(story: StoryText, item: LinkableMedia, matchedText: string): boolean {
  if (!isAmbiguousSingleWordTitle(item.title)) return true
  if (!hasMediaContext(story)) return false

  // In a media article, keep "Elle" / "Up" / similar if the mention is
  // capitalized as a title. Lowercase prose ("elles", "up", "phenomene")
  // still stays out and lets the verifier avoid unnecessary work.
  return !startsLowercase(matchedText)
}

function uniqueNormalizedTerms(terms: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of terms) {
    const term = normalizeText(raw).replace(/\s+/g, " ").trim()
    if (term.length < 3 || seen.has(term) || COMMON_WORD_TITLES.has(term)) continue
    seen.add(term)
    result.push(term)
  }
  return result
}

function titleMatchesSubjectTerm(media: LinkableMedia, term: string): boolean {
  return mediaSearchTitles(media).some((title) => title.includes(term))
}

function isShadowedByLongerTitle(item: LinkableMedia, matches: Array<{ id: string }>, catalog: LinkableMedia[]): boolean {
  const title = normalizeText(item.title)
  return matches.some((match) => {
    const matched = catalog.find((candidate) => candidate.id === match.id)
    if (!matched) return false
    return mediaSearchTitles(matched).some((matchedTitle) =>
      matchedTitle.length > title.length && matchedTitle.includes(title),
    )
  })
}

function mediaSearchTitles(media: LinkableMedia): string[] {
  return [media.title, media.originalTitle ?? ""]
    .map((title) => normalizeText(title).replace(/\s+/g, " ").trim())
    .filter((title, index, all) => title.length > 0 && all.indexOf(title) === index)
}

/**
 * Backward-compatible body-only scanner. Prefer
 * extractCatalogMatchesFromStory when title/summary are available.
 */
export function extractCatalogMatches(
  body: string,
  catalog: LinkableMedia[],
  limit = 3,
): string[] {
  return extractCatalogMatchesFromStory({ title: "", body }, catalog, limit)
}

/**
 * Returns candidate catalog ids in rough relevance order:
 * exact title mentions first, then catalog titles matching the generic
 * subject terms extracted by the LLM.
 */
export function extractCatalogMatchesFromStory(
  story: StoryText,
  catalog: LinkableMedia[],
  limit = 6,
  subjectTerms: string[] = [],
): string[] {
  const text = storyText(story)
  if (!text.trim() || catalog.length === 0) return []

  const normalizedSubjectTerms = hasMediaContext(story) ? uniqueNormalizedTerms(subjectTerms) : []
  const sorted = [...catalog].sort((a, b) => b.title.length - a.title.length)
  const matches: Array<{ id: string; start: number; end: number; score: number }> = []

  for (const item of sorted) {
    if (matches.some((m) => m.id === item.id)) continue
    if (isSingleWordTitle(item.title) && isShadowedByLongerTitle(item, matches, catalog)) continue

    const exact = mediaSearchTitles(item)
      .map((title) => text.match(new RegExp(`\\b${escapeRegex(title)}\\b`, "i")))
      .find((match) => match?.index !== undefined)
    if (exact?.index !== undefined && shouldKeepExactMatch(story, item, exact[0])) {
      const start = exact.index
      const end = start + exact[0].length
      if (matches.some((r) => start < r.end && end > r.start)) continue
      matches.push({ id: item.id, start, end, score: start })
      continue
    }

    const subjectTermIndex = normalizedSubjectTerms.findIndex((term) => titleMatchesSubjectTerm(item, term))
    if (subjectTermIndex >= 0) {
      matches.push({
        id: item.id,
        start: Number.MAX_SAFE_INTEGER,
        end: Number.MAX_SAFE_INTEGER,
        score: 1_000_000 + subjectTermIndex,
      })
    }
  }

  return matches
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((m) => m.id)
}
