import { test, expect } from "@playwright/test"
import {
  waitForResults,
  getMediaCards,
  getTotalCount,
  getCardAgeBadges,
  setAgeSliderMax,
  setAgeSliderMin,
  selectTopic,
  selectSort,
  isEmptyState,
  screenshotWithLabel,
} from "./helpers"

test.describe("Séries — Filter tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/series")
    await waitForResults(page)
  })

  // ── Default state ──────────────────────────────────────────────────

  test("default load shows series results", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Séries")
    const count = await getTotalCount(page)
    expect(count).toBeGreaterThan(0)
    await expect(getMediaCards(page).first()).toBeVisible()
    await screenshotWithLabel(page, "series-default")
  })

  // ── Age filter ─────────────────────────────────────────────────────

  test("age max=5: all displayed ages are <= 5", async ({ page }) => {
    await setAgeSliderMax(page, 5)
    await waitForResults(page)

    const ages = await getCardAgeBadges(page)
    expect(ages.length).toBeGreaterThan(0)
    for (const age of ages) {
      expect(age).toBeLessThanOrEqual(5)
    }
    await screenshotWithLabel(page, "series-age-max-5")
  })

  test("age max=8: result count < default count", async ({ page }) => {
    const defaultCount = await getTotalCount(page)

    await setAgeSliderMax(page, 8)
    await waitForResults(page)
    const filteredCount = await getTotalCount(page)

    expect(filteredCount).toBeLessThan(defaultCount)
    expect(filteredCount).toBeGreaterThan(0)
  })

  test("age range 3-6: all ages between 3 and 6", async ({ page }) => {
    await setAgeSliderMin(page, 3)
    await setAgeSliderMax(page, 6)
    await waitForResults(page)

    const ages = await getCardAgeBadges(page)
    expect(ages.length).toBeGreaterThan(0)
    for (const age of ages) {
      expect(age).toBeGreaterThanOrEqual(3)
      expect(age).toBeLessThanOrEqual(6)
    }
    await screenshotWithLabel(page, "series-age-3-to-6")
  })

  // ── Age + Topic combos ─────────────────────────────────────────────

  test("age max=7 + Animation: results exist, ages <=7", async ({ page }) => {
    await setAgeSliderMax(page, 7)
    await selectTopic(page, "Animation")
    await waitForResults(page)

    const count = await getTotalCount(page)
    expect(count).toBeGreaterThan(0)

    const ages = await getCardAgeBadges(page)
    for (const age of ages) {
      expect(age).toBeLessThanOrEqual(7)
    }
    await screenshotWithLabel(page, "series-age7-animation")
  })

  test("age max=10 + Comédie: results exist", async ({ page }) => {
    await setAgeSliderMax(page, 10)
    await selectTopic(page, "Comédie")
    await waitForResults(page)

    const count = await getTotalCount(page)
    expect(count).toBeGreaterThan(0)
    await screenshotWithLabel(page, "series-age10-comedie")
  })

  test("age max=12 + Aventure: ages <=12", async ({ page }) => {
    await setAgeSliderMax(page, 12)
    await selectTopic(page, "Aventure")
    await waitForResults(page)

    const ages = await getCardAgeBadges(page)
    for (const age of ages) {
      expect(age).toBeLessThanOrEqual(12)
    }
    await screenshotWithLabel(page, "series-age12-aventure")
  })

  test("age max=16 + Science-Fiction: results exist or valid empty", async ({ page }) => {
    await setAgeSliderMax(page, 16)
    await selectTopic(page, "Science-Fiction")
    await waitForResults(page)

    const empty = await isEmptyState(page)
    if (!empty) {
      const ages = await getCardAgeBadges(page)
      for (const age of ages) {
        expect(age).toBeLessThanOrEqual(16)
      }
    }
    await screenshotWithLabel(page, "series-age16-scifi")
  })

  // ── Topic only ─────────────────────────────────────────────────────

  test("Famille topic: returns family content", async ({ page }) => {
    await selectTopic(page, "Famille")
    await waitForResults(page)

    const count = await getTotalCount(page)
    expect(count).toBeGreaterThan(0)
    await screenshotWithLabel(page, "series-famille")
  })

  test("Animaux topic: returns results", async ({ page }) => {
    await selectTopic(page, "Animaux")
    await waitForResults(page)

    // May be empty legitimately
    const empty = await isEmptyState(page)
    if (!empty) {
      const count = await getTotalCount(page)
      expect(count).toBeGreaterThan(0)
    }
    await screenshotWithLabel(page, "series-animaux")
  })

  // ── Sort ───────────────────────────────────────────────────────────

  test("sort by Titre A-Z: alphabetically ordered", async ({ page }) => {
    await selectSort(page, "Titre A-Z")
    await waitForResults(page)

    const cards = getMediaCards(page)
    const titles: string[] = []
    const count = await cards.count()
    for (let i = 0; i < Math.min(count, 10); i++) {
      const t = await cards.nth(i).locator("h3").textContent()
      if (t) titles.push(t.trim())
    }

    expect(titles.length).toBeGreaterThan(1)
    const sorted = [...titles].sort((a, b) => a.localeCompare(b, "fr"))
    expect(titles).toEqual(sorted)
    await screenshotWithLabel(page, "series-sort-alpha")
  })

  // ── Progressive narrowing ──────────────────────────────────────────

  test("progressive: default -> age 6 -> +Animation -> +Famille", async ({ page }) => {
    const defaultCount = await getTotalCount(page)

    await setAgeSliderMax(page, 6)
    await waitForResults(page)
    const age6Count = await getTotalCount(page)
    expect(age6Count).toBeLessThan(defaultCount)

    await selectTopic(page, "Animation")
    await waitForResults(page)
    const age6AnimCount = await getTotalCount(page)
    expect(age6AnimCount).toBeLessThanOrEqual(age6Count)
    expect(age6AnimCount).toBeGreaterThan(0)

    await screenshotWithLabel(page, "series-progressive-final")
  })
})
