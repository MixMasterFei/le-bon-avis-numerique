import { test, expect } from "@playwright/test"

// Dismiss cookie consent banner before each test
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("cookie-consent", "accepted")
  })
})

test.describe("Homepage", () => {
  test("renders hero section with search bar", async ({ page }) => {
    await page.goto("/")
    await expect(
      page.getByText("Le guide de référence pour choisir vos médias en famille")
    ).toBeVisible()
    await expect(
      page.getByPlaceholder("Rechercher un film, une série, un jeu...").first()
    ).toBeVisible()
  })

  test("renders main content sections", async ({ page }) => {
    await page.goto("/")
    const sections = page.locator("section")
    await expect(sections.first()).toBeVisible()
    expect(await sections.count()).toBeGreaterThanOrEqual(3)
  })

  test("renders CTA section with registration link", async ({ page }) => {
    await page.goto("/")
    await expect(
      page.getByRole("link", { name: /Créer un compte gratuit/i })
    ).toBeVisible()
  })

  test("has correct page title and lang attribute", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveTitle(/Totem Avisé/)
    const lang = await page.locator("html").getAttribute("lang")
    expect(lang).toBe("fr")
  })
})
