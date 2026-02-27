import { test, expect } from "@playwright/test"

// Dismiss cookie consent banner before each test
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("cookie-consent", "accepted")
  })
})

test.describe("Responsive / Mobile", () => {
  test("homepage renders on mobile without horizontal overflow", async ({ page }) => {
    await page.goto("/")
    await expect(
      page.getByPlaceholder(/Rechercher/i).first()
    ).toBeVisible()
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5)
  })

  test("mobile hamburger menu opens and shows nav links", async ({ page }) => {
    await page.goto("/")
    // Find the mobile menu toggle button in the header
    const menuButton = page.locator("header button[aria-label], header button").filter({
      has: page.locator("svg"),
    }).first()
    await menuButton.click()
    // Mobile menu should show navigation links
    await expect(page.getByRole("link", { name: "Films" }).first()).toBeVisible()
  })

  test("/films page renders on mobile without overflow", async ({ page }) => {
    await page.goto("/films")
    await expect(
      page.getByRole("heading", { level: 1 }).first()
    ).toBeVisible()
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5)
  })
})
