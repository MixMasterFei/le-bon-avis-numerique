import { test, expect } from "./fixtures/test-family"

// Smoke check on the community age-vote feature — it's a separate trust
// signal from family-fit scoring (uses the AgeVote table directly).

test.describe("Community age vote — smoke", () => {
  test("age-vote button is visible on a media detail page", async ({ page, seededFamily }) => {
    await page.goto(`/media/${seededFamily.media.family.id}`)
    // The AgeVoteButton renders thumbs-up / thumbs-down or a "D'accord" label.
    // Loose match — copy on the button has tweaked over time.
    await expect(
      page.getByRole("button", { name: /D'accord|Pas d'accord|Voter/i }).first(),
    ).toBeVisible({ timeout: 15_000 })
  })
})
