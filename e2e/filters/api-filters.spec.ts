import { test, expect } from "@playwright/test"

/**
 * API-level filter tests — faster and less fragile than E2E.
 * Tests the actual data contract from the API endpoints.
 * Runs against production (PLAYWRIGHT_BASE_URL) or localhost.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000"

interface MovieItem {
  id: string
  title: string
  expertAgeRec: number | null
  genres: string[]
  topics: string[]
  platforms: string[]
  releaseDate: string | null
}

interface ApiResponse<T> {
  movies?: T[]
  series?: T[]
  games?: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

async function fetchApi<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE}${path}`)
  expect(res.ok, `API ${path} returned ${res.status}`).toBe(true)
  return res.json()
}

// ── Movies API ─────────────────────────────────────────────────────

test.describe("API: /api/db/movies filters", () => {
  test("default returns movies with pagination", async () => {
    const data = await fetchApi<MovieItem>("/api/db/movies?limit=10&requirePoster=true&language=fr,en")
    expect(data.movies).toBeDefined()
    expect(data.movies!.length).toBeGreaterThan(0)
    expect(data.pagination.total).toBeGreaterThan(0)
  })

  test("maxAge=5: all expertAgeRec <= 5", async () => {
    const data = await fetchApi<MovieItem>("/api/db/movies?maxAge=5&limit=24&requirePoster=true&language=fr,en")
    expect(data.movies!.length).toBeGreaterThan(0)
    for (const movie of data.movies!) {
      expect(movie.expertAgeRec).not.toBeNull()
      expect(movie.expertAgeRec!).toBeLessThanOrEqual(5)
    }
  })

  test("maxAge=3: all expertAgeRec <= 3", async () => {
    const data = await fetchApi<MovieItem>("/api/db/movies?maxAge=3&limit=24&requirePoster=true&language=fr,en")
    expect(data.movies!.length).toBeGreaterThan(0)
    for (const movie of data.movies!) {
      expect(movie.expertAgeRec!).toBeLessThanOrEqual(3)
    }
  })

  test("minAge=6&maxAge=10: ages in range", async () => {
    const data = await fetchApi<MovieItem>("/api/db/movies?minAge=6&maxAge=10&limit=24&requirePoster=true&language=fr,en")
    expect(data.movies!.length).toBeGreaterThan(0)
    for (const movie of data.movies!) {
      expect(movie.expertAgeRec!).toBeGreaterThanOrEqual(6)
      expect(movie.expertAgeRec!).toBeLessThanOrEqual(10)
    }
  })

  test("maxAge=7 + topics=Animation: narrower than age alone", async () => {
    const ageOnly = await fetchApi<MovieItem>("/api/db/movies?maxAge=7&limit=24&requirePoster=true&language=fr,en")
    const combo = await fetchApi<MovieItem>("/api/db/movies?maxAge=7&topics=Animation&limit=24&requirePoster=true&language=fr,en")

    expect(combo.pagination.total).toBeLessThanOrEqual(ageOnly.pagination.total)
    expect(combo.movies!.length).toBeGreaterThan(0)
    for (const movie of combo.movies!) {
      expect(movie.expertAgeRec!).toBeLessThanOrEqual(7)
    }
  })

  test("topics=Comédie: returns comedy movies", async () => {
    const data = await fetchApi<MovieItem>("/api/db/movies?topics=Comédie&limit=24&requirePoster=true&language=fr,en")
    expect(data.movies!.length).toBeGreaterThan(0)
    // At least some movies should have Comedy in genres or topics
    const hasMatch = data.movies!.some(
      m => m.genres.some(g => g.toLowerCase().includes("comédie") || g.toLowerCase().includes("comedy"))
        || m.topics?.some(t => t.toLowerCase().includes("comédie"))
    )
    expect(hasMatch).toBe(true)
  })

  test("maxAge=12 + topics=Aventure: adventure films for 12 and under", async () => {
    const data = await fetchApi<MovieItem>("/api/db/movies?maxAge=12&topics=Aventure&limit=24&requirePoster=true&language=fr,en")
    expect(data.movies!.length).toBeGreaterThan(0)
    for (const movie of data.movies!) {
      expect(movie.expertAgeRec!).toBeLessThanOrEqual(12)
    }
  })

  test("search q=dragon: titles contain search term", async () => {
    const data = await fetchApi<MovieItem>("/api/db/movies?q=dragon&limit=24&language=all")
    if (data.movies!.length > 0) {
      const hasMatch = data.movies!.some(
        m => m.title.toLowerCase().includes("dragon")
      )
      expect(hasMatch).toBe(true)
    }
  })

  test("sortBy=title: titles are alphabetically sorted", async () => {
    const data = await fetchApi<MovieItem>("/api/db/movies?sortBy=title&limit=20&requirePoster=true&language=fr,en")
    const titles = data.movies!.map(m => m.title)
    const sorted = [...titles].sort((a, b) => a.localeCompare(b, "fr"))
    expect(titles).toEqual(sorted)
  })

  test("no future movies: all releaseDates are in the past", async () => {
    const data = await fetchApi<MovieItem>("/api/db/movies?limit=50&language=all")
    const now = new Date()
    for (const movie of data.movies!) {
      if (movie.releaseDate) {
        expect(new Date(movie.releaseDate).getTime()).toBeLessThanOrEqual(now.getTime() + 86400000) // +1 day buffer for timezone
      }
    }
  })

  test("pagination: page 2 has different results than page 1", async () => {
    const p1 = await fetchApi<MovieItem>("/api/db/movies?page=1&limit=10&requirePoster=true&language=fr,en")
    const p2 = await fetchApi<MovieItem>("/api/db/movies?page=2&limit=10&requirePoster=true&language=fr,en")
    if (p1.pagination.totalPages > 1) {
      const p1Ids = new Set(p1.movies!.map(m => m.id))
      const p2Ids = new Set(p2.movies!.map(m => m.id))
      // No overlap
      for (const id of p2Ids) {
        expect(p1Ids.has(id)).toBe(false)
      }
    }
  })
})

// ── Series API ─────────────────────────────────────────────────────

test.describe("API: /api/db/series filters", () => {
  test("default returns series", async () => {
    const data = await fetchApi<MovieItem>("/api/db/series?limit=10&requirePoster=true&language=fr,en")
    expect(data.series).toBeDefined()
    expect(data.series!.length).toBeGreaterThan(0)
  })

  test("maxAge=5: all ages <= 5", async () => {
    const data = await fetchApi<MovieItem>("/api/db/series?maxAge=5&limit=24&requirePoster=true&language=fr,en")
    expect(data.series!.length).toBeGreaterThan(0)
    for (const s of data.series!) {
      expect(s.expertAgeRec!).toBeLessThanOrEqual(5)
    }
  })

  test("maxAge=8 + topics=Animation: narrower results", async () => {
    const ageOnly = await fetchApi<MovieItem>("/api/db/series?maxAge=8&limit=24&requirePoster=true&language=fr,en")
    const combo = await fetchApi<MovieItem>("/api/db/series?maxAge=8&topics=Animation&limit=24&requirePoster=true&language=fr,en")

    expect(combo.pagination.total).toBeLessThanOrEqual(ageOnly.pagination.total)
    for (const s of combo.series!) {
      expect(s.expertAgeRec!).toBeLessThanOrEqual(8)
    }
  })

  test("sortBy=title: alphabetical order", async () => {
    const data = await fetchApi<MovieItem>("/api/db/series?sortBy=title&limit=20&requirePoster=true&language=fr,en")
    const titles = data.series!.map(s => s.title)
    const sorted = [...titles].sort((a, b) => a.localeCompare(b, "fr"))
    expect(titles).toEqual(sorted)
  })
})

// ── Games API ──────────────────────────────────────────────────────

test.describe("API: /api/db/games filters", () => {
  test("default returns games", async () => {
    const data = await fetchApi<MovieItem>("/api/db/games?limit=10")
    expect(data.games).toBeDefined()
    expect(data.games!.length).toBeGreaterThan(0)
  })

  test("maxAge=7: all ages <= 7", async () => {
    const data = await fetchApi<MovieItem>("/api/db/games?maxAge=7&limit=24")
    expect(data.games!.length).toBeGreaterThan(0)
    for (const g of data.games!) {
      expect(g.expertAgeRec!).toBeLessThanOrEqual(7)
    }
  })

  test("maxAge=10 + topics=Aventure: adventure games for kids", async () => {
    const data = await fetchApi<MovieItem>("/api/db/games?maxAge=10&topics=Aventure&limit=24")
    if (data.games!.length > 0) {
      for (const g of data.games!) {
        expect(g.expertAgeRec!).toBeLessThanOrEqual(10)
      }
    }
  })

  test("platform=Switch: returns Switch games", async () => {
    const data = await fetchApi<MovieItem>("/api/db/games?platform=Switch&limit=24")
    if (data.games!.length > 0) {
      for (const g of data.games!) {
        const hasSwitch = g.platforms.some(p =>
          p.toLowerCase().includes("switch")
        )
        expect(hasSwitch).toBe(true)
      }
    }
  })

  test("maxAge=7 + platform=Switch: family Switch games", async () => {
    const data = await fetchApi<MovieItem>("/api/db/games?maxAge=7&platform=Switch&limit=24")
    if (data.games!.length > 0) {
      for (const g of data.games!) {
        expect(g.expertAgeRec!).toBeLessThanOrEqual(7)
        const hasSwitch = g.platforms.some(p =>
          p.toLowerCase().includes("switch")
        )
        expect(hasSwitch).toBe(true)
      }
    }
  })

  test("sortBy=title: alphabetical order", async () => {
    const data = await fetchApi<MovieItem>("/api/db/games?sortBy=title&limit=20")
    const titles = data.games!.map(g => g.title)
    const sorted = [...titles].sort((a, b) => a.localeCompare(b, "fr"))
    expect(titles).toEqual(sorted)
  })
})

// ── Cross-cutting concerns ─────────────────────────────────────────

test.describe("API: Cross-cutting filter behavior", () => {
  test("narrowing reduces results: movies maxAge=18 > maxAge=10 > maxAge=5", async () => {
    const all = await fetchApi<MovieItem>("/api/db/movies?limit=1&requirePoster=true&language=fr,en")
    const age10 = await fetchApi<MovieItem>("/api/db/movies?maxAge=10&limit=1&requirePoster=true&language=fr,en")
    const age5 = await fetchApi<MovieItem>("/api/db/movies?maxAge=5&limit=1&requirePoster=true&language=fr,en")

    expect(all.pagination.total).toBeGreaterThan(age10.pagination.total)
    expect(age10.pagination.total).toBeGreaterThan(age5.pagination.total)
  })

  test("narrowing reduces results: series maxAge=18 > maxAge=8 > maxAge=4", async () => {
    const all = await fetchApi<MovieItem>("/api/db/series?limit=1&requirePoster=true&language=fr,en")
    const age8 = await fetchApi<MovieItem>("/api/db/series?maxAge=8&limit=1&requirePoster=true&language=fr,en")
    const age4 = await fetchApi<MovieItem>("/api/db/series?maxAge=4&limit=1&requirePoster=true&language=fr,en")

    expect(all.pagination.total).toBeGreaterThan(age8.pagination.total)
    expect(age8.pagination.total).toBeGreaterThan(age4.pagination.total)
  })

  test("all APIs return proper pagination shape", async () => {
    const [movies, series, games] = await Promise.all([
      fetchApi<MovieItem>("/api/db/movies?limit=1"),
      fetchApi<MovieItem>("/api/db/series?limit=1"),
      fetchApi<MovieItem>("/api/db/games?limit=1"),
    ])

    for (const data of [movies, series, games]) {
      expect(data.pagination).toBeDefined()
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.limit).toBe(1)
      expect(data.pagination.total).toBeGreaterThanOrEqual(0)
      expect(data.pagination.totalPages).toBeGreaterThanOrEqual(0)
    }
  })
})
