import { test as base, expect, type Page } from "@playwright/test"

export interface SeededFamily {
  user: { id: string; email: string; password: string }
  members: {
    child: { id: string; name: string; age: number }
    sibling: { id: string; name: string; age: number }
  }
  media: {
    horror: { id: string }
    family: { id: string }
  }
}

// Calls the dev-only seed route. Returns the deterministic ids so tests can
// pin against them without scraping the UI.
export async function seedFamily(page: Page): Promise<SeededFamily> {
  const response = await page.request.post("/api/test/seed-family")
  if (!response.ok()) {
    throw new Error(
      `Seed route failed (${response.status()}). Make sure NODE_ENV !== 'production' or ALLOW_TEST_SEED=true.`,
    )
  }
  return (await response.json()) as SeededFamily
}

// Signs the test user in via the email/password form. Verifies the redirect
// to /profil before yielding control back to the spec.
export async function signInAs(
  page: Page,
  user: { email: string; password: string },
) {
  await page.goto("/connexion")
  await page.locator("#email").fill(user.email)
  await page.locator("#password").fill(user.password)
  await page.getByRole("button", { name: /Se connecter/i }).click()
  await expect(page).toHaveURL(/\/profil/, { timeout: 30_000 })
}

/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixture callback (`use`) is unrelated to React hooks */
export const test = base.extend<{ seededFamily: SeededFamily }>({
  seededFamily: async ({ page }, use) => {
    const seeded = await seedFamily(page)
    await signInAs(page, seeded.user)
    await use(seeded)
  },
})
/* eslint-enable react-hooks/rules-of-hooks */

export { expect }
