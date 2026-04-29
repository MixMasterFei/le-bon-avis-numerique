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
  return raw.flatMap((entry): NewsSourceRef[] => {
    if (typeof entry !== "object" || entry === null) return []
    const e = entry as Record<string, unknown>
    const name = typeof e.name === "string" ? e.name : ""
    const url = typeof e.url === "string" ? e.url : ""
    if (!name || !url) return []
    return [
      {
        name,
        url,
        favicon: typeof e.favicon === "string" ? e.favicon : undefined,
        headline: typeof e.headline === "string" ? e.headline : undefined,
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
    // Strip markdown headings + lists, then split on French sentence punct.
    const cleaned = row.body
      .replace(/^#+ .*$/gm, "")
      .replace(/^\s*[-*]\s+/gm, "")
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
    redirect("/connexion?next=/apercudecouverte-v3")
  }
  if (!session?.user?.id) {
    redirect("/connexion?next=/apercudecouverte-v3")
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
  const cityFlow = (async () => {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { weatherCityName: true, weatherCityLat: true, weatherCityLon: true },
    })
    const city: WeatherCity =
      u?.weatherCityName && u.weatherCityLat !== null && u.weatherCityLon !== null
        ? { name: u.weatherCityName, lat: u.weatherCityLat, lon: u.weatherCityLon }
        : DEFAULT_CITY
    return city
  })()
  const weatherFlow = cityFlow.then(async (city) => {
    const snapshot = await getWeatherForCity(city)
    return snapshot ?? { city, current: null, daily: [] }
  })
  const airQualityFlow = cityFlow.then(getAirQualityForCity)

  const [
    frenchRows,
    intlRows,
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
    // 12 most recent French briefs (1 hero + 3 top + ~8 older).
    prisma.newsStory.findMany({
      where: { status: "PUBLISHED", storyType: "BRIEF", region: "FR" },
      orderBy: { publishedAt: "desc" },
      take: 12,
      select: {
        id: true, slug: true, title: true, summary: true, body: true,
        imageUrl: true, category: true, publishedAt: true, sources: true,
      },
    }).catch(safe("frenchRows", [] as StoryRow[])),
    // 6 most recent international briefs.
    prisma.newsStory.findMany({
      where: { status: "PUBLISHED", storyType: "BRIEF", region: "INTL" },
      orderBy: { publishedAt: "desc" },
      take: 6,
      select: {
        id: true, slug: true, title: true, summary: true, body: true,
        imageUrl: true, category: true, publishedAt: true, sources: true,
      },
    }).catch(safe("intlRows", [] as StoryRow[])),
    // Latest weekly dossier (past 14 days).
    prisma.newsStory.findFirst({
      where: {
        status: "PUBLISHED",
        storyType: "DOSSIER",
        // eslint-disable-next-line react-hooks/purity -- server component, fresh per-request render is correct
        publishedAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true, slug: true, title: true, summary: true, body: true,
        imageUrl: true, category: true, publishedAt: true, sources: true,
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

  const [frenchHero, ...frenchRest] = frenchRows
  const frenchTop = frenchRest.slice(0, 3)
  const olderBriefs = frenchRest.slice(3) // remainder

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
  const topCards = frenchTop.map(rowToCard).map(claim).filter((c): c is NonNullable<typeof c> => c !== null)
  const intlCards = intlRows.map(rowToCard).map(claim).filter((c): c is NonNullable<typeof c> => c !== null)
  const olderCards = olderBriefs.map(rowToCard).map(claim).filter((c): c is NonNullable<typeof c> => c !== null)

  const data: DecouverteV3Data = {
    frenchHero: heroCard,
    frenchTop: topCards,
    internationalTop: intlCards,
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
