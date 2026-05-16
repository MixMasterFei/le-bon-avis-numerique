import { test, expect } from "./fixtures/test-family"

test.describe("Family recommendations", () => {
  test("the profile page renders per-member recommendations without disliked genres", async ({
    page,
    seededFamily,
  }) => {
    await page.goto("/profil")
    await page.waitForLoadState("networkidle")

    // The Family Recommendations section heading.
    await expect(
      page.getByRole("heading", { name: /recommandations|à découvrir/i }).first(),
    ).toBeVisible({ timeout: 30_000 })

    // Read full page text and assert no disliked genre leaks through. (Horror
    // is in dislikedGenres for both seeded members.)
    const text = (await page.locator("body").innerText()).toLowerCase()
    expect(text).not.toContain("test horror movie (e2e)")

    expect(seededFamily.members.child.id).toBeTruthy()
  })

  test("the seeded family-friendly title is reachable and its fit card renders", async ({
    page,
    seededFamily,
  }) => {
    await page.goto(`/media/${seededFamily.media.family.id}`)
    await expect(page.getByText(/Test Family Movie/i)).toBeVisible({ timeout: 15_000 })
    // Family-fit card surfaces some indicator (score, level, or member badge).
    // Stay loose on the exact copy.
    await expect(
      page.getByText(/Adapté|Convient|Famille|fit/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })
})
