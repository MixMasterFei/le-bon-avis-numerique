import { test, expect } from "@playwright/test"

test.describe("Static / informational pages", () => {
  const staticPages = [
    { path: "/a-propos", titleContains: /propos/i },
    { path: "/contact", titleContains: /Contact/i },
    { path: "/mentions-legales", titleContains: /Mentions/i },
    { path: "/confidentialite", titleContains: /Confidentialité|Politique/i },
    { path: "/cookies", titleContains: /Cookies/i },
    { path: "/guides", titleContains: /Guide/i },
    { path: "/nos-valeurs", titleContains: /valeurs|notations/i },
    { path: "/objectif", titleContains: /objectif|mission/i },
    { path: "/collections", titleContains: /Collection/i },
  ]

  for (const { path, titleContains } of staticPages) {
    test(`${path} renders with correct heading`, async ({ page }) => {
      const response = await page.goto(path)
      expect(response?.status()).toBeLessThan(400)
      await expect(
        page.getByRole("heading", { level: 1 }).first()
      ).toContainText(titleContains)
    })
  }

  test("404 page renders for unknown routes", async ({ page }) => {
    const response = await page.goto("/page-inexistante-xyz")
    expect(response?.status()).toBe(404)
    await expect(page.getByText("Page introuvable")).toBeVisible()
    await expect(
      page.getByRole("link", { name: /Retour à l'accueil/i })
    ).toBeVisible()
  })

  test("/chez-vous redirects to /connexion for unauthenticated users", async ({ page }) => {
    await page.goto("/chez-vous")
    await expect(page).toHaveURL(/\/connexion/)
  })

  test("robots.txt is accessible", async ({ page }) => {
    const response = await page.goto("/robots.txt")
    expect(response?.status()).toBe(200)
    const text = await page.textContent("body")
    expect(text).toContain("Sitemap")
  })

  test("sitemap.xml is accessible", async ({ page }) => {
    const response = await page.goto("/sitemap.xml")
    expect(response?.status()).toBe(200)
  })
})
