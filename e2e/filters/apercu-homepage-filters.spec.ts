import { test, expect } from "@playwright/test"

/**
 * Apercu homepage filter-link audit.
 *
 * Every filter link on /apercu promises a certain kind of content.
 * This spec takes every link, extracts its query params, hits the
 * underlying /api/db/movies endpoint, and asserts each returned
 * item respects the implied constraint.
 *
 * The link list below is the single source of truth — adding a new
 * filter link to /apercu means adding it here, and the test will
 * automatically cover it.
 *
 * API-level rather than browser-level: faster, less flaky, closer
 * to the real contract. UI smoke-tests can be added later if needed.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000"

interface ContentMetrics {
  violence?: number
  sexNudity?: number
  language?: number
  substanceUse?: number
  consumerism?: number
}

interface MovieItem {
  id: string
  title: string
  expertAgeRec: number | null
  genres: string[]
  topics: string[]
  contentMetrics: ContentMetrics | null
}

interface ApiResponse {
  movies: MovieItem[]
  pagination: { total: number }
}

interface Expected {
  maxAge?: number
  minAge?: number
  maxViolence?: number
  maxSexual?: number
  maxLanguage?: number
  maxSubstance?: number
  maxConsumerism?: number
  genre?: string
  topic?: string
  // When true, allow an empty result set (e.g. a very narrow bucket
  // like 2-4 ans with zero-tolerance caps might legitimately be empty
  // on a small/pre-launch catalog).
  allowEmpty?: boolean
}

interface LinkCase {
  group: "hero" | "age" | "theme"
  label: string
  href: string
  expect: Expected
}

// ── Single source of truth ─────────────────────────────────────────────
// Keep this list in sync with the UI:
//   - hero chips:  src/components/home-v2/ApercuHero.tsx
//   - age tiles:   src/components/home-v2/apercuTheme.ts APERCU_AGE_BUCKETS
//   - theme tiles: src/components/home-v2/ApercuCollections.tsx THEMES

const LINKS: LinkCase[] = [
  // Group A — hero chips (5)
  { group: "hero", label: "Animation", href: "/films/recherche?genres=Animation",
    expect: { genre: "Animation" } },
  { group: "hero", label: "Soirée famille", href: "/films?maxAge=10&maxViolence=2&maxSexual=1&maxLanguage=1",
    expect: { maxAge: 10, maxViolence: 2, maxSexual: 1, maxLanguage: 1 } },
  { group: "hero", label: "Ados", href: "/films?maxAge=15&maxViolence=3",
    expect: { maxAge: 15, maxViolence: 3 } },
  { group: "hero", label: "Sans violence", href: "/films/recherche?maxViolence=1",
    expect: { maxViolence: 1 } },
  { group: "hero", label: "Écologie", href: "/films/recherche?topics=Nature",
    expect: { topic: "Nature", allowEmpty: true } },

  // Group B — age tiles (6)
  { group: "age", label: "2-4 ans", href: "/films?maxAge=4&maxViolence=0&maxSexual=0&maxLanguage=0&maxSubstance=0",
    expect: { maxAge: 4, maxViolence: 0, maxSexual: 0, maxLanguage: 0, maxSubstance: 0, allowEmpty: true } },
  { group: "age", label: "5-7 ans", href: "/films?maxAge=7&maxViolence=1&maxSexual=0&maxLanguage=1&maxSubstance=0",
    expect: { maxAge: 7, maxViolence: 1, maxSexual: 0, maxLanguage: 1, maxSubstance: 0 } },
  { group: "age", label: "8-10 ans", href: "/films?maxAge=10&maxViolence=2&maxSexual=1&maxLanguage=1&maxSubstance=1",
    expect: { maxAge: 10, maxViolence: 2, maxSexual: 1, maxLanguage: 1, maxSubstance: 1 } },
  { group: "age", label: "11-12 ans", href: "/films?maxAge=12&maxViolence=2&maxSexual=1&maxLanguage=2&maxSubstance=1",
    expect: { maxAge: 12, maxViolence: 2, maxSexual: 1, maxLanguage: 2, maxSubstance: 1 } },
  { group: "age", label: "13-15 ans", href: "/films?maxAge=15&maxViolence=3&maxSexual=2&maxLanguage=3&maxSubstance=2",
    expect: { maxAge: 15, maxViolence: 3, maxSexual: 2, maxLanguage: 3, maxSubstance: 2 } },
  { group: "age", label: "16+ ans", href: "/films?maxAge=99",
    expect: { maxAge: 99 } },

  // Group C — theme tiles (8). Genre-only filtering; no content-metric
  // caps. Users clicking a genre want the full catalog of that genre.
  { group: "theme", label: "Aventure", href: "/films/recherche?genres=Aventure",
    expect: { genre: "Aventure" } },
  { group: "theme", label: "Animation", href: "/films/recherche?genres=Animation",
    expect: { genre: "Animation" } },
  { group: "theme", label: "Fantastique", href: "/films/recherche?genres=Fantastique",
    expect: { genre: "Fantastique", allowEmpty: true } },
  { group: "theme", label: "Comédie", href: "/films/recherche?genres=Comédie",
    expect: { genre: "Comédie" } },
  { group: "theme", label: "Nature", href: "/films/recherche?topics=Nature",
    expect: { topic: "Nature", allowEmpty: true } },
  { group: "theme", label: "Sci-Fi", href: "/films/recherche?genres=Science-Fiction",
    expect: { genre: "Science-Fiction", allowEmpty: true } },
  { group: "theme", label: "Drame", href: "/films/recherche?genres=Drame",
    expect: { genre: "Drame" } },
  { group: "theme", label: "Musique", href: "/films/recherche?genres=Musique",
    expect: { genre: "Musique", allowEmpty: true } },
]

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Translate a homepage link into the underlying API call. Both
 * /films and /films/recherche feed /api/db/movies with the same
 * filter params — we just forward whatever the URL carries.
 */
function hrefToApiUrl(href: string): string {
  const qs = href.includes("?") ? href.split("?")[1] : ""
  const params = new URLSearchParams(qs)
  // The UI pages merge `genres` into `topics` before hitting the API.
  // Mirror that behaviour so the test matches real runtime semantics.
  const genres = params.get("genres")
  if (genres) {
    const existing = params.get("topics")
    params.set("topics", existing ? `${existing},${genres}` : genres)
    params.delete("genres")
  }
  // Reasonable defaults matching the UI's SSR call.
  params.set("limit", params.get("limit") ?? "24")
  params.set("requirePoster", "true")
  params.set("language", params.get("language") ?? "fr,en")
  return `/api/db/movies?${params}`
}

async function fetchMovies(apiPath: string): Promise<ApiResponse> {
  const res = await fetch(`${BASE}${apiPath}`)
  expect(res.ok, `${apiPath} returned ${res.status}`).toBe(true)
  return res.json()
}

function assertMovieMatches(movie: MovieItem, expected: Expected, href: string) {
  // Age
  if (typeof expected.maxAge === "number" && expected.maxAge < 99) {
    expect(movie.expertAgeRec, `[${href}] expertAgeRec null`).not.toBeNull()
    expect(movie.expertAgeRec!, `[${href}] age ${movie.expertAgeRec} > maxAge ${expected.maxAge} (${movie.title})`)
      .toBeLessThanOrEqual(expected.maxAge)
  }
  if (typeof expected.minAge === "number") {
    expect(movie.expertAgeRec!, `[${href}] age ${movie.expertAgeRec} < minAge ${expected.minAge}`)
      .toBeGreaterThanOrEqual(expected.minAge)
  }

  // Content metrics
  const cm = movie.contentMetrics ?? {}
  if (typeof expected.maxViolence === "number") {
    expect(cm.violence ?? 0, `[${href}] violence ${cm.violence} > ${expected.maxViolence} (${movie.title})`)
      .toBeLessThanOrEqual(expected.maxViolence)
  }
  if (typeof expected.maxSexual === "number") {
    expect(cm.sexNudity ?? 0, `[${href}] sexNudity ${cm.sexNudity} > ${expected.maxSexual} (${movie.title})`)
      .toBeLessThanOrEqual(expected.maxSexual)
  }
  if (typeof expected.maxLanguage === "number") {
    expect(cm.language ?? 0, `[${href}] language ${cm.language} > ${expected.maxLanguage} (${movie.title})`)
      .toBeLessThanOrEqual(expected.maxLanguage)
  }
  if (typeof expected.maxSubstance === "number") {
    expect(cm.substanceUse ?? 0, `[${href}] substanceUse ${cm.substanceUse} > ${expected.maxSubstance} (${movie.title})`)
      .toBeLessThanOrEqual(expected.maxSubstance)
  }
  if (typeof expected.maxConsumerism === "number") {
    expect(cm.consumerism ?? 0, `[${href}] consumerism ${cm.consumerism} > ${expected.maxConsumerism}`)
      .toBeLessThanOrEqual(expected.maxConsumerism)
  }

  // Genre / topic
  if (expected.genre) {
    const hasGenre = movie.genres.includes(expected.genre) || movie.topics.includes(expected.genre)
    expect(hasGenre, `[${href}] "${movie.title}" missing genre "${expected.genre}" (has: ${movie.genres.join(", ")})`).toBe(true)
  }
  if (expected.topic) {
    const hasTopic = movie.topics.includes(expected.topic) || movie.genres.includes(expected.topic)
    expect(hasTopic, `[${href}] "${movie.title}" missing topic "${expected.topic}"`).toBe(true)
  }
}

// ── Tests ──────────────────────────────────────────────────────────────

test.describe("Apercu homepage filter audit", () => {
  for (const link of LINKS) {
    test(`${link.group} · ${link.label} · ${link.href}`, async () => {
      const apiUrl = hrefToApiUrl(link.href)
      const data = await fetchMovies(apiUrl)

      if (!link.expect.allowEmpty) {
        expect(data.movies.length, `[${link.href}] returned 0 items — filter is likely too strict or broken`)
          .toBeGreaterThan(0)
      }

      for (const movie of data.movies) {
        assertMovieMatches(movie, link.expect, link.href)
      }
    })
  }

  test("Sans violence regression: every returned item has contentMetrics.violence <= 1", async () => {
    // Extra-paranoid check on the previously-broken chip.
    const data = await fetchMovies(hrefToApiUrl("/films/recherche?maxViolence=1"))
    expect(data.movies.length).toBeGreaterThan(0)
    for (const m of data.movies) {
      expect(m.contentMetrics, `"${m.title}" has no contentMetrics`).not.toBeNull()
      expect(m.contentMetrics!.violence ?? 0).toBeLessThanOrEqual(1)
    }
  })
})
