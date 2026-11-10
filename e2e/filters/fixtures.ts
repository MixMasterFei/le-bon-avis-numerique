import { test as base, expect, type Route } from "@playwright/test"

/**
 * A lighter browser for the catalogue filter suites (/films, /series, /jeux).
 *
 * These suites run against production from a GitHub runner, and Vercel's edge
 * refuses a runner that sends too much: « This request was blocked » about a
 * minute into the Séries suite on 8 and 9 Nov 2026. Measured on 9 Nov, opening
 * /series and changing two filters sent 137 requests to the site; 5 of them
 * (the page, the two filter navigations, the session checks) are what these
 * tests exercise. The rest now stay off the network:
 *
 * - images (54, mostly posters through /_next/image): the tests read titles
 *   and age badges, never pixels, so the browser gets a 1×1 image locally;
 * - link prefetches (45): Next.js prefetches every card in view and no test
 *   follows a card, so they are refused in the browser, as an ad-blocker would;
 * - scripts, styles and fonts under /_next/static/ (33): content-hashed,
 *   immutable files that every test downloaded again, since each test starts
 *   with an empty cache (and request routing turns the HTTP cache off): each
 *   is fetched once per worker, then served from memory.
 *
 * Every page load, filter navigation and API call still reaches production.
 * Each test records the split in a « requests » annotation (HTML report).
 */

/** 1×1 transparent GIF. */
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64")

interface StoredResponse {
  status: number
  headers: Record<string, string>
  body: Buffer
}

/** /_next/static/ files this worker has already fetched, by URL. */
const staticFiles = new Map<string, StoredResponse>()

/** route.fetch() returns a decoded body: replaying these headers would make the browser decode it twice. */
const TRANSPORT_HEADERS = ["content-encoding", "content-length", "transfer-encoding"]

/** Answers `route` and says whether the request reached the network. */
async function handle(route: Route, origin: string): Promise<"network" | "browser"> {
  const request = route.request()
  if (request.resourceType() === "image") {
    await route.fulfill({ status: 200, contentType: "image/gif", body: PIXEL })
    return "browser"
  }
  if (request.headers()["next-router-prefetch"]) {
    await route.abort("blockedbyclient")
    return "browser"
  }
  const url = new URL(request.url())
  if (url.origin === origin && url.pathname.startsWith("/_next/static/")) {
    const stored = staticFiles.get(url.href)
    if (stored) {
      await route.fulfill(stored)
      return "browser"
    }
    const response = await route.fetch().catch(() => null)
    if (!response) {
      await route.continue()
      return "network"
    }
    const headers = { ...response.headers() }
    for (const name of TRANSPORT_HEADERS) delete headers[name]
    const fetched = { status: response.status(), headers, body: await response.body() }
    if (response.ok()) staticFiles.set(url.href, fetched)
    await route.fulfill(fetched)
    return "network"
  }
  await route.continue()
  return "network"
}

export const test = base.extend<{ lightBrowser: void }>({
  lightBrowser: [
    async ({ page, baseURL }, use, testInfo) => {
      const origin = new URL(baseURL ?? "http://localhost:3000").origin
      let toSite = 0
      let keptLocal = 0
      await page.route("**/*", async (route) => {
        const isSite = new URL(route.request().url()).origin === origin
        try {
          const outcome = await handle(route, origin)
          if (outcome === "browser") keptLocal++
          else if (isSite) toSite++
        } catch (error) {
          // The test ended while the request was in flight: nothing left to answer.
          if (!page.isClosed()) throw error
        }
      })
      await use()
      testInfo.annotations.push({
        type: "requests",
        description: `${toSite} sent to the site, ${keptLocal} answered or refused in the browser`,
      })
    },
    { auto: true },
  ],
})

export { expect }
