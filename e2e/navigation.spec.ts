import { test, expect } from "@playwright/test"

// Dismiss cookie consent banner before each test
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("cookie-consent", "accepted")
  })
})

test.describe("Header navigation", () => {
  test("logo links to homepage", async ({ page }) => {
    await page.goto("/films")
    await page.locator("header").getByRole("link", { name: /Totem/i }).first().click()
    await expect(page).toHaveURL("/")
  })

  test("Films nav link works", async ({ page }) => {
    await page.goto("/")
    await page.locator("header nav").getByRole("link", { name: "Films" }).click()
    await expect(page).toHaveURL("/films")
  })

  test("header search navigates to /recherche", async ({ page }) => {
    await page.goto("/")
    const searchInput = page.locator("header").getByPlaceholder("Rechercher un film, une série, un jeu...")
    await searchInput.fill("Pixar")
    await searchInput.press("Enter")
    await expect(page).toHaveURL(/\/recherche\?q=Pixar/)
  })

  test("unauthenticated user sees Connexion and S'inscrire", async ({ page }) => {
    await page.goto("/")
    await expect(
      page.locator("header").getByRole("link", { name: /Connexion/i })
    ).toBeVisible()
    await expect(
      page.locator("header").getByRole("link", { name: /S'inscrire/i })
    ).toBeVisible()
  })
})

test.describe("Footer navigation", () => {
  test("footer renders browse links", async ({ page }) => {
    await page.goto("/")
    const footer = page.locator("footer")
    await expect(footer.getByRole("link", { name: "Films" })).toBeVisible()
    await expect(footer.getByRole("link", { name: "Séries TV" })).toBeVisible()
    await expect(footer.getByRole("link", { name: "Jeux Vidéo" })).toBeVisible()
    await expect(footer.getByRole("link", { name: "Livres" })).toBeVisible()
  })

  test("footer legal link works", async ({ page }) => {
    await page.goto("/")
    await page.locator("footer").getByRole("link", { name: /Mentions légales/i }).click()
    await expect(page).toHaveURL("/mentions-legales")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })
})
