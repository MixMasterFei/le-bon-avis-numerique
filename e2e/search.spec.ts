import { test, expect } from "@playwright/test"

// Dismiss cookie consent banner before each test
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("cookie-consent", "accepted")
  })
})

test.describe("Search page", () => {
  test("search page renders with heading", async ({ page }) => {
    await page.goto("/recherche")
    await expect(
      page.getByRole("heading", { level: 1, name: /Recherche/i })
    ).toBeVisible()
  })

  test("search with query shows results or no-results message", async ({ page }) => {
    await page.goto("/recherche?q=film")
    await expect(
      page.getByText(/résultat|Aucun résultat|Recherche en cours/i)
    ).toBeVisible({ timeout: 15_000 })
  })

  test("search form submits and updates URL", async ({ page }) => {
    await page.goto("/recherche")
    // Use the main content search input (not header's)
    const input = page.locator("main").getByPlaceholder("Rechercher un film, une série, un jeu...")
    await input.fill("test")
    await page.locator("main").getByRole("button", { name: /Rechercher/i }).click()
    await expect(page).toHaveURL(/\/recherche\?q=test/)
  })

  test("empty state shows suggestion text", async ({ page }) => {
    await page.goto("/recherche")
    await expect(
      page.getByText(/Recherchez des médias/i)
    ).toBeVisible()
  })
})
