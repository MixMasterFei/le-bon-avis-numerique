import { test, expect, type Page } from "@playwright/test"

/**
 * Smoke test for /apercudecouverte-v5 (the canonical "Actualités de
 * confiance" feed — trusted/official sources only, admin-only). Mirrors
 * the v3/v4 smoke:
 *
 * 1. Unauth smoke (always runs): hitting the page logged out redirects to
 *    /connexion. Catches server-side crashes before the auth gate fires.
 *
 * 2. Authenticated smoke (only when test creds are in env): logs in,
 *    navigates, and asserts the layout shell renders with no Server-
 *    Components error. V5 is intentionally sparse (strict official gate +
 *    low-volume institutional feeds), so it does NOT assert that a news
 *    card exists — an empty feed renders the "Fil institutionnel" notice,
 *    which is valid. Sidebar widgets always render (no data dependency).
 *
 * Enable the authenticated smoke via:
 *   E2E_TEST_USER_EMAIL=...
 *   E2E_TEST_USER_PASSWORD=...
 */

const TEST_EMAIL = process.env.E2E_TEST_USER_EMAIL
const TEST_PASSWORD = process.env.E2E_TEST_USER_PASSWORD

test.describe("Aperçu Découverte v5 — unauthenticated", () => {
  test("redirects to /connexion with callbackUrl preserved", async ({ page }) => {
    await page.goto("/apercudecouverte-v5")
    await expect(page).toHaveURL(/\/connexion\?callbackUrl=(%2F|\/)apercudecouverte-v5/)
  })

  test("legacy /apercudecouverte-v3 redirects toward v5", async ({ page }) => {
    // V3 is decommissioned → redirect stub to v5. Logged out, the v5 target
    // then bounces to /connexion with the v5 callbackUrl.
    await page.goto("/apercudecouverte-v3")
    await expect(page).toHaveURL(/\/connexion\?callbackUrl=(%2F|\/)apercudecouverte-v5/)
  })
})

test.describe("Aperçu Découverte v5 — authenticated smoke", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set E2E_TEST_USER_EMAIL + E2E_TEST_USER_PASSWORD to enable this suite",
  )

  async function login(page: Page) {
    await page.goto("/connexion")
    await page.locator("#email").fill(TEST_EMAIL!)
    await page.locator("#password").fill(TEST_PASSWORD!)
    await page.getByRole("button", { name: /se connecter|connexion/i }).first().click()
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
    const errors: string[] = []
    page.on("pageerror", (err) => errors.push(err.message))
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text())
    })

    await page.goto("/apercudecouverte-v5")
    await expect(page).toHaveURL(/\/apercudecouverte-v5/)

    await expect(page.getByText(/Découverte · Actualités/i)).toBeVisible()
    await expect(
      page.getByRole("heading", { name: /L'actualité qui compte/i }),
    ).toBeVisible()

    await expect(page.getByText(/Application error/i)).not.toBeVisible()
    await expect(
      page.getByText(/Oups, quelque chose s'est mal passe/i),
    ).not.toBeVisible()

    expect(
      errors.filter((e) => e.includes("Server Components") || e.includes("Application error")),
    ).toEqual([])
  })

  test("renders the Météo famille sidebar widget with city header", async ({ page }) => {
    await page.goto("/apercudecouverte-v5")
    await expect(
      page.getByRole("button", { name: /changer de ville/i }).first(),
    ).toBeVisible()
  })

  test("renders the Vacances scolaires sidebar widget", async ({ page }) => {
    await page.goto("/apercudecouverte-v5")
    await expect(
      page.getByRole("button", { name: /Zone B/i }).first(),
    ).toBeVisible({ timeout: 10_000 })
  })
})
