import { test, expect, type Page } from "@playwright/test"

/**
 * Smoke test for /apercudecouverte-v3 (the family-news flagship page).
 * Two layers:
 *
 * 1. Unauth smoke (always runs): hitting the page while logged out
 *    redirects to /connexion. Catches regressions where the page
 *    crashes server-side before the auth gate fires (e.g. the prior
 *    holidayToSerializable bug).
 *
 * 2. Authenticated smoke (runs only when test creds are provided in
 *    env): logs in, navigates to the page, and asserts that the
 *    structural elements are present — page header, news hero card,
 *    sidebar widgets. Doesn't assert specific story content (which
 *    rotates via cron) but does verify the layout shell renders and
 *    no Server-Components-render error fires.
 *
 * To enable the authenticated smoke, set in the env:
 *   E2E_TEST_USER_EMAIL=...
 *   E2E_TEST_USER_PASSWORD=...
 */

const TEST_EMAIL = process.env.E2E_TEST_USER_EMAIL
const TEST_PASSWORD = process.env.E2E_TEST_USER_PASSWORD

test.describe("Aperçu Découverte v3 — unauthenticated", () => {
  test("redirects to /connexion with next= preserved", async ({ page }) => {
    await page.goto("/apercudecouverte-v3")
    // next= can arrive URL-encoded (%2F) or raw (/) depending on the
    // browser-redirect path — accept either.
    await expect(page).toHaveURL(/\/connexion\?next=(%2F|\/)apercudecouverte-v3/)
  })
})

test.describe("Aperçu Découverte v3 — authenticated smoke", () => {
  // Only runs when credentials are wired up — keeps local + open-source
  // contributors from hitting auth failures they can't fix.
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set E2E_TEST_USER_EMAIL + E2E_TEST_USER_PASSWORD to enable this suite",
  )

  async function login(page: Page) {
    await page.goto("/connexion")
    await page.locator("#email").fill(TEST_EMAIL!)
    await page.locator("#password").fill(TEST_PASSWORD!)
    await page.getByRole("button", { name: /se connecter|connexion/i }).first().click()
    // Wait for the redirect away from /connexion (default lands on /profil)
    await page.waitForURL((url) => !url.pathname.startsWith("/connexion"), {
      timeout: 15_000,
    })
  }

  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await page.evaluate(() => {
      localStorage.setItem("cookie-consent", "accepted")
    })
    await login(page)
  })

  test("page renders without server error and shows the editorial header", async ({ page }) => {
    // Capture any uncaught console errors — a Server Components render
    // failure would surface here as an "Application error".
    const errors: string[] = []
    page.on("pageerror", (err) => errors.push(err.message))
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text())
    })

    await page.goto("/apercudecouverte-v3")
    await expect(page).toHaveURL(/\/apercudecouverte-v3/)

    // Editorial header should always render (server-rendered, no data dep).
    await expect(page.getByText(/Découverte · Aperçu v3/i)).toBeVisible()
    await expect(
      page.getByRole("heading", { name: /L'actualité qui compte/i }),
    ).toBeVisible()

    // No fatal client errors — specifically, we shouldn't see "Application error"
    // which is what the global error boundary renders on Server-Components throws.
    await expect(page.getByText(/Application error/i)).not.toBeVisible()
    await expect(
      page.getByText(/Oups, quelque chose s'est mal passe/i),
    ).not.toBeVisible()

    expect(
      errors.filter((e) => e.includes("Server Components") || e.includes("Application error")),
    ).toEqual([])
  })

  test("renders the Météo famille sidebar widget with city header", async ({ page }) => {
    await page.goto("/apercudecouverte-v3")
    // City badge — defaults to Paris if user hasn't picked one.
    // Match either Paris or any saved city by checking for the
    // Modifier button which always renders next to the city name.
    await expect(
      page.getByRole("button", { name: /changer de ville/i }).first(),
    ).toBeVisible()
  })

  test("renders the Vacances scolaires sidebar widget", async ({ page }) => {
    await page.goto("/apercudecouverte-v3")
    // The widget has zone toggle buttons (A / B / C) — check at least one.
    await expect(
      page.getByRole("button", { name: /Zone B/i }).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("at least one news card renders (hero or brief)", async ({ page }) => {
    await page.goto("/apercudecouverte-v3")
    // Hero / brief cards link to /apercudecouverte/<slug>. Don't pin to
    // a specific story — content rotates via cron — just assert at
    // least one such link exists in the main feed.
    const newsLinks = page.locator('a[href^="/apercudecouverte/"]:not([href$="-v3"])')
    await expect(newsLinks.first()).toBeVisible({ timeout: 10_000 })
    expect(await newsLinks.count()).toBeGreaterThan(0)
  })
})
