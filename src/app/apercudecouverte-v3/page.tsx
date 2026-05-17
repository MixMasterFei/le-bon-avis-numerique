import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ApercuDecouverteV3, type DecouverteV3Data } from "@/components/home-v2/ApercuDecouverteV3"
import { HydrationDebugBoundary } from "@/components/providers/HydrationDebugBoundary"
import { getNextHoliday, getHolidayCalendar, holidayToSerializable, type CalendarHoliday } from "@/lib/school-holidays"
import { getCatalogAnniversary } from "@/lib/catalog-anniversary"
import { getWeatherForCity, DEFAULT_CITY, type WeatherCity } from "@/lib/weather"
import { getAirQualityForCity } from "@/lib/air-quality"
import { getCinemaTendances } from "@/lib/news-cinema-tendances"
import { getUpcomingNotableDates, type NotableDateInstance } from "@/lib/notable-dates"
import { getUpcomingDeadlines, type DeadlineInstance } from "@/lib/family-deadlines"
import type { EtudeRef } from "@/components/home-v2/EtudesRecentesCard"
import { fraunces } from "@/components/home-v2/apercuFont"
import { isFraunces } from "@/components/home-v2/apercuTheme"
import type { ApercuNewsCardData } from "@/components/home-v2/ApercuNewsCard"
import type { NewsSourceRef } from "@/components/home-v2/ApercuNewsSourcePills"
import type { StoryResearch } from "@/components/home-v2/ApercuDecouverteStory"
import { Prisma, type ImageSourceType } from "@prisma/client"
import { isBlockedHotlinkImageUrl } from "@/lib/news-image-policy"
import { fallbackCard, isFallbackCardUrl } from "@/lib/news-image"
import { balanceNewsForFeed } from "@/lib/news-feed-balancer"
import { findContextualStockPhoto } from "@/lib/stock-photo"

export const dynamic = "force-dynamic"
// Note: `revalidate` removed — incompatible with `force-dynamic` and
// every render is per-request anyway. Cron writes news to the DB, the
// page reads it on each visit (auth-gated, low traffic).

const hydrationDebugEnabled = process.env.NEXT_PUBLIC_HYDRATION_DEBUG === "true"

interface SearchParams {
  font?: string
}

type NewsImagePolicy = "asStored" | "safeFallback" | "stockThenFallback"

function toSources(raw: Prisma.JsonValue | null): NewsSourceRef[] {
  if (!Array.isArray(raw)) return []
  // Dedup by publisher name at render time (older dossiers in DB
  // were aggregated with URL-based dedup → multiple pills per
  // publisher when several articles from the same source were cited).
  const seen = new Set<string>()
  return raw.flatMap((entry): NewsSourceRef[] => {
    if (typeof entry !== "object" || entry === null) return []
    const e = entry as Record<string, unknown>
    const name = typeof e.name === "string" ? e.name : ""
    const url = typeof e.url === "string" ? e.url : ""
    if (!name || !url || seen.has(name)) return []
    seen.add(name)
    return [
      {
        name,
        url,
        favicon: typeof e.favicon === "string" ? e.favicon : undefined,
        headline: typeof e.headline === "string" ? e.headline : undefined,
        country: typeof e.country === "string" ? e.country : undefined,
      },
    ]
  })
}

function toResearch(raw: Prisma.JsonValue | null): StoryResearch | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (
    typeof r.studyTitle !== "string" ||
    typeof r.organization !== "string" ||
    typeof r.methodology !== "string" ||
    typeof r.keyFinding !== "string"
  ) {
    return null
  }
  return {
    studyTitle: r.studyTitle,
    organization: r.organization,
    year: typeof r.year === "number" ? r.year : null,
    methodology: r.methodology,
    keyFinding: r.keyFinding,
    caveat: typeof r.caveat === "string" ? r.caveat : undefined,
    sourceUrl: typeof r.sourceUrl === "string" ? r.sourceUrl : undefined,
  }
}

type StoryRow = {
  id: string
  slug: string
  title: string
  summary: string
  body: string
  imageUrl: string
  imageCredit: string | null
  imageLicenseUrl: string | null
  imageSourceType: ImageSourceType | null
  category: ApercuNewsCardData["category"]
  publishedAt: Date
  relevanceScore: number
  sources: Prisma.JsonValue
  /** Set by news-editorial-judge after synthesis; nullable on legacy
   *  rows. Read by the balancer to avoid stacking heavy stories. */
  editorialTone?: string | null
  topicCluster?: string | null
}

function isSafeStoredImage(row: StoryRow): boolean {
  return (
    row.imageSourceType === "STOCK" ||
    row.imageSourceType === "AGENCY" ||
    row.imageSourceType === "PUBLISHER_RSS" ||
    row.imageSourceType === "FALLBACK" ||
    isFallbackCardUrl(row.imageUrl)
  )
}

export default async function ApercuDecouverteV3Page(props: {
  searchParams?: Promise<SearchParams>
}) {
  return renderApercuDecouvertePage(props)
}

function shouldTryStockImage(row: StoryRow, imagePolicy: NewsImagePolicy): boolean {
  return (
    imagePolicy === "stockThenFallback" &&
    (row.imageSourceType === "FALLBACK" ||
      isFallbackCardUrl(row.imageUrl) ||
      !isSafeStoredImage(row))
  )
}

async function rowToCard(row: StoryRow, imagePolicy: NewsImagePolicy = "asStored"): Promise<ApercuNewsCardData> {
  if (shouldTryStockImage(row, imagePolicy)) {
    const stock = await findContextualStockPhoto({
      title: row.title,
      summary: row.summary,
      category: row.category,
    })
    if (stock) {
      return {
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        imageUrl: stock.url,
        imageCredit: stock.credit,
        imageLicenseUrl: stock.licenseUrl,
        category: row.category,
        publishedAt: row.publishedAt,
        sources: toSources(row.sources),
      }
    }
  }

  const safeFallback =
    imagePolicy !== "asStored" && !isSafeStoredImage(row)
      ? fallbackCard(row.category, row.title)
      : null

  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    imageUrl: safeFallback?.url ?? row.imageUrl,
    imageCredit: safeFallback?.credit ?? row.imageCredit,
    imageLicenseUrl: safeFallback?.licenseUrl ?? row.imageLicenseUrl,
    category: row.category,
    publishedAt: row.publishedAt,
    sources: toSources(row.sources),
  }
}

function normalizedPublisherName(name: string): string {
  const lower = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  if (lower.startsWith("numerama")) return "numerama"
  if (lower.startsWith("allocine")) return "allocine"
  if (lower.startsWith("20 minutes")) return "20-minutes"
  if (lower.startsWith("franceinfo")) return "franceinfo"
  if (lower.startsWith("la croix")) return "la-croix"
  if (lower.startsWith("le monde")) return "le-monde"
  if (lower.startsWith("telerama")) return "telerama"
  if (lower.startsWith("bbc")) return "bbc"

  return lower.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function sourceCount(r: StoryRow): number {
  if (!Array.isArray(r.sources)) return 0
  const publishers = new Set<string>()
  for (const source of r.sources) {
    if (typeof source !== "object" || source === null) continue
    const name = (source as { name?: unknown }).name
    if (typeof name === "string" && name.trim()) {
      publishers.add(normalizedPublisherName(name))
    }
  }
  return publishers.size
}

function hoursSincePublished(row: StoryRow): number {
  return Math.max(0, (Date.now() - new Date(row.publishedAt).getTime()) / (60 * 60 * 1000))
}

function compareByFreshness(rows: StoryRow[]) {
  return (a: StoryRow, b: StoryRow) => {
    const freshnessDelta = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    if (freshnessDelta !== 0) return freshnessDelta

    // Tie-break only: if two stories share the same timestamp, use the
    // family relevance and independent-source signal without letting
    // them override freshness.
    const relevanceDelta = b.relevanceScore - a.relevanceScore
    if (Math.abs(relevanceDelta) > 0.001) return relevanceDelta

    const sourceDelta = sourceCount(b) - sourceCount(a)
    if (sourceDelta !== 0) return sourceDelta

    return rows.findIndex((row) => row.id === a.id) - rows.findIndex((row) => row.id === b.id)
  }
}

function isExceptionalGameLead(row: StoryRow): boolean {
  if (row.category !== "GAMES") return true

  // Games can lead only when the signal is unusually strong for parents:
  // high family relevance plus genuinely independent coverage. This
  // keeps standard product/licence announcements from dominating the
  // first screen while still allowing a major family-safety or budget
  // story to surface.
  return row.relevanceScore >= 0.9 && sourceCount(row) >= 2
}

const LEAD_FRESHNESS_HOURS = 72
const SECTION_CARD_TARGET = 6
const SECTION_BACKFILL_POOL = 24

function splitFreshLeadRows(rows: StoryRow[]): { fresh: StoryRow[]; fallback: StoryRow[] } {
  const fresh: StoryRow[] = []
  const fallback: StoryRow[] = []

  for (const row of rows) {
    if (hoursSincePublished(row) <= LEAD_FRESHNESS_HOURS) fresh.push(row)
    else fallback.push(row)
  }

  return { fresh, fallback }
}

function pickFrenchHero(rows: StoryRow[]): StoryRow | undefined {
  if (rows.length === 0) return undefined

  const compare = compareByFreshness(rows)
  const { fresh } = splitFreshLeadRows(rows)
  const pool = fresh.length > 0 ? fresh : rows
  const parentFirst = pool.filter(isExceptionalGameLead)
  return [...(parentFirst.length > 0 ? parentFirst : pool)].sort(compare)[0]
}

function canUseInTopBriefs(row: StoryRow, hero: StoryRow | undefined, picked: StoryRow[]): boolean {
  if (row.category !== "GAMES") return true

  const gamesAlreadyVisible =
    (hero?.category === "GAMES" ? 1 : 0) +
    picked.filter((s) => s.category === "GAMES").length

  return gamesAlreadyVisible < 1 || isExceptionalGameLead(row)
}

function pickTopRows(rows: StoryRow[], hero: StoryRow | undefined, target: number): StoryRow[] {
  const { fresh, fallback } = splitFreshLeadRows(rows)
  const picked: StoryRow[] = []
  const deferredFresh: StoryRow[] = []

  for (const row of fresh.sort(compareByFreshness(rows))) {
    if (picked.length >= target) break
    if (canUseInTopBriefs(row, hero, picked)) {
      picked.push(row)
    } else {
      deferredFresh.push(row)
    }
  }

  // Freshness is the top priority: never pull an older fallback story
  // above a fresh story just to satisfy the games diversity guardrail.
  for (const row of deferredFresh) {
    if (picked.length >= target) break
    picked.push(row)
  }

  for (const row of fallback.sort(compareByFreshness(rows))) {
    if (picked.length >= target) break
    if (canUseInTopBriefs(row, hero, picked)) picked.push(row)
  }

  return picked.sort(compareByFreshness(rows))
}

/**
 * Pulls a "phrase du jour" candidate from a recent story body. Picks
 * the longest sentence under 220 chars from the most recent FR brief
 * — long enough to be substantive, short enough to render large.
 *
 * This is the Aperçu's quick-and-dirty source. The live cutover will
 * replace this with a daily LLM agent that picks more carefully.
 */
function extractPhrase(rows: StoryRow[]): { quote: string; storyTitle: string; storySlug: string } | null {
  for (const row of rows) {
    // Strip markdown: headings, lists, AND inline links — bodies are
    // now linkified (catalog titles get [text](/media/<id>) syntax),
    // and the phrase widget renders plain text, so the brackets and
    // url would otherwise leak through visibly.
    const cleaned = row.body
      .replace(/^#+ .*$/gm, "")
      .replace(/^\s*[-*]\s+/gm, "")
      // Inline link: [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Bold/italic markers (just in case the LLM emits any)
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\s+/g, " ")
      .trim()
    const sentences = cleaned.split(/(?<=[.!?])\s+(?=[A-Z«ÀÂÉÈÊËÎÏÔÙÛÜÇ])/)
    const candidates = sentences
      .map((s) => s.trim())
      .filter((s) => s.length >= 60 && s.length <= 220 && !s.includes("**"))
      .sort((a, b) => b.length - a.length) // prefer longer (more substantive)
    if (candidates[0]) {
      return {
        quote: candidates[0].replace(/^[«"]|[»"]$/g, "").trim(),
        storyTitle: row.title,
        storySlug: row.slug,
      }
    }
  }
  return null
}

/**
 * Curated list of recent scientific / institutional studies relevant
 * to French families. Aperçu uses a hand-picked list to validate the
 * UX; live cutover will source these from an RSS/Atom feed of Pew /
 * INSERM / Cairn / Common Sense Media research releases.
 */
const CURATED_ETUDES: EtudeRef[] = [
  {
    organization: "Pew Research Center",
    title: "Teens, Social Media and Technology 2024",
    url: "https://www.pewresearch.org/internet/2024/12/12/teens-social-media-and-technology-2024/",
    date: "déc. 2024",
  },
  {
    organization: "INSERM",
    title: "Effets des écrans sur le sommeil des adolescents",
    url: "https://www.inserm.fr/dossier/sommeil/",
    date: "2024",
  },
  {
    organization: "Common Sense Media",
    title: "The Common Sense Census: Media Use by Tweens and Teens",
    url: "https://www.commonsensemedia.org/research/the-common-sense-census-media-use-by-tweens-and-teens-2021",
    date: "2021",
  },
  {
    organization: "Santé publique France",
    title: "Santé mentale des jeunes — chiffres clés",
    url: "https://www.santepubliquefrance.fr/maladies-et-traumatismes/sante-mentale",
    date: "2024",
  },
]

export async function renderApercuDecouvertePage(props: {
  searchParams?: Promise<SearchParams>
}, options: { imagePolicy?: NewsImagePolicy; callbackUrl?: string } = {}) {
  const callbackUrl = options.callbackUrl ?? "/apercudecouverte-v3"
  const imagePolicy = options.imagePolicy ?? "asStored"
  let session
  try {
    session = await auth()
  } catch {
    redirect(`/connexion?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }
  if (!session?.user?.id) {
    redirect(`/connexion?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  const searchParams = await props.searchParams

  // ── Pull data in parallel ──────────────────────────────────────
  // Each fetch is individually fail-safe: any single failure logs a
  // warning and falls back to a safe empty value rather than taking
  // down the whole page. The page is rendered as a feed, so missing
  // a sidebar widget or a brief category degrades gracefully.
  const safe = <T,>(label: string, fallback: T) => (err: unknown): T => {
    console.warn(`[apercudecouverte-v3] ${label} failed:`, err)
    return fallback
  }

  // Resolve the user's saved weather city, then fetch the snapshot.
  // Wrapped together so the page-level Promise.all kicks off the
  // user lookup + weather fetch as a single dependent chain rather
  // than serially after the Promise.all completes.
  const userId = session.user.id
  // Resolve the saved city once, then fan out to weather + air quality.
  // Also surfaces a hasUserCity flag so the client widget can decide
  // whether to prompt for geolocation (only when the user is still on
  // the Paris default — never re-prompt someone who already picked).
  let hasUserCity = false
  const cityFlow = (async () => {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { weatherCityName: true, weatherCityLat: true, weatherCityLon: true },
    })
    if (u?.weatherCityName && u.weatherCityLat !== null && u.weatherCityLon !== null) {
      hasUserCity = true
      return { name: u.weatherCityName, lat: u.weatherCityLat, lon: u.weatherCityLon } satisfies WeatherCity
    }
    return DEFAULT_CITY
  })()
  const weatherFlow = cityFlow.then(async (city) => {
    const snapshot = await getWeatherForCity(city)
    return snapshot ?? { city, current: null, daily: [] }
  })
  const airQualityFlow = cityFlow.then(getAirQualityForCity)

  const [
    frenchRows,
    intlRows,
    techRows,
    dossierRow,
    researchRow,
    holidayB,
    holidayA,
    holidayC,
    holidayCalendar,
    anniversary,
    weather,
    airQuality,
    cinemaTendances,
    notableDates,
    deadlines,
  ] = await Promise.all([
    // Top 18 French briefs in the 4 main categories, ordered by
    // recency. We pull more than the 4 visible slots (hero + 3 top)
    // so the page-level image-dedup has room to backfill if the
    // first picks collide on imageUrl. The hero pick downstream
    // selects the most-recent multi-source story (sources.length >= 3)
    // — recency-first ordering means the hero is also the freshest
    // serious news, not just the highest-relevance ever. TECH excluded
    // — it has its own 'Tech & IA' section below.
    prisma.newsStory.findMany({
      where: {
        status: "PUBLISHED",
        storyType: "BRIEF",
        region: "FR",
        category: { in: ["PARENTHOOD", "FILM_TV", "GAMES", "READING"] },
      },
      orderBy: { publishedAt: "desc" },
      take: 18,
      select: {
        id: true, slug: true, title: true, summary: true, body: true,
        imageUrl: true, imageCredit: true, imageLicenseUrl: true, imageSourceType: true,
        category: true, publishedAt: true, relevanceScore: true, sources: true,
        // Editorial supervision tags — fed into balanceNewsForFeed
        // below so the hero is never a grave story and we never stack
        // two stories from the same topicCluster (e.g. two teen-suicide
        // pieces side-by-side, the original failure mode that started
        // this work).
        editorialTone: true, topicCluster: true,
      },
    }).catch(safe("frenchRows", [] as StoryRow[])),
    // 6 most recent international briefs in PARENTHOOD only.
    // Editorial choice (Xavier, May 2026): "Ce qu'on lit ailleurs" is
    // for world news about kids, family policy, screen-time studies,
    // education debates, society issues that touch families — NOT
    // international entertainment industry news. GAMES, FILM_TV and
    // TECH already get their own treatment elsewhere on the page, so
    // mixing them in here just dilutes the section. Restricting to
    // PARENTHOOD keeps the strand on-point.
    prisma.newsStory.findMany({
      where: {
        status: "PUBLISHED",
        storyType: "BRIEF",
        region: "INTL",
        category: "PARENTHOOD",
      },
      orderBy: { publishedAt: "desc" },
      take: SECTION_BACKFILL_POOL,
      select: {
        id: true, slug: true, title: true, summary: true, body: true,
        imageUrl: true, imageCredit: true, imageLicenseUrl: true, imageSourceType: true,
        category: true, publishedAt: true, relevanceScore: true, sources: true,
        editorialTone: true, topicCluster: true,
      },
    }).catch(safe("intlRows", [] as StoryRow[])),
    // 6 most recent TECH briefs (FR + INTL mixed). Renders as a
    // dedicated "Tech & IA" section between the main French grid and
    // the dossier — Xavier's call: families need to be way more aware
    // of generative AI / parental tech / online safety.
    prisma.newsStory.findMany({
      where: { status: "PUBLISHED", storyType: "BRIEF", category: "TECH" },
      orderBy: { publishedAt: "desc" },
      take: SECTION_BACKFILL_POOL,
      select: {
        id: true, slug: true, title: true, summary: true, body: true,
        imageUrl: true, imageCredit: true, imageLicenseUrl: true, imageSourceType: true,
        category: true, publishedAt: true, relevanceScore: true, sources: true,
      },
    }).catch(safe("techRows", [] as StoryRow[])),
    // Latest dossier (past 5 days). Sized for the Tue/Fri cadence:
    // the most recent dossier is always within 4 days; if a cron run
    // failed and the latest is older than 5 days, the page hides the
    // dossier section rather than showing stale content.
    prisma.newsStory.findFirst({
      where: {
        status: "PUBLISHED",
        storyType: "DOSSIER",
        // eslint-disable-next-line react-hooks/purity -- server component, fresh per-request render is correct
        publishedAt: { gte: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true, slug: true, title: true, summary: true, body: true,
        imageUrl: true, imageCredit: true, imageLicenseUrl: true, imageSourceType: true,
        category: true, publishedAt: true, relevanceScore: true, sources: true,
      },
    }).catch(safe<StoryRow | null>("dossierRow", null)),
    // Latest story carrying a populated research sidebar.
    prisma.newsStory.findFirst({
      where: { status: "PUBLISHED", research: { not: Prisma.JsonNull } },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true, slug: true, title: true, research: true,
      },
    }).catch(safe<{ id: string; slug: string; title: string; research: Prisma.JsonValue | null } | null>("researchRow", null)),
    // Sidebar widgets — wrapped defensively so an external API blip
    // (data.education.gouv.fr, open-meteo) or a transient DB error in
    // the catalog query can't surface as a server-render failure.
    getNextHoliday("B").catch(safe<Awaited<ReturnType<typeof getNextHoliday>>>("holidayB", null)),
    getNextHoliday("A").catch(safe<Awaited<ReturnType<typeof getNextHoliday>>>("holidayA", null)),
    getNextHoliday("C").catch(safe<Awaited<ReturnType<typeof getNextHoliday>>>("holidayC", null)),
    getHolidayCalendar().catch(safe<CalendarHoliday[]>("holidayCalendar", [])),
    getCatalogAnniversary().catch(safe<Awaited<ReturnType<typeof getCatalogAnniversary>>>("anniversary", null)),
    weatherFlow.catch(
      safe<{ city: WeatherCity; current: null; daily: [] }>("weather", {
        city: DEFAULT_CITY,
        current: null,
        daily: [],
      }),
    ),
    airQualityFlow.catch(safe<Awaited<typeof airQualityFlow>>("airQuality", null)),
    getCinemaTendances().catch(safe<Awaited<ReturnType<typeof getCinemaTendances>>>("cinemaTendances", [])),
    // Curated lists — pure JS, fail-open shouldn't be needed but the
    // safe wrapper keeps the failure-mode pattern consistent.
    Promise.resolve(getUpcomingNotableDates()).catch(safe<NotableDateInstance[]>("notableDates", [])),
    Promise.resolve(getUpcomingDeadlines()).catch(safe<DeadlineInstance[]>("deadlines", [])),
  ])

  // Editorial supervision pass — invisible to the reader. Rebalances
  // the top 6 of the recency-sorted feed so the hero is never a
  // "grave" story and no two consecutive cards share the same
  // topicCluster (e.g. two teen-suicide pieces side-by-side, the
  // failure mode that started this work). The tail of the feed is
  // untouched. Falls back to identity for rows that pre-date the
  // editorial-judge backfill (null tone → treated as neutral).
  const balancedFrenchRows = balanceNewsForFeed(frenchRows, 6)

  // Hero pick — freshness first, with a parent-first guardrail. The
  // newest suitable story leads, but standard game/product/licence
  // announcements cannot set the tone of the whole page unless their
  // family signal is exceptional.
  const frenchHero = pickFrenchHero(balancedFrenchRows)
  const frenchRest = frenchHero
    ? balancedFrenchRows.filter((row) => row.id !== frenchHero.id)
    : balancedFrenchRows

  // Page-level image dedup: dossier wins (it's the editorial centerpiece),
  // then hero, then top briefs, then INTL, then older. Any later card
  // sharing an already-claimed imageUrl is filtered out so the same
  // photo never appears twice on the same page render. Particularly
  // matters when a dossier and a brief both pull from the same source
  // (la-croix.com publishes one photo for an entire event sequence).
  const seenImages = new Set<string>()
  const claim = <T extends { imageUrl?: string | null }>(card: T): T | null => {
    if (!card.imageUrl) return null
    if (isBlockedHotlinkImageUrl(card.imageUrl)) return null
    // Branded category fallback cards (/api/news/fallback-card?cat=…)
    // are shared by design — multiple image-less stories in the same
    // category use the same URL — so they're exempt from cross-story
    // dedup. Without this exemption, the second PARENTHOOD fallback
    // on the page would be silently dropped, leaving an empty slot
    // in the 3-up grid.
    if (isFallbackCardUrl(card.imageUrl)) return card
    if (seenImages.has(card.imageUrl)) return null
    seenImages.add(card.imageUrl)
    return card
  }

  const claimSectionRows = async (
    rows: StoryRow[],
    target = SECTION_CARD_TARGET,
  ): Promise<ApercuNewsCardData[]> => {
    const cards: ApercuNewsCardData[] = []
    for (const row of rows) {
      if (cards.length >= target) break
      const card = claim(await rowToCard(row, imagePolicy))
      if (card) cards.push(card)
    }
    return cards
  }

  const dossierCard = dossierRow ? claim(await rowToCard(dossierRow, imagePolicy)) : null
  const heroCard = frenchHero ? claim(await rowToCard(frenchHero, imagePolicy)) : null

  // Backfill loop: walk frenchRest in chronological order, accumulate
  // up to 3 surviving (post-dedup) cards into topCards, then push the
  // rest into olderCards. Guarantees the "L'actualité qui compte" 3-up
  // grid is always full as long as enough French briefs exist after
  // dedup — no more visible empty slots when an image collides with
  // the hero or dossier.
  //
  // We over-pick from pickTopRows (TOP_TARGET + 6) so that if claim()
  // rejects a candidate (image collision with hero/dossier, hotlink
  // block), the loop has fresh fallbacks ready instead of just
  // skipping the slot.
  const TOP_TARGET = 3
  const topCards: ApercuNewsCardData[] = []
  const olderCards: ApercuNewsCardData[] = []
  const topPickedIds = new Set<string>()
  for (const row of pickTopRows(frenchRest, frenchHero, TOP_TARGET + 6)) {
    if (topCards.length >= TOP_TARGET) break
    const card = claim(await rowToCard(row, imagePolicy))
    if (!card) continue
    topCards.push(card)
    topPickedIds.add(row.id)
  }

  for (const row of frenchRest) {
    if (topPickedIds.has(row.id)) continue
    const card = claim(await rowToCard(row, imagePolicy))
    if (!card) continue
    olderCards.push(card)
  }

  const intlCards = await claimSectionRows(intlRows)
  const techCards = await claimSectionRows(techRows)

  // Freshness flag — true when the chosen hero is older than 36h.
  // Surfaces a small banner on the page so a stale state (cron stuck,
  // synthesis returning 0 stories) is visible to visitors instead of
  // looking like a working page with old content. 36h is a deliberately
  // generous window so a single missed cron tick doesn't trigger the
  // banner (cron fires 4× daily — worst-case tick interval is 6h).
  const STALE_THRESHOLD_MS = 36 * 60 * 60 * 1000
  const isStale =
    !!frenchHero &&
    // eslint-disable-next-line react-hooks/purity -- server component, fresh per-request render is correct
    Date.now() - new Date(frenchHero.publishedAt).getTime() > STALE_THRESHOLD_MS

  const data: DecouverteV3Data = {
    frenchHero: heroCard,
    frenchTop: topCards,
    internationalTop: intlCards,
    techTop: techCards,
    dossier: dossierCard,
    olderBriefs: olderCards,
    isStale,
    phrase: extractPhrase(frenchRows),
    research: researchRow
      ? (() => {
          const r = toResearch((researchRow as { research?: Prisma.JsonValue | null }).research ?? null)
          return r
            ? { research: r, storyTitle: researchRow.title, storySlug: researchRow.slug }
            : null
        })()
      : null,
    etudes: CURATED_ETUDES,
    cinemaTendances,
    holidayB: holidayToSerializable(holidayB),
    holidayA: holidayToSerializable(holidayA),
    holidayC: holidayToSerializable(holidayC),
    holidayCalendar,
    anniversary,
    weather,
    hasUserCity,
    airQuality,
    notableDates,
    deadlines,
    // Newsletter signup is admin-only until Xavier validates the
    // digest format + cron automation. Flip NEWSLETTER_PUBLIC=true
    // on Vercel to open it to all authenticated users.
    canSubscribe:
      session.user.role === "ADMIN" || process.env.NEWSLETTER_PUBLIC === "true",
  }

  const useFraunces = isFraunces(searchParams?.font)
  const serifClass = useFraunces
    ? fraunces.className
    : "font-[var(--font-heading)]"

  return (
    <div className={useFraunces ? fraunces.variable : undefined}>
      {hydrationDebugEnabled ? (
        <HydrationDebugBoundary>
          <ApercuDecouverteV3 data={data} serifClass={serifClass} />
        </HydrationDebugBoundary>
      ) : (
        <ApercuDecouverteV3 data={data} serifClass={serifClass} />
      )}
    </div>
  )
}
