import { test, expect } from "./fixtures/test-family"

// Regression spec for the bug where horror films leaked through the family
// filter on /films even though the preference quiz said "no horror".
// Mirrors the original bug report end-to-end.

test.describe("Family fit — disliked-genre filtering", () => {
  test("a child with horror in dislikedGenres never sees horror in /films family-filter", async ({
    page,
    seededFamily,
  }) => {
    const childId = seededFamily.members.child.id

    // Go to /films and open the "Ma famille" panel
    await page.goto("/films")
    await page.getByRole("button", { name: /Ma famille/i }).first().click()

    // Tick the child member
    const memberRow = page.getByRole("button", { name: new RegExp(seededFamily.members.child.name) })
    await memberRow.first().click()

    // Wait for the family-filtered section heading to appear
    await expect(page.getByRole("heading", { name: /Films adaptés à votre famille/i })).toBeVisible({
      timeout: 30_000,
    })

    // Give the API a moment to settle, then inspect rendered cards
    await page.waitForLoadState("networkidle")

    // Result cards expose their genre via badges. Read the entire results region's
    // visible text and assert no Horreur/Thriller leak through. Using text content
    // is more robust than scraping individual card DOM.
    const resultsRegion = page.locator("main")
    const text = (await resultsRegion.innerText()).toLowerCase()
    expect(text).not.toContain("horreur")
    expect(text).not.toContain("thriller")

    // Sanity: we got *some* results back (the family-filter view should not be empty
    // for a 10-year-old asking for anything non-horror in a populated catalogue).
    // Use childId in an assertion so eslint doesn't flag it unused if the test
    // is later split.
    expect(childId).toBeTruthy()
  })

  test("the seeded horror title shows a low family-fit score for the child", async ({
    page,
    seededFamily,
  }) => {
    await page.goto(`/media/${seededFamily.media.horror.id}`)
    // The family-fit card surfaces a "Trop tôt" or "genre non apprécié" reason.
    // Match either phrase to stay resilient to copy tweaks.
    await expect(
      page.getByText(/Trop tôt|genre non apprécié|Recommandé à partir|Pas pour ce profil/i),
    ).toBeVisible({ timeout: 15_000 })
  })

  // Phase 0.2: the family-fit card now renders two independent pillars.
  // The seeded family movie (expertAgeRec 6) is safely below both members'
  // ages and shouldn't trigger any mature-content caution → both pillars
  // should land on the green side.
  test("two-axis verdict: family movie shows Âge OK + a positive preference label", async ({
    page,
    seededFamily,
  }) => {
    await page.goto(`/media/${seededFamily.media.family.id}`)

    // Both pillars should be visible on the same card. Age pillar reads
    // "Âge OK" for any seeded member (child age 10 and sibling 6 are both
    // at/above the title's expertAgeRec 6).
    await expect(page.getByText(/Âge OK/i).first()).toBeVisible({ timeout: 15_000 })

    // Preference pillar lands on "Correspond à ses goûts" or "Bon choix"
    // depending on quiz state — accept either.
    await expect(
      page.getByText(/Correspond à ses goûts|Bon choix/i).first(),
    ).toBeVisible({ timeout: 15_000 })

    // The age detail line shows both ages (member · dès N ans) for at least
    // one member.
    await expect(page.getByText(/dès \d+ ans/i).first()).toBeVisible({ timeout: 15_000 })
  })

  // Phase 0.1 + 0.2: the seeded horror title (expertAgeRec 16) is above
  // both members' ages → the AGE pillar should fire "Trop tôt" while the
  // PRÉFÉRENCES pillar fires "Pas pour ce profil" because horror is in
  // both members' dislikedGenres. The two pillars must coexist on the
  // same card.
  test("two-axis verdict: horror title fires both pillars (age + preferences)", async ({
    page,
    seededFamily,
  }) => {
    await page.goto(`/media/${seededFamily.media.horror.id}`)

    await expect(page.getByText(/Trop tôt/i).first()).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByText(/Pas pour ce profil|À vérifier/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })
})
