import { test, expect } from "@playwright/test"

// Dismiss cookie consent banner before each test
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("cookie-consent", "accepted")
  })
})

test.describe("Media detail page", () => {
  // These tests involve SSR detail pages which are slow under parallel load
  test.describe.configure({ mode: "serial" })

  // Discover a valid media URL from the API once, reuse across tests
  let mediaPath: string | null = null

  async function getMediaPath(page: import("@playwright/test").Page): Promise<string> {
    if (mediaPath) return mediaPath
    // Fetch a single movie ID from the API (faster than loading full films page)
    const response = await page.request.get("/api/db/movies?limit=1")
    if (response.ok()) {
      const data = await response.json()
      const items = data.items || data.movies || []
      if (items.length > 0) {
        const item = items[0]
        const id = item.id || item.routeId
        if (id) {
          // IDs are already in "movie:UUID" format from the route
          mediaPath = `/media/${id.includes(":") ? id : `movie:${id}`}`
          return mediaPath
        }
      }
    }
    // Fallback: navigate to films page and find first link
    await page.goto("/films")
    const link = page.locator('a[href^="/media/"]').first()
    await expect(link).toBeVisible({ timeout: 30_000 })
    mediaPath = (await link.getAttribute("href"))!
    return mediaPath
  }

  test("renders media detail page with title", async ({ page }) => {
    test.slow()
    const path = await getMediaPath(page)
    await page.goto(path)
    await expect(page).toHaveURL(/\/media\//)
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 })
  })

  test("media detail page contains JSON-LD structured data", async ({ page }) => {
    test.slow()
    const path = await getMediaPath(page)
    await page.goto(path)
    await page.waitForLoadState("domcontentloaded")

    const jsonLdScripts = page.locator('script[type="application/ld+json"]')
    await expect(jsonLdScripts.first()).toBeAttached({ timeout: 15_000 })

    const content = await jsonLdScripts.first().textContent()
    expect(content).toBeTruthy()
    const parsed = JSON.parse(content!)
    expect(parsed["@context"]).toBe("https://schema.org")
  })

  test("media detail page has content tabs", async ({ page }) => {
    test.slow()
    const path = await getMediaPath(page)
    await page.goto(path)

    await expect(page.getByRole("tab").first()).toBeVisible({ timeout: 15_000 })
  })
})
