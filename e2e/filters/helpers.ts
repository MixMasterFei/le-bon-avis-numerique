import { Page, expect } from "@playwright/test"

/** Base URL for production tests (overridden by PLAYWRIGHT_BASE_URL) */
export const PROD_URL = "https://totemavise.com"

/** Wait for media cards to appear after filter change */
export async function waitForResults(page: Page) {
  // Wait for loading to finish (the "Chargement..." text to disappear)
  await page.waitForFunction(
    () => !document.body.textContent?.includes("Chargement..."),
    { timeout: 15_000 }
  )
  // Small buffer for React re-render
  await page.waitForTimeout(500)
}

/** Get all visible media card links on the page */
export function getMediaCards(page: Page) {
  return page.locator('a[href^="/media/"]')
}

/** Get the total count text (e.g. "42 films", "12 séries", "8 jeux") */
export async function getTotalCount(page: Page): Promise<number> {
  const countText = page.locator("text=/\\d+ (films?|séries?|jeux?)/i")
  await expect(countText.first()).toBeVisible({ timeout: 10_000 })
  const text = await countText.first().textContent()
  const match = text?.match(/(\d+)/)
  return match ? parseInt(match[1]) : 0
}

/** Extract the age badge text from a media card (e.g. "3+", "7+", "12+") */
export async function getCardAgeBadges(page: Page): Promise<number[]> {
  const ages: number[] = []
  const cards = getMediaCards(page)
  const count = await cards.count()

  for (let i = 0; i < Math.min(count, 24); i++) {
    const card = cards.nth(i)
    // Age badge format: "N+" inside a colored pill
    const ageBadge = card.locator("text=/^\\d+\\+$/").first()
    if (await ageBadge.isVisible().catch(() => false)) {
      const text = await ageBadge.textContent()
      const match = text?.match(/(\d+)\+/)
      if (match) ages.push(parseInt(match[1]))
    }
  }
  return ages
}

/** Set the age slider to a specific max value by interacting with the slider */
export async function setAgeSliderMax(page: Page, maxAge: number) {
  // The Radix slider has two thumbs — we need the second one (max)
  const slider = page.locator('[role="slider"]')
  const thumbs = await slider.count()
  if (thumbs < 2) return

  const maxThumb = slider.nth(1)
  // Focus the thumb and use keyboard to set value
  await maxThumb.focus()
  // Get current value
  const currentVal = parseInt(await maxThumb.getAttribute("aria-valuenow") || "18")
  const steps = currentVal - maxAge
  for (let i = 0; i < steps; i++) {
    await maxThumb.press("ArrowLeft")
  }
}

/** Set the age slider to a specific min value */
export async function setAgeSliderMin(page: Page, minAge: number) {
  const slider = page.locator('[role="slider"]')
  const minThumb = slider.nth(0)
  await minThumb.focus()
  const currentVal = parseInt(await minThumb.getAttribute("aria-valuenow") || "2")
  const steps = minAge - currentVal
  for (let i = 0; i < Math.abs(steps); i++) {
    if (steps > 0) await minThumb.press("ArrowRight")
    else await minThumb.press("ArrowLeft")
  }
}

/** Click a topic/theme badge in the filter sidebar */
export async function selectTopic(page: Page, topic: string) {
  const sidebar = page.locator("aside")
  const badge = sidebar.getByText(topic, { exact: true })
  await badge.click()
}

/** Click a platform badge in the filter sidebar */
export async function selectPlatform(page: Page, platform: string) {
  const sidebar = page.locator("aside")
  const badge = sidebar.getByText(platform, { exact: true })
  await badge.click()
}

/** Type a search query in the filter sidebar */
export async function searchFilter(page: Page, query: string) {
  const input = page.locator('input[type="search"]')
  await input.fill(query)
}

/** Click the sort button (Récents / Titre A-Z) */
export async function selectSort(page: Page, label: string) {
  const sidebar = page.locator("aside")
  await sidebar.getByText(label, { exact: true }).click()
}

/** Get the "Aucun ... trouvé" empty state visibility */
export async function isEmptyState(page: Page): Promise<boolean> {
  return page.locator("text=/Aucun .+ trouvé/i").isVisible().catch(() => false)
}

/** Take a labeled screenshot and return the path */
export async function screenshotWithLabel(page: Page, name: string) {
  return page.screenshot({
    path: `e2e/screenshots/${name}.png`,
    fullPage: false,
  })
}
