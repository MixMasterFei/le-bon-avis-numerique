import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ApercuDecouverteV3, type DecouverteV3Data } from "@/components/home-v2/ApercuDecouverteV3"
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
import { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"
// Note: `revalidate` removed — incompatible with `force-dynamic` and
// every render is per-request anyway. Cron writes news to the DB, the
// page reads it on each visit (auth-gated, low traffic).

interface SearchParams {
  font?: string
}

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
  category: ApercuNewsCardData["category"]
  publishedAt: Date
  sources: Prisma.JsonValue
}

function rowToCard(row: StoryRow): ApercuNewsCardData {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    imageUrl: row.imageUrl,
    imageCredit: row.imageCredit,
    imageLicenseUrl: row.imageLicenseUrl,
    category: row.category,
    publishedAt: row.publishedAt,
    sources: toSources(row.sources),
  }
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

export default async function ApercuDecouverteV3Page(props: {
  searchParams?: Promise<SearchParams>
}) {
  let session
  try {
    session = await auth()
  } catch {
    redirect("/connexion?callbackUrl=/apercudecouverte-v3")
  }
  if (!session?.user?.id) {
    redirect("/connexion?callbackUrl=/apercudecouverte-v3")
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
        imageUrl: true, imageCredit: true, imageLicenseUrl: true,
        category: true, publishedAt: true, sources: true,
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
      take: 6,
      select: {
        id: true, slug: true, title: true, summary: true, body: true,
        imageUrl: true, imageCredit: true, imageLicenseUrl: true,
        category: true, publishedAt: true, sources: true,
      },
    }).catch(safe("intlRows", [] as StoryRow[])),
    // 6 most recent TECH briefs (FR + INTL mixed). Renders as a
    // dedicated "Tech & IA" section between the main French grid and
    // the dossier — Xavier's call: families need to be way more aware
    // of generative AI / parental tech / online safety.
    prisma.newsStory.findMany({
      where: { status: "PUBLISHED", storyType: "BRIEF", category: "TECH" },
      orderBy: { publishedAt: "desc" },
      take: 6,
      select: {
        id: true, slug: true, title: true, summary: true, body: true,
        imageUrl: true, imageCredit: true, imageLicenseUrl: true,
        category: true, publishedAt: true, sources: true,
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
        imageUrl: true, imageCredit: true, imageLicenseUrl: true,
        category: true, publishedAt: true, sources: true,
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

  // Hero pick — prefer the first row with sources.length >= 3 so the
  // prominent slot is always a multi-source story (Perplexity-style
  // editorial signal: more sources = more newsworthy). Falls back to
  // the highest-source-count row if none reach 3, then to the first
  // row regardless. The query already orders by relevanceScore desc,
  // so within the eligible-by-sources subset we get the strongest
  // candidate too.
  function sourceCount(r: StoryRow): number {
    return Array.isArray(r.sources) ? r.sources.length : 0
  }
  const heroIdx = (() => {
    if (frenchRows.length === 0) return -1
    const multi = frenchRows.findIndex((r) => sourceCount(r) >= 3)
    if (multi !== -1) return multi
    // No 3+ source row — pick the one with the most sources, ties
    // broken by the existing query order (relevanceScore desc).
    let best = 0
    let bestCount = sourceCount(frenchRows[0])
    for (let i = 1; i < frenchRows.length; i++) {
      const c = sourceCount(frenchRows[i])
      if (c > bestCount) {
        best = i
        bestCount = c
      }
    }
    return best
  })()
  const frenchHero = heroIdx >= 0 ? frenchRows[heroIdx] : undefined
  // After hero removal, the rest is in chronological order (the query
  // is publishedAt DESC). The "top 3" + "older briefs" split happens
  // below, after image-dedup, so the visible top grid is always full
  // even when collisions remove a card.
  const frenchRest = heroIdx >= 0
    ? [...frenchRows.slice(0, heroIdx), ...frenchRows.slice(heroIdx + 1)]
    : frenchRows

  // Page-level image dedup: dossier wins (it's the editorial centerpiece),
  // then hero, then top briefs, then INTL, then older. Any later card
  // sharing an already-claimed imageUrl is filtered out so the same
  // photo never appears twice on the same page render. Particularly
  // matters when a dossier and a brief both pull from the same source
  // (la-croix.com publishes one photo for an entire event sequence).
  const seenImages = new Set<string>()
  const claim = <T extends { imageUrl?: string | null }>(card: T): T | null => {
    if (!card.imageUrl) return null
    if (seenImages.has(card.imageUrl)) return null
    seenImages.add(card.imageUrl)
    return card
  }
  const dossierCard = dossierRow ? claim(rowToCard(dossierRow)) : null
  const heroCard = frenchHero ? claim(rowToCard(frenchHero)) : null

  // Backfill loop: walk frenchRest in chronological order, accumulate
  // up to 3 surviving (post-dedup) cards into topCards, then push the
  // rest into olderCards. Guarantees the "L'actualité qui compte" 3-up
  // grid is always full as long as enough French briefs exist after
  // dedup — no more visible empty slots when an image collides with
  // the hero or dossier.
  const TOP_TARGET = 3
  const topCards: ApercuNewsCardData[] = []
  const olderCards: ApercuNewsCardData[] = []
  for (const row of frenchRest) {
    const card = claim(rowToCard(row))
    if (!card) continue
    if (topCards.length < TOP_TARGET) topCards.push(card)
    else olderCards.push(card)
  }

  const intlCards = intlRows.map(rowToCard).map(claim).filter((c): c is NonNullable<typeof c> => c !== null)
  const techCards = techRows.map(rowToCard).map(claim).filter((c): c is NonNullable<typeof c> => c !== null)

  const data: DecouverteV3Data = {
    frenchHero: heroCard,
    frenchTop: topCards,
    internationalTop: intlCards,
    techTop: techCards,
    dossier: dossierCard,
    olderBriefs: olderCards,
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
      <ApercuDecouverteV3 data={data} serifClass={serifClass} />
    </div>
  )
}
