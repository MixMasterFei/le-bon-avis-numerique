import { test, expect } from "@playwright/test"

test.describe("Media listing pages", () => {
  const pages = [
    { path: "/films", heading: /Films/i },
    { path: "/series", heading: /Séries/i },
    { path: "/jeux", heading: /Jeux/i },
    { path: "/livres", heading: /Livres/i },
  ]

  for (const { path, heading } of pages) {
    test(`${path} page loads with correct heading`, async ({ page }) => {
      await page.goto(path)
      await expect(
        page.getByRole("heading", { level: 1 }).first()
      ).toContainText(heading)
    })
  }

  test("/films displays media cards after loading", async ({ page }) => {
    await page.goto("/films")
    // Wait for any loading state to finish
    await page.waitForTimeout(1000)
    const mediaLinks = page.locator('a[href^="/media/"]')
    await expect(mediaLinks.first()).toBeVisible({ timeout: 15_000 })
  })

  test("/films shows total count", async ({ page }) => {
    await page.goto("/films")
    await page.waitForTimeout(1000)
    await expect(page.getByText(/\d+ films?/i)).toBeVisible({ timeout: 15_000 })
  })
})
