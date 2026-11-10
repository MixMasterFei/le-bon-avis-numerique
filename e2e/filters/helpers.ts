import { rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test, type Locator, type Page, type Response } from "@playwright/test"
import { FAMILY_VIP_BRAND_TOPICS } from "../../src/lib/family-vip-brands"

/**
 * Helpers for the catalogue filter suites (/films, /series, /jeux).
 *
 * The catalogue is URL-as-truth (src/components/home-redesign/catalogue/
 * useCatalogueFilters.ts): every control calls router.replace() and the
 * force-dynamic page re-renders on the server. An interaction has therefore
 * landed when (1) the URL carries the new params and (2) the listing for that
 * URL is on screen. The previous helpers waited for a « Chargement... » text
 * the catalogue no longer renders, i.e. slept 500 ms and read whatever grid was
 * there — the stale-DOM failures of the 7 Nov 2026 run.
 */

/** Prefix of every failure that is the infrastructure's, not the product's. */
export const INFRA = "[infra]"

/** Age slider bounds of the catalogue sidebar (CatalogueSidebar defaultMinAge/defaultMaxAge). */
const AGE_MIN = 2
const AGE_MAX = 18

const VIP_TOPICS: readonly string[] = FAMILY_VIP_BRAND_TOPICS

// ── Page state ────────────────────────────────────────────────────────

/**
 * Vercel's edge can refuse a CI runner (« This request was blocked », the
 * security checkpoint) — seen on the 7, 8 and 9 Nov 2026 runs. That is an
 * infrastructure failure, not a product one.
 *
 * The refusal is temporary, so the first time it shows the helper pauses
 * (EDGE_PAUSE_MS) and reloads the same URL: the catalogue keeps its whole
 * state in the URL, so the test resumes where it was. If the edge still
 * refuses, the test fails fast with a recognisable message (the workflow
 * summary counts these separately), and for EDGE_PAUSE_COOLDOWN_MS the next
 * refusals fail fast too, instead of every remaining test spending the pause.
 */
const EDGE_PAUSE_MS = 30_000
const EDGE_PAUSE_COOLDOWN_MS = 3 * 60_000
/** A file, not a variable: Playwright restarts the worker after each failed test. */
const EDGE_PAUSE_FAILED = join(tmpdir(), "totem-filter-tests-edge-refusal")

function edgeRefusedError(url: string, reason: string) {
  return new Error(
    `${INFRA} Vercel's edge refused this runner on ${url} (${reason}). ` +
      "Infrastructure failure, not a product defect: this run cannot vouch for this test.",
  )
}

async function edgeRefusal(page: Page, status?: number): Promise<string | null> {
  const blockedTitle = page.locator("h1#error-title")
  if ((await blockedTitle.count()) > 0) return (await blockedTitle.first().innerText()).trim()
  if (/security checkpoint/i.test(await page.title().catch(() => ""))) return "security checkpoint"
  if (status === 403 || status === 429) return `HTTP ${status}`
  return null
}

function edgePauseFailedRecently(): boolean {
  try {
    return Date.now() - statSync(EDGE_PAUSE_FAILED).mtimeMs < EDGE_PAUSE_COOLDOWN_MS
  } catch {
    return false
  }
}

export async function assertNotEdgeBlocked(page: Page, response?: Response | null) {
  let reason = await edgeRefusal(page, response?.status())
  if (!reason) return
  if (!edgePauseFailedRecently()) {
    const refusedUrl = page.url()
    const info = test.info()
    if (info.timeout > 0) info.setTimeout(info.timeout + EDGE_PAUSE_MS + 30_000)
    await new Promise((resolve) => setTimeout(resolve, EDGE_PAUSE_MS))
    const reloaded = await page.reload().catch(() => null)
    reason = await edgeRefusal(page, reloaded?.status())
    if (!reason) {
      rmSync(EDGE_PAUSE_FAILED, { force: true })
      info.annotations.push({
        type: "edge refusal",
        description: `${refusedUrl}: cleared after a ${EDGE_PAUSE_MS / 1000} s pause`,
      })
      return
    }
    writeFileSync(EDGE_PAUSE_FAILED, refusedUrl)
  }
  throw edgeRefusedError(page.url(), reason)
}

export function getMediaCards(page: Page): Locator {
  return page.locator('main a[href^="/media/"]')
}

/** « Aucun film à afficher » / « Aucune série à afficher » / « Aucun jeu à afficher ». */
function emptyState(page: Page): Locator {
  return page.locator("main").getByText(/^Aucune? (film|série|jeu) à afficher$/)
}

export async function isEmptyState(page: Page): Promise<boolean> {
  return emptyState(page).isVisible()
}

/** The listing — not the loading skeleton (no h1), not an edge error page — is on screen. */
export async function waitForListing(page: Page) {
  await assertNotEdgeBlocked(page)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await assertNotEdgeBlocked(page)
  await expect(getMediaCards(page).first().or(emptyState(page))).toBeVisible()
}

export async function openCatalogue(page: Page, path: string) {
  const response = await page.goto(path)
  await assertNotEdgeBlocked(page, response)
  await waitForListing(page)
}

type ParamExpectation = string | null | ((value: string | null) => boolean)

/** Wait until the URL reflects `expected` (null = param absent), then for the listing. */
export async function waitForFilters(page: Page, expected: Record<string, ParamExpectation>) {
  const describe = Object.entries(expected)
    .map(([key, want]) => `${key}=${typeof want === "function" ? "…" : String(want)}`)
    .join(" ")
  await expect
    .poll(
      () => {
        const params = new URL(page.url()).searchParams
        return Object.entries(expected).every(([key, want]) => {
          const got = params.get(key)
          return typeof want === "function" ? want(got) : got === want
        })
      },
      { message: `the catalogue URL should carry ${describe}`, timeout: 20_000 },
    )
    .toBe(true)
  await waitForListing(page)
}

const listIncludes = (item: string) => (value: string | null) =>
  (value ?? "").split(",").includes(item)

// ── Reading the listing ──────────────────────────────────────────────

/**
 * The headline count (« 1 234 films analysés. »). fr-FR groups thousands with
 * a narrow no-break space, so the number must be read whole: the old /(\d+)/
 * read « 1 234 » as 1, hence « Expected: <= 1, Received: 264 » on Jeux.
 * Unfiltered, the headline shows the analysed catalogue; with any filter
 * active, the filtered total.
 */
export async function getTotalCount(page: Page): Promise<number> {
  const line = page.locator("main p").filter({ hasText: /analysé/ }).first()
  await expect(line).toBeVisible()
  const text = await line.innerText()
  const match = text.match(/(\d[\d\s]*)\s(?:films?|séries?|jeux?)\b/i)
  if (!match) throw new Error(`No result count in « ${text} »`)
  return Number(match[1].replace(/\D/g, ""))
}

export interface CardInfo {
  href: string
  /** MediaItem id, decoded from /media/<type>:<id>. */
  id: string
  title: string
  /** Badge as shown: « 12+ » or « TP » (tous publics = 0); null when the card has none. */
  ageLabel: string | null
  age: number | null
}

/** Every card of the grid (first 24), read in one round trip so a re-render can't split the read. */
export async function readCards(page: Page): Promise<CardInfo[]> {
  const raw = await getMediaCards(page).evaluateAll((links) =>
    links.slice(0, 24).map((link) => {
      const badge = Array.from(link.querySelectorAll("span")).find((span) =>
        /^(\d+\+|TP)$/.test((span.textContent ?? "").trim()),
      )
      // Both card variants put the title in a line-clamp block (the broken-image
      // fallback repeats it in one too), and neither uses a heading element.
      const title = link.querySelector('[class*="line-clamp"]')?.textContent ?? ""
      return {
        href: link.getAttribute("href") ?? "",
        title: title.trim(),
        ageLabel: badge ? (badge.textContent ?? "").trim() : null,
      }
    }),
  )
  return raw.map((card) => {
    const routeId = card.href.replace(/^\/media\//, "")
    const id = decodeURIComponent(routeId.slice(routeId.indexOf(":") + 1))
    const age = card.ageLabel === null ? null : card.ageLabel === "TP" ? 0 : parseInt(card.ageLabel, 10)
    return { ...card, id, age }
  })
}

/** Ages shown on the cards (« TP » counts as 0 — it is a rating, not a gap). */
export async function getCardAgeBadges(page: Page): Promise<number[]> {
  return (await readCards(page)).flatMap((card) => (card.age === null ? [] : [card.age]))
}

/** Titles of the first `limit` cards, in display order. */
export async function getCardTitles(page: Page, limit = 10): Promise<string[]> {
  return (await readCards(page)).slice(0, limit).map((card) => card.title).filter(Boolean)
}

/** Retry `assertion` until the settled listing satisfies it (never weaker: it must hold in the end). */
export async function eventually(assertion: () => Promise<void>, timeout = 15_000) {
  await expect(assertion).toPass({ timeout })
}

/**
 * The age band's LOWER bound is intentionally soft for family-VIP brands
 * (applyAgeFilter in src/lib/media-queries.ts, src/lib/family-vip-brands.ts):
 * a Totoro rated 5+ still shows for a 6–10 band. The UPPER bound is a safety
 * promise and never bends. So every card must be ≤ maxAge, and a card under
 * minAge must be a VIP-tagged title — checked against the catalogue API, not
 * assumed.
 */
export async function expectAgeBand(page: Page, minAge: number, maxAge: number) {
  let cards: CardInfo[] = []
  await eventually(async () => {
    cards = (await readCards(page)).filter((card) => card.age !== null)
    expect(cards.length, "cards with an age badge").toBeGreaterThan(0)
    for (const card of cards) {
      expect(card.age!, `${card.title} (${card.ageLabel}) must respect the ${maxAge} ceiling`).toBeLessThanOrEqual(maxAge)
    }
  })
  for (const card of cards.filter((c) => c.age! < minAge)) {
    const res = await page.request.get(`/api/db/media/${encodeURIComponent(card.id)}`)
    if (res.status() === 403 || res.status() === 429) throw edgeRefusedError(res.url(), `HTTP ${res.status()}`)
    expect(res.ok(), `catalogue API for ${card.title} returned ${res.status()}`).toBe(true)
    const { topics = [] } = (await res.json()) as { topics?: string[] }
    expect(
      topics.some((topic) => VIP_TOPICS.includes(topic)),
      `${card.title} (${card.ageLabel}) is below the ${minAge}–${maxAge} band, which only family-VIP titles may be (topics: ${topics.join(", ") || "none"})`,
    ).toBe(true)
  }
}

// ── Driving the filters ──────────────────────────────────────────────

const SLIDER_MOVES: ReadonlyArray<readonly [string, (value: number) => number]> = [
  ["ArrowRight", (v) => v + 1],
  ["ArrowLeft", (v) => v - 1],
  // Radix moves a thumb by 10 steps on PageUp/PageDown, clamped to the slider.
  ["PageUp", (v) => Math.min(AGE_MAX, v + 10)],
  ["PageDown", (v) => Math.max(AGE_MIN, v - 10)],
]

/**
 * Shortest key sequence moving a thumb from `from` to `to` without leaving
 * `lo..hi` (Radix rejects a move that would cross the other thumb). Every
 * value change is a server navigation, so the old one-arrow-per-year walk
 * (15 navigations for « max 3 ») hammered production and raced the reads.
 */
export function planSliderKeys(from: number, to: number, lo: number, hi: number): string[] {
  const previous = new Map<number, readonly [number, string]>()
  const queue = [from]
  const seen = new Set([from])
  while (queue.length > 0 && !seen.has(to)) {
    const value = queue.shift()!
    for (const [key, move] of SLIDER_MOVES) {
      const next = move(value)
      if (next < lo || next > hi || seen.has(next)) continue
      seen.add(next)
      previous.set(next, [value, key])
      queue.push(next)
    }
  }
  if (!seen.has(to)) throw new Error(`The age slider cannot reach ${to} from ${from} within ${lo}–${hi}`)
  const keys: string[] = []
  for (let value = to; value !== from; ) {
    const [before, key] = previous.get(value)!
    keys.unshift(key)
    value = before
  }
  return keys
}

async function setAgeThumb(page: Page, index: 0 | 1, target: number) {
  const thumbs = page.locator("aside").getByRole("slider")
  // Fail loudly: the old helper returned silently when the slider was missing
  // (e.g. on an edge error page) and the test then timed out elsewhere.
  await expect(thumbs, "the age slider should have two thumbs").toHaveCount(2)
  const thumb = thumbs.nth(index)
  const other = thumbs.nth(1 - index)
  for (let guard = 0; guard < 12; guard++) {
    const current = Number(await thumb.getAttribute("aria-valuenow"))
    if (current === target) break
    const otherValue = Number(await other.getAttribute("aria-valuenow"))
    const [lo, hi] = index === 0 ? [AGE_MIN, otherValue - 1] : [otherValue + 1, AGE_MAX]
    const [key] = planSliderKeys(current, target, lo, hi)
    await thumb.press(key)
    await expect(thumb).not.toHaveAttribute("aria-valuenow", String(current))
  }
  await expect(thumb).toHaveAttribute("aria-valuenow", String(target))
}

export async function setAgeSliderMax(page: Page, maxAge: number) {
  await setAgeThumb(page, 1, maxAge)
  await waitForFilters(page, { maxAge: maxAge < AGE_MAX ? String(maxAge) : null })
}

export async function setAgeSliderMin(page: Page, minAge: number) {
  await setAgeThumb(page, 0, minAge)
  await waitForFilters(page, { minAge: minAge > AGE_MIN ? String(minAge) : null })
}

/** Click a theme in the filter sidebar (a toggle button). */
export async function selectTopic(page: Page, topic: string) {
  await page.locator("aside").getByRole("button", { name: topic, exact: true }).click()
  await waitForFilters(page, { topics: listIncludes(topic) })
}

/** Click a streaming platform / console in the filter sidebar. */
export async function selectPlatform(page: Page, platform: string) {
  await page.locator("aside").getByRole("button", { name: platform, exact: true }).click()
  await waitForFilters(page, { platforms: listIncludes(platform) })
}

/** Type in the sidebar's own search box (the header has two more). Debounced 350 ms. */
export async function searchFilter(page: Page, query: string) {
  await page.locator("aside").getByRole("searchbox").fill(query)
  await waitForFilters(page, { q: query })
}

/** The sidebar sort control is « A → Z » (it was « Titre A-Z » two redesigns ago). */
export async function sortByTitle(page: Page) {
  await page.locator("aside").getByRole("button", { name: "A → Z", exact: true }).click()
  await waitForFilters(page, { sort: "title" })
}

export function expectAlphabetical(titles: string[]) {
  expect(titles.length, "titles read from the grid").toBeGreaterThan(1)
  const sorted = [...titles].sort((a, b) => a.localeCompare(b, "fr"))
  expect(titles).toEqual(sorted)
}

/** Take a labeled screenshot (uploaded by the workflow as an artifact). */
export async function screenshotWithLabel(page: Page, name: string) {
  return page.screenshot({
    path: `e2e/screenshots/${name}.png`,
    fullPage: false,
  })
}
