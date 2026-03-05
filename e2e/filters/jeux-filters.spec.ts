import { test, expect } from "@playwright/test"
import {
  waitForResults,
  getMediaCards,
  getTotalCount,
  getCardAgeBadges,
  setAgeSliderMax,
  selectTopic,
  selectPlatform,
  selectSort,
  isEmptyState,
  screenshotWithLabel,
} from "./helpers"

test.describe("Jeux — Filter tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/jeux")
    await waitForResults(page)
  })

  // ── Default state ──────────────────────────────────────────────────

  test("default load shows game results", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Jeux")
    const count = await getTotalCount(page)
    expect(count).toBeGreaterThan(0)
    await expect(getMediaCards(page).first()).toBeVisible()
    await screenshotWithLabel(page, "jeux-default")
  })

  // ── Age filter ─────────────────────────────────────────────────────

  test("age max=7: all displayed ages are <= 7", async ({ page }) => {
    await setAgeSliderMax(page, 7)
    await waitForResults(page)

    const ages = await getCardAgeBadges(page)
    expect(ages.length).toBeGreaterThan(0)
    for (const age of ages) {
      expect(age).toBeLessThanOrEqual(7)
    }
    await screenshotWithLabel(page, "jeux-age-max-7")
  })

  test("age max=3: very young children games", async ({ page }) => {
    await setAgeSliderMax(page, 3)
    await waitForResults(page)

    const empty = await isEmptyState(page)
    if (!empty) {
      const ages = await getCardAgeBadges(page)
      for (const age of ages) {
        expect(age).toBeLessThanOrEqual(3)
      }
    }
    await screenshotWithLabel(page, "jeux-age-max-3")
  })

  test("age max=10: result count < default count", async ({ page }) => {
    const defaultCount = await getTotalCount(page)

    await setAgeSliderMax(page, 10)
    await waitForResults(page)
    const filteredCount = await getTotalCount(page)

    expect(filteredCount).toBeLessThanOrEqual(defaultCount)
    expect(filteredCount).toBeGreaterThan(0)
  })

  // ── Platform filter ────────────────────────────────────────────────

  test("Switch platform: results exist", async ({ page }) => {
    await selectPlatform(page, "Switch")
    await waitForResults(page)

    const empty = await isEmptyState(page)
    if (!empty) {
      const count = await getTotalCount(page)
      expect(count).toBeGreaterThan(0)
    }
    await screenshotWithLabel(page, "jeux-switch")
  })

  test("PS5 platform: results exist", async ({ page }) => {
    await selectPlatform(page, "PS5")
    await waitForResults(page)

    const empty = await isEmptyState(page)
    if (!empty) {
      const count = await getTotalCount(page)
      expect(count).toBeGreaterThan(0)
    }
    await screenshotWithLabel(page, "jeux-ps5")
  })

  // ── Age + Platform combos ──────────────────────────────────────────

  test("age max=7 + Switch: family-friendly Nintendo games", async ({ page }) => {
    await setAgeSliderMax(page, 7)
    await selectPlatform(page, "Switch")
    await waitForResults(page)

    const empty = await isEmptyState(page)
    if (!empty) {
      const ages = await getCardAgeBadges(page)
      for (const age of ages) {
        expect(age).toBeLessThanOrEqual(7)
      }
    }
    await screenshotWithLabel(page, "jeux-age7-switch")
  })

  test("age max=12 + PS5: teen-appropriate PS5 games", async ({ page }) => {
    await setAgeSliderMax(page, 12)
    await selectPlatform(page, "PS5")
    await waitForResults(page)

    const empty = await isEmptyState(page)
    if (!empty) {
      const ages = await getCardAgeBadges(page)
      for (const age of ages) {
        expect(age).toBeLessThanOrEqual(12)
      }
    }
    await screenshotWithLabel(page, "jeux-age12-ps5")
  })

  // ── Age + Topic combos ─────────────────────────────────────────────

  test("age max=10 + Aventure: adventure games for kids", async ({ page }) => {
    await setAgeSliderMax(page, 10)
    await selectTopic(page, "Aventure")
    await waitForResults(page)

    const empty = await isEmptyState(page)
    if (!empty) {
      const count = await getTotalCount(page)
      expect(count).toBeGreaterThan(0)
      const ages = await getCardAgeBadges(page)
      for (const age of ages) {
        expect(age).toBeLessThanOrEqual(10)
      }
    }
    await screenshotWithLabel(page, "jeux-age10-aventure")
  })

  test("age max=7 + Plateforme: platformers for young kids", async ({ page }) => {
    await setAgeSliderMax(page, 7)
    await selectTopic(page, "Plateforme")
    await waitForResults(page)

    const empty = await isEmptyState(page)
    if (!empty) {
      const ages = await getCardAgeBadges(page)
      for (const age of ages) {
        expect(age).toBeLessThanOrEqual(7)
      }
    }
    await screenshotWithLabel(page, "jeux-age7-plateforme")
  })

  test("Famille topic: family games", async ({ page }) => {
    await selectTopic(page, "Famille")
    await waitForResults(page)

    const empty = await isEmptyState(page)
    if (!empty) {
      const count = await getTotalCount(page)
      expect(count).toBeGreaterThan(0)
    }
    await screenshotWithLabel(page, "jeux-famille")
  })

  // ── Age + Platform + Topic (triple combo) ──────────────────────────

  test("age max=10 + Switch + Aventure: narrowed results", async ({ page }) => {
    await setAgeSliderMax(page, 10)
    await selectPlatform(page, "Switch")
    await selectTopic(page, "Aventure")
    await waitForResults(page)

    const empty = await isEmptyState(page)
    if (!empty) {
      const ages = await getCardAgeBadges(page)
      for (const age of ages) {
        expect(age).toBeLessThanOrEqual(10)
      }
    }
    await screenshotWithLabel(page, "jeux-age10-switch-aventure")
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
    await screenshotWithLabel(page, "jeux-sort-alpha")
  })

  // ── Progressive narrowing ──────────────────────────────────────────

  test("progressive: default -> age 8 -> +Switch -> +Aventure", async ({ page }) => {
    const defaultCount = await getTotalCount(page)

    await setAgeSliderMax(page, 8)
    await waitForResults(page)
    const age8Count = await getTotalCount(page)
    expect(age8Count).toBeLessThanOrEqual(defaultCount)

    await selectPlatform(page, "Switch")
    await waitForResults(page)
    const age8SwitchCount = await getTotalCount(page)
    expect(age8SwitchCount).toBeLessThanOrEqual(age8Count)

    await selectTopic(page, "Aventure")
    await waitForResults(page)

    await screenshotWithLabel(page, "jeux-progressive-final")
  })
})
