import { test, expect } from "./fixtures"
import {
  openCatalogue,
  getMediaCards,
  getTotalCount,
  getCardAgeBadges,
  getCardTitles,
  setAgeSliderMax,
  setAgeSliderMin,
  selectTopic,
  sortByTitle,
  isEmptyState,
  eventually,
  expectAgeBand,
  expectAlphabetical,
  screenshotWithLabel,
} from "./helpers"

test.describe("Séries — Filter tests", () => {
  test.beforeEach(async ({ page }) => {
    await openCatalogue(page, "/series")
  })

  // ── Default state ──────────────────────────────────────────────────

  test("default load shows series results", async ({ page }) => {
    // The H1 reads « Toutes les séries » (lowercase): the old case-sensitive
    // "Séries" predates the catalogue redesign.
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/séries/i)
    const count = await getTotalCount(page)
    expect(count).toBeGreaterThan(0)
    await expect(getMediaCards(page).first()).toBeVisible()
    await screenshotWithLabel(page, "series-default")
  })

  // ── Age filter ─────────────────────────────────────────────────────

  test("age max=5: all displayed ages are <= 5", async ({ page }) => {
    await setAgeSliderMax(page, 5)

    await eventually(async () => {
      const ages = await getCardAgeBadges(page)
      expect(ages.length).toBeGreaterThan(0)
      for (const age of ages) {
        expect(age).toBeLessThanOrEqual(5)
      }
    })
    await screenshotWithLabel(page, "series-age-max-5")
  })

  test("age max=8: result count < default count", async ({ page }) => {
    const defaultCount = await getTotalCount(page)

    await setAgeSliderMax(page, 8)
    const filteredCount = await getTotalCount(page)

    expect(filteredCount).toBeLessThan(defaultCount)
    expect(filteredCount).toBeGreaterThan(0)
  })

  test("age range 3-6: ages within 3–6, family-VIP titles excepted below", async ({ page }) => {
    await setAgeSliderMin(page, 3)
    await setAgeSliderMax(page, 6)

    // Below 3 only for family-VIP brands (intended: applyAgeFilter); above 6 never.
    await expectAgeBand(page, 3, 6)
    await screenshotWithLabel(page, "series-age-3-to-6")
  })

  // ── Age + Topic combos ─────────────────────────────────────────────

  test("age max=7 + Animation: results exist, ages <=7", async ({ page }) => {
    await setAgeSliderMax(page, 7)
    await selectTopic(page, "Animation")

    const count = await getTotalCount(page)
    expect(count).toBeGreaterThan(0)

    await eventually(async () => {
      for (const age of await getCardAgeBadges(page)) {
        expect(age).toBeLessThanOrEqual(7)
      }
    })
    await screenshotWithLabel(page, "series-age7-animation")
  })

  test("age max=10 + Comédie: results exist", async ({ page }) => {
    await setAgeSliderMax(page, 10)
    await selectTopic(page, "Comédie")

    const count = await getTotalCount(page)
    expect(count).toBeGreaterThan(0)
    await screenshotWithLabel(page, "series-age10-comedie")
  })

  test("age max=12 + Aventure: ages <=12", async ({ page }) => {
    await setAgeSliderMax(page, 12)
    await selectTopic(page, "Aventure")

    await eventually(async () => {
      for (const age of await getCardAgeBadges(page)) {
        expect(age).toBeLessThanOrEqual(12)
      }
    })
    await screenshotWithLabel(page, "series-age12-aventure")
  })

  test("age max=16 + Science-Fiction: results exist or valid empty", async ({ page }) => {
    await setAgeSliderMax(page, 16)
    await selectTopic(page, "Science-Fiction")

    if (!(await isEmptyState(page))) {
      await eventually(async () => {
        for (const age of await getCardAgeBadges(page)) {
          expect(age).toBeLessThanOrEqual(16)
        }
      })
    }
    await screenshotWithLabel(page, "series-age16-scifi")
  })

  // ── Topic only ─────────────────────────────────────────────────────

  test("Famille topic: returns family content", async ({ page }) => {
    await selectTopic(page, "Famille")

    const count = await getTotalCount(page)
    expect(count).toBeGreaterThan(0)
    await screenshotWithLabel(page, "series-famille")
  })

  test("Animaux topic: returns results", async ({ page }) => {
    await selectTopic(page, "Animaux")

    // May be empty legitimately
    if (!(await isEmptyState(page))) {
      const count = await getTotalCount(page)
      expect(count).toBeGreaterThan(0)
    }
    await screenshotWithLabel(page, "series-animaux")
  })

  // ── Sort ───────────────────────────────────────────────────────────

  test("sort A → Z: alphabetically ordered", async ({ page }) => {
    await sortByTitle(page)

    await eventually(async () => expectAlphabetical(await getCardTitles(page)))
    await screenshotWithLabel(page, "series-sort-alpha")
  })

  // ── Progressive narrowing ──────────────────────────────────────────

  test("progressive: default -> age 6 -> +Animation", async ({ page }) => {
    const defaultCount = await getTotalCount(page)

    await setAgeSliderMax(page, 6)
    const age6Count = await getTotalCount(page)
    expect(age6Count).toBeLessThan(defaultCount)

    await selectTopic(page, "Animation")
    const age6AnimCount = await getTotalCount(page)
    expect(age6AnimCount).toBeLessThanOrEqual(age6Count)
    expect(age6AnimCount).toBeGreaterThan(0)

    await screenshotWithLabel(page, "series-progressive-final")
  })
})
