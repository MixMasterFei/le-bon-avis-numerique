import { test, expect } from "@playwright/test"
import {
  openCatalogue,
  getMediaCards,
  getTotalCount,
  getCardAgeBadges,
  getCardTitles,
  setAgeSliderMax,
  selectTopic,
  selectPlatform,
  sortByTitle,
  isEmptyState,
  eventually,
  expectAlphabetical,
  screenshotWithLabel,
} from "./helpers"

test.describe("Jeux — Filter tests", () => {
  test.beforeEach(async ({ page }) => {
    await openCatalogue(page, "/jeux")
  })

  // ── Default state ──────────────────────────────────────────────────

  test("default load shows game results", async ({ page }) => {
    // The H1 reads « Tous les jeux vidéo » (lowercase): the old case-sensitive
    // "Jeux" predates the catalogue redesign.
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/jeux/i)
    const count = await getTotalCount(page)
    expect(count).toBeGreaterThan(0)
    await expect(getMediaCards(page).first()).toBeVisible()
    await screenshotWithLabel(page, "jeux-default")
  })

  // ── Age filter ─────────────────────────────────────────────────────

  test("age max=7: all displayed ages are <= 7", async ({ page }) => {
    await setAgeSliderMax(page, 7)

    await eventually(async () => {
      const ages = await getCardAgeBadges(page)
      expect(ages.length).toBeGreaterThan(0)
      for (const age of ages) {
        expect(age).toBeLessThanOrEqual(7)
      }
    })
    await screenshotWithLabel(page, "jeux-age-max-7")
  })

  test("age max=3: very young children games", async ({ page }) => {
    await setAgeSliderMax(page, 3)

    if (!(await isEmptyState(page))) {
      await eventually(async () => {
        for (const age of await getCardAgeBadges(page)) {
          expect(age).toBeLessThanOrEqual(3)
        }
      })
    }
    await screenshotWithLabel(page, "jeux-age-max-3")
  })

  test("age max=10: result count <= default count", async ({ page }) => {
    const defaultCount = await getTotalCount(page)

    await setAgeSliderMax(page, 10)
    const filteredCount = await getTotalCount(page)

    expect(filteredCount).toBeLessThanOrEqual(defaultCount)
    expect(filteredCount).toBeGreaterThan(0)
  })

  // ── Platform filter ────────────────────────────────────────────────

  test("Switch platform: results exist", async ({ page }) => {
    await selectPlatform(page, "Switch")

    if (!(await isEmptyState(page))) {
      const count = await getTotalCount(page)
      expect(count).toBeGreaterThan(0)
    }
    await screenshotWithLabel(page, "jeux-switch")
  })

  test("PS5 platform: results exist", async ({ page }) => {
    await selectPlatform(page, "PS5")

    if (!(await isEmptyState(page))) {
      const count = await getTotalCount(page)
      expect(count).toBeGreaterThan(0)
    }
    await screenshotWithLabel(page, "jeux-ps5")
  })

  // ── Age + Platform combos ──────────────────────────────────────────

  test("age max=7 + Switch: family-friendly Nintendo games", async ({ page }) => {
    await setAgeSliderMax(page, 7)
    await selectPlatform(page, "Switch")

    if (!(await isEmptyState(page))) {
      await eventually(async () => {
        for (const age of await getCardAgeBadges(page)) {
          expect(age).toBeLessThanOrEqual(7)
        }
      })
    }
    await screenshotWithLabel(page, "jeux-age7-switch")
  })

  test("age max=12 + PS5: teen-appropriate PS5 games", async ({ page }) => {
    await setAgeSliderMax(page, 12)
    await selectPlatform(page, "PS5")

    if (!(await isEmptyState(page))) {
      await eventually(async () => {
        for (const age of await getCardAgeBadges(page)) {
          expect(age).toBeLessThanOrEqual(12)
        }
      })
    }
    await screenshotWithLabel(page, "jeux-age12-ps5")
  })

  // ── Age + Topic combos ─────────────────────────────────────────────

  test("age max=10 + Aventure: adventure games for kids", async ({ page }) => {
    await setAgeSliderMax(page, 10)
    await selectTopic(page, "Aventure")

    if (!(await isEmptyState(page))) {
      const count = await getTotalCount(page)
      expect(count).toBeGreaterThan(0)
      await eventually(async () => {
        for (const age of await getCardAgeBadges(page)) {
          expect(age).toBeLessThanOrEqual(10)
        }
      })
    }
    await screenshotWithLabel(page, "jeux-age10-aventure")
  })

  test("age max=7 + Plateforme: platformers for young kids", async ({ page }) => {
    await setAgeSliderMax(page, 7)
    await selectTopic(page, "Plateforme")

    if (!(await isEmptyState(page))) {
      await eventually(async () => {
        for (const age of await getCardAgeBadges(page)) {
          expect(age).toBeLessThanOrEqual(7)
        }
      })
    }
    await screenshotWithLabel(page, "jeux-age7-plateforme")
  })

  test("Course topic: racing games", async ({ page }) => {
    // Was « Famille topic »: the games sidebar has no « Famille » theme by
    // design — its themes are the IGDB genres, and family fit is the PEGI age
    // filter's job (GAME_GENRE_TOPICS, src/lib/igdb-genres.ts). Same check on
    // a theme the sidebar does offer.
    await selectTopic(page, "Course")

    if (!(await isEmptyState(page))) {
      const count = await getTotalCount(page)
      expect(count).toBeGreaterThan(0)
    }
    await screenshotWithLabel(page, "jeux-course")
  })

  // ── Age + Platform + Topic (triple combo) ──────────────────────────

  test("age max=10 + Switch + Aventure: narrowed results", async ({ page }) => {
    await setAgeSliderMax(page, 10)
    await selectPlatform(page, "Switch")
    await selectTopic(page, "Aventure")

    if (!(await isEmptyState(page))) {
      await eventually(async () => {
        for (const age of await getCardAgeBadges(page)) {
          expect(age).toBeLessThanOrEqual(10)
        }
      })
    }
    await screenshotWithLabel(page, "jeux-age10-switch-aventure")
  })

  // ── Sort ───────────────────────────────────────────────────────────

  test("sort A → Z: alphabetically ordered", async ({ page }) => {
    await sortByTitle(page)

    await eventually(async () => expectAlphabetical(await getCardTitles(page)))
    await screenshotWithLabel(page, "jeux-sort-alpha")
  })

  // ── Progressive narrowing ──────────────────────────────────────────

  test("progressive: default -> age 8 -> +Switch -> +Aventure", async ({ page }) => {
    const defaultCount = await getTotalCount(page)

    await setAgeSliderMax(page, 8)
    const age8Count = await getTotalCount(page)
    expect(age8Count).toBeLessThanOrEqual(defaultCount)

    await selectPlatform(page, "Switch")
    const age8SwitchCount = await getTotalCount(page)
    expect(age8SwitchCount).toBeLessThanOrEqual(age8Count)

    await selectTopic(page, "Aventure")
    const age8SwitchAdventureCount = await getTotalCount(page)
    expect(age8SwitchAdventureCount).toBeLessThanOrEqual(age8SwitchCount)

    await screenshotWithLabel(page, "jeux-progressive-final")
  })
})
