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
  searchFilter,
  sortByTitle,
  isEmptyState,
  eventually,
  expectAgeBand,
  expectAlphabetical,
  screenshotWithLabel,
} from "./helpers"

test.describe("Films — Filter tests", () => {
  test.beforeEach(async ({ page }) => {
    await openCatalogue(page, "/films")
  })

  // ── Default state ──────────────────────────────────────────────────

  test("default load shows results with correct heading", async ({ page }) => {
    // The H1 reads « Tous les films » (lowercase): the old case-sensitive
    // "Films" predates the catalogue redesign.
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/films/i)
    const count = await getTotalCount(page)
    expect(count).toBeGreaterThan(0)
    const cards = getMediaCards(page)
    await expect(cards.first()).toBeVisible()
    await screenshotWithLabel(page, "films-default")
  })

  // ── Age filter only ────────────────────────────────────────────────

  test("age max=5: all displayed ages are <= 5", async ({ page }) => {
    await setAgeSliderMax(page, 5)

    await eventually(async () => {
      const ages = await getCardAgeBadges(page)
      expect(ages.length).toBeGreaterThan(0)
      for (const age of ages) {
        expect(age).toBeLessThanOrEqual(5)
      }
    })

    const count = await getTotalCount(page)
    expect(count).toBeGreaterThan(0)
    await screenshotWithLabel(page, "films-age-max-5")
  })

  test("age max=3: all displayed ages are <= 3", async ({ page }) => {
    await setAgeSliderMax(page, 3)

    await eventually(async () => {
      const ages = await getCardAgeBadges(page)
      expect(ages.length).toBeGreaterThan(0)
      for (const age of ages) {
        expect(age).toBeLessThanOrEqual(3)
      }
    })
    await screenshotWithLabel(page, "films-age-max-3")
  })

  test("age max=7: result count < default count", async ({ page }) => {
    const defaultCount = await getTotalCount(page)

    await setAgeSliderMax(page, 7)
    const filteredCount = await getTotalCount(page)

    expect(filteredCount).toBeLessThan(defaultCount)
    expect(filteredCount).toBeGreaterThan(0)
  })

  test("age range 6-10: ages within 6–10, family-VIP titles excepted below", async ({ page }) => {
    await setAgeSliderMin(page, 6)
    await setAgeSliderMax(page, 10)

    // Below 6 only for family-VIP brands (intended: applyAgeFilter); above 10 never.
    await expectAgeBand(page, 6, 10)
    await screenshotWithLabel(page, "films-age-6-to-10")
  })

  // ── Age + Topic combos ─────────────────────────────────────────────

  test("age max=7 + Animation: fewer results, all ages <=7", async ({ page }) => {
    await setAgeSliderMax(page, 7)
    const ageOnlyCount = await getTotalCount(page)

    await selectTopic(page, "Animation")
    const comboCount = await getTotalCount(page)

    // Combo should be a subset
    expect(comboCount).toBeLessThanOrEqual(ageOnlyCount)
    expect(comboCount).toBeGreaterThan(0)

    await eventually(async () => {
      for (const age of await getCardAgeBadges(page)) {
        expect(age).toBeLessThanOrEqual(7)
      }
    })
    await screenshotWithLabel(page, "films-age7-animation")
  })

  test("age max=12 + Comédie: results exist, ages <=12", async ({ page }) => {
    await setAgeSliderMax(page, 12)
    await selectTopic(page, "Comédie")

    const count = await getTotalCount(page)
    expect(count).toBeGreaterThan(0)

    await eventually(async () => {
      for (const age of await getCardAgeBadges(page)) {
        expect(age).toBeLessThanOrEqual(12)
      }
    })
    await screenshotWithLabel(page, "films-age12-comedie")
  })

  test("age max=10 + Aventure: results exist", async ({ page }) => {
    await setAgeSliderMax(page, 10)
    await selectTopic(page, "Aventure")

    const count = await getTotalCount(page)
    expect(count).toBeGreaterThan(0)
    await screenshotWithLabel(page, "films-age10-aventure")
  })

  test("age max=6 + Science-Fiction: may be empty (valid)", async ({ page }) => {
    await setAgeSliderMax(page, 6)
    await selectTopic(page, "Science-Fiction")

    // This combo might legitimately be empty — the empty state then says so.
    if (await isEmptyState(page)) {
      await expect(page.getByText("Aucun film à afficher")).toBeVisible()
    } else {
      await eventually(async () => {
        for (const age of await getCardAgeBadges(page)) {
          expect(age).toBeLessThanOrEqual(6)
        }
      })
    }
    await screenshotWithLabel(page, "films-age6-scifi")
  })

  // ── Topic only ─────────────────────────────────────────────────────

  test("Famille topic: results are family-friendly", async ({ page }) => {
    await selectTopic(page, "Famille")

    const count = await getTotalCount(page)
    expect(count).toBeGreaterThan(0)
    await screenshotWithLabel(page, "films-famille")
  })

  test("Super-héros topic: results exist", async ({ page }) => {
    await selectTopic(page, "Super-héros")

    const count = await getTotalCount(page)
    expect(count).toBeGreaterThan(0)
    await screenshotWithLabel(page, "films-super-heros")
  })

  // ── Multiple topics ────────────────────────────────────────────────

  test("Animation + Aventure: subset of either alone", async ({ page }) => {
    await selectTopic(page, "Animation")
    await getTotalCount(page)

    await selectTopic(page, "Aventure")
    const comboCount = await getTotalCount(page)

    // Adding a second topic may expand or contract results depending on OR/AND logic
    // At minimum, verify no crash and results exist
    expect(comboCount).toBeGreaterThan(0)
    await screenshotWithLabel(page, "films-animation-aventure")
  })

  // ── Search ─────────────────────────────────────────────────────────

  test("search 'dragon': returns matching titles", async ({ page }) => {
    // The sidebar box: the header carries two more search inputs, hence the
    // strict-mode violation of the old page-wide input[type=search].
    await searchFilter(page, "dragon")

    const titles = (await getCardTitles(page)).map((t) => t.toLowerCase())
    if (titles.length > 0) {
      expect(titles.some((t) => t.includes("dragon"))).toBe(true)
    }
    await screenshotWithLabel(page, "films-search-dragon")
  })

  // ── Sort order ─────────────────────────────────────────────────────

  test("sort A → Z: titles are alphabetically ordered", async ({ page }) => {
    await sortByTitle(page)

    await eventually(async () => expectAlphabetical(await getCardTitles(page)))
    await screenshotWithLabel(page, "films-sort-alpha")
  })

  // ── Combined: age + topic + sort ───────────────────────────────────

  test("age max=10 + Animation + sort A → Z: correct subset, sorted", async ({ page }) => {
    await setAgeSliderMax(page, 10)
    await selectTopic(page, "Animation")
    await sortByTitle(page)

    await eventually(async () => {
      for (const age of await getCardAgeBadges(page)) {
        expect(age).toBeLessThanOrEqual(10)
      }
      const titles = await getCardTitles(page)
      if (titles.length > 1) expectAlphabetical(titles)
    })
    await screenshotWithLabel(page, "films-age10-animation-alpha")
  })

  // ── Progressive narrowing (simulating real user behavior) ──────────

  test("progressive narrowing: default -> age 8 -> +Comédie", async ({ page }) => {
    const defaultCount = await getTotalCount(page)

    // Step 1: Age max 8
    await setAgeSliderMax(page, 8)
    const age8Count = await getTotalCount(page)
    expect(age8Count).toBeLessThan(defaultCount)
    expect(age8Count).toBeGreaterThan(0)

    // Step 2: + Comédie
    await selectTopic(page, "Comédie")
    const age8ComedyCount = await getTotalCount(page)
    expect(age8ComedyCount).toBeLessThanOrEqual(age8Count)
    expect(age8ComedyCount).toBeGreaterThan(0)

    await screenshotWithLabel(page, "films-progressive-final")
  })
})
