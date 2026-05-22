import { test, expect, type Page } from "@playwright/test"
import { seedFamily, signInAs } from "./fixtures/test-family"

/**
 * Smoke + image-quality audit for /apercudecouverte-v4.
 *
 * Layers:
 * 1. Unauth redirect (always runs)
 * 2. Authenticated load + image audit (E2E_TEST_USER_EMAIL/PASSWORD,
 *    or local seed-family when PLAYWRIGHT_BASE_URL is localhost)
 *
 * Env:
 *   E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD — production CI creds
 *   PLAYWRIGHT_BASE_URL — defaults to http://localhost:3000
 */

const TEST_EMAIL = process.env.E2E_TEST_USER_EMAIL
const TEST_PASSWORD = process.env.E2E_TEST_USER_PASSWORD
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000"
const USE_LOCAL_SEED =
  (!TEST_EMAIL || !TEST_PASSWORD) &&
  BASE_URL.includes("localhost")

const BRAND_IP_RE =
  /\b(netflix|disney\+?|prime video|mycanal|canal\+?|tsubasa|anime|manga|minecraft|fortnite|roblox|nintendo|switch|zelda|chatgpt|openai|gemini|youtube|instagram|facebook|meta)\b/i

const STOCK_HOST_RE =
  /\b(pexels\.com|unsplash\.com|images\.pexels\.com|images\.unsplash\.com)\b/i

const CATALOG_HOST_RE =
  /\b(supabase\.co|image\.tmdb\.org|totemavise\.com\/storage|totemavise\.com\/.*catalog)\b/i

interface NewsCardImage {
  src: string
  alt: string
  naturalWidth: number
  naturalHeight: number
  slug: string | null
  title: string | null
}

interface ImageAuditReport {
  loadMs: number
  cardCount: number
  images: NewsCardImage[]
  fallbackCards: NewsCardImage[]
  brokenImages: NewsCardImage[]
  duplicateUrls: string[]
  brandIpWithGenericStock: NewsCardImage[]
  catalogPosterCount: number
  publisherImageCount: number
  stockImageCount: number
  fallbackCount: number
  editorialVisualCount: number
}

function classifyImageUrl(url: string): "fallback" | "catalog" | "stock" | "publisher" | "editorial" | "other" {
  if (url.includes("/api/news/fallback-card")) return "fallback"
  if (CATALOG_HOST_RE.test(url)) return "catalog"
  if (STOCK_HOST_RE.test(url)) return "stock"
  if (url.includes("totemavise.com") && url.includes("fallback")) return "fallback"
  // Editorial brand visuals are fallback cards with seed param
  if (url.includes("/api/news/fallback-card")) return "editorial"
  return "publisher"
}

async function login(page: Page) {
  if (USE_LOCAL_SEED) {
    const seeded = await seedFamily(page)
    await signInAs(page, seeded.user)
    return
  }
  await page.goto("/connexion")
  await page.locator("#email").fill(TEST_EMAIL!)
  await page.locator("#password").fill(TEST_PASSWORD!)
  await page.getByRole("button", { name: /se connecter|connexion/i }).first().click()
  await page.waitForURL((url) => !url.pathname.startsWith("/connexion"), {
    timeout: 15_000,
  })
}

async function collectNewsCardImages(page: Page): Promise<ImageAuditReport> {
  const start = Date.now()

  // Wait for at least one news link — content rotates via cron
  const newsLinks = page.locator('a[href^="/apercudecouverte/"]:not([href$="-v3"]):not([href$="-v4"])')
  await expect(newsLinks.first()).toBeVisible({ timeout: 12_000 })

  const loadMs = Date.now() - start

  const images = await page.evaluate(() => {
    const articles = Array.from(document.querySelectorAll("article"))
    const results: Array<{
      src: string
      alt: string
      naturalWidth: number
      naturalHeight: number
      slug: string | null
      title: string | null
    }> = []

    for (const article of articles) {
      const img = article.querySelector("img")
      if (!img) continue

      const link = article.querySelector('a[href^="/apercudecouverte/"]')
      const href = link?.getAttribute("href") ?? null
      const slug = href?.replace(/^\/apercudecouverte\//, "") ?? null
      const titleEl = article.querySelector("h2, h3")
      const title = titleEl?.textContent?.trim() ?? img.alt ?? null

      results.push({
        src: img.currentSrc || img.src,
        alt: img.alt,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        slug,
        title,
      })
    }
    return results
  })

  const urlCounts = new Map<string, number>()
  for (const img of images) {
    urlCounts.set(img.src, (urlCounts.get(img.src) ?? 0) + 1)
  }
  const duplicateUrls = [...urlCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([url]) => url)

  const fallbackCards = images.filter((img) => img.src.includes("/api/news/fallback-card"))
  const brokenImages = images.filter((img) => img.naturalWidth === 0)

  const brandIpWithGenericStock = images.filter((img) => {
    const text = `${img.title ?? ""} ${img.alt}`
    if (!BRAND_IP_RE.test(text)) return false
    const kind = classifyImageUrl(img.src)
    return kind === "stock" || kind === "fallback"
  })

  let catalogPosterCount = 0
  let publisherImageCount = 0
  let stockImageCount = 0
  let fallbackCount = 0
  let editorialVisualCount = 0

  for (const img of images) {
    const kind = classifyImageUrl(img.src)
    if (kind === "catalog") catalogPosterCount++
    else if (kind === "stock") stockImageCount++
    else if (kind === "fallback") {
      fallbackCount++
      if (BRAND_IP_RE.test(`${img.title ?? ""} ${img.alt}`)) editorialVisualCount++
    } else if (kind === "publisher") publisherImageCount++
  }

  return {
    loadMs,
    cardCount: images.length,
    images,
    fallbackCards,
    brokenImages,
    duplicateUrls,
    brandIpWithGenericStock,
    catalogPosterCount,
    publisherImageCount,
    stockImageCount,
    fallbackCount,
    editorialVisualCount,
  }
}

test.describe("Aperçu Découverte v4 — unauthenticated", () => {
  test("redirects to /connexion with callbackUrl preserved", async ({ page }) => {
    await page.goto("/apercudecouverte-v4")
    await expect(page).toHaveURL(/\/connexion\?callbackUrl=(%2F|\/)apercudecouverte-v4/)
  })
})

test.describe("Aperçu Découverte v4 — authenticated", () => {
  test.skip(
    (!TEST_EMAIL || !TEST_PASSWORD) && !USE_LOCAL_SEED,
    "Set E2E_TEST_USER_EMAIL + E2E_TEST_USER_PASSWORD, or run against localhost for seed auth",
  )

  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await page.evaluate(() => {
      localStorage.setItem("cookie-consent", "accepted")
    })
    await login(page)
  })

  test("page loads within 8s and renders news cards", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (err) => errors.push(err.message))

    const navStart = Date.now()
    await page.goto("/apercudecouverte-v4", { waitUntil: "domcontentloaded" })
    await expect(page).toHaveURL(/\/apercudecouverte-v4/)

    await expect(page.getByRole("heading", { name: /L'actualité qui compte/i })).toBeVisible({
      timeout: 8_000,
    })

    const ttfbMs = Date.now() - navStart
    expect(ttfbMs).toBeLessThan(8_000)

    await expect(page.getByText(/Application error/i)).not.toBeVisible()
    expect(errors.filter((e) => e.includes("Server Components"))).toEqual([])
  })

  test("image audit — collect quality signals and flag issues", async ({ page }, testInfo) => {
    await page.goto("/apercudecouverte-v4")

    const report = await collectNewsCardImages(page)

    // Attach structured report for CI artifacts
    await testInfo.attach("v4-image-audit.json", {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    })

    // Screenshot hero + first grid row
    const hero = page.locator("article").first()
    if (await hero.isVisible()) {
      await hero.screenshot({ path: testInfo.outputPath("v4-hero.png") })
    }
    const grid = page.locator("article").nth(3)
    if (await grid.isVisible()) {
      await grid.screenshot({ path: testInfo.outputPath("v4-grid-row.png") })
    }

    // Log summary for CI console
    console.log("[v4-image-audit]", {
      loadMs: report.loadMs,
      cardCount: report.cardCount,
      catalogPosterCount: report.catalogPosterCount,
      publisherImageCount: report.publisherImageCount,
      stockImageCount: report.stockImageCount,
      fallbackCount: report.fallbackCount,
      editorialVisualCount: report.editorialVisualCount,
      brokenCount: report.brokenImages.length,
      duplicateCount: report.duplicateUrls.length,
      brandIpGenericCount: report.brandIpWithGenericStock.length,
    })

    // Hard assertions — tune thresholds as V4 matures
    expect(report.cardCount).toBeGreaterThan(0)
    expect(report.brokenImages).toEqual([])

    // Fallback cards are acceptable for some stories, but a page dominated
    // by them signals prewarm/catalog gaps. Warn via soft expect.
    const fallbackRatio = report.fallbackCount / Math.max(report.cardCount, 1)
    expect.soft(fallbackRatio).toBeLessThan(0.5)

    // Brand/IP stories should not show generic stock when editorial visual exists
    expect.soft(report.brandIpWithGenericStock).toEqual([])

    // No duplicate non-fallback images on the same page
    const nonFallbackDupes = report.duplicateUrls.filter(
      (url) => !url.includes("/api/news/fallback-card"),
    )
    expect.soft(nonFallbackDupes).toEqual([])
  })

  test("load performance — domcontentloaded under 8s", async ({ page }) => {
    const start = Date.now()
    const response = await page.goto("/apercudecouverte-v4", { waitUntil: "domcontentloaded" })
    const elapsed = Date.now() - start

    expect(response?.ok()).toBeTruthy()
    expect(elapsed).toBeLessThan(8_000)

    await expect(
      page.locator('a[href^="/apercudecouverte/"]:not([href$="-v3"]):not([href$="-v4"])').first(),
    ).toBeVisible({ timeout: 8_000 })
  })
})
