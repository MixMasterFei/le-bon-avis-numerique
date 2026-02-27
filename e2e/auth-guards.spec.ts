import { test, expect } from "@playwright/test"

test.describe("Authentication guards", () => {
  const protectedRoutes = ["/profil", "/mes-avis", "/ma-liste", "/mes-favoris"]

  for (const route of protectedRoutes) {
    test(`${route} redirects to /connexion when not authenticated`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/connexion/)
    })
  }

  test("login page renders with form fields", async ({ page }) => {
    await page.goto("/connexion")
    await expect(
      page.getByRole("heading", { level: 1, name: /Connexion/i })
    ).toBeVisible()
    await expect(page.locator("#email")).toBeVisible()
    await expect(page.locator("#password")).toBeVisible()
  })

  test("login page has Google OAuth button", async ({ page }) => {
    await page.goto("/connexion")
    await expect(
      page.getByRole("button", { name: /Continuer avec Google/i })
    ).toBeVisible()
  })

  test("login page has forgot password link", async ({ page }) => {
    await page.goto("/connexion")
    await expect(
      page.getByRole("link", { name: /Mot de passe oublié/i })
    ).toBeVisible()
  })
})
