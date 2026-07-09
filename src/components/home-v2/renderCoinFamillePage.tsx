import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { coinFamilleEnabled } from "@/lib/coin-famille-flag"
import { CoinFamillePage, type CoinFamilleData } from "./CoinFamillePage"
import { getCoinFamilleNews, type CoinFamilleNewsItem } from "@/lib/coin-famille-news"
import { getNextHoliday, getHolidayCalendar, holidayToSerializable, type CalendarHoliday } from "@/lib/school-holidays"
import { getCatalogAnniversary } from "@/lib/catalog-anniversary"
import { getWeatherForCity, DEFAULT_CITY, type WeatherCity } from "@/lib/weather"
import { getAirQualityForCity } from "@/lib/air-quality"
import { getCinemaTendances } from "@/lib/news-cinema-tendances"
import { getUpcomingNotableDates, type NotableDateInstance } from "@/lib/notable-dates"
import { getUpcomingDeadlines, type DeadlineInstance } from "@/lib/family-deadlines"
import { fraunces } from "./apercuFont"

// Server renderer for "Le Coin Famille" — the daily family home base. Modeled
// on renderApercuDecouvertePage: one fail-safe Promise.all gathers the reused
// right-rail data plus the curated news strand; the two personalized media
// rails fetch their own APIs client-side (deferred). Fully auth-personalized —
// the route declares `dynamic = "force-dynamic"`.

function isValidWeatherCity(city: WeatherCity): boolean {
  return (
    city.name.trim().length > 0 &&
    Number.isFinite(city.lat) &&
    Number.isFinite(city.lon) &&
    Math.abs(city.lat) <= 90 &&
    Math.abs(city.lon) <= 180
  )
}

export async function renderCoinFamillePage() {
  let session
  try {
    session = await auth()
  } catch {
    redirect("/connexion?callbackUrl=/coin-famille")
  }
  if (!session?.user?.id) {
    redirect("/connexion?callbackUrl=/coin-famille")
  }

  // Admin-only during build-out (COIN_FAMILLE_PUBLIC=true opens it up). 404 for
  // everyone else so the page is invisible until launch.
  if (!coinFamilleEnabled(session.user.role === "ADMIN")) {
    notFound()
  }

  const userId = session.user.id
  const safe = <T,>(label: string, fallback: T) => (err: unknown): T => {
    console.warn(`[coin-famille] ${label} failed:`, err)
    return fallback
  }

  // Resolve the saved weather city once, then fan out to weather + air quality
  // (same pattern as the aperçu "Le foyer" rail — user's stored city, else Paris).
  let hasUserCity = false
  const cityFlow = (async () => {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { weatherCityName: true, weatherCityLat: true, weatherCityLon: true },
    })
    if (u?.weatherCityName && u.weatherCityLat !== null && u.weatherCityLon !== null) {
      const city = { name: u.weatherCityName, lat: u.weatherCityLat, lon: u.weatherCityLon } satisfies WeatherCity
      if (isValidWeatherCity(city)) {
        hasUserCity = true
        return city
      }
    }
    return DEFAULT_CITY
  })()
  const weatherFlow = cityFlow.then(async (city) => {
    const snapshot = await getWeatherForCity(city)
    if (snapshot?.current) return snapshot
    if (city.name !== DEFAULT_CITY.name || city.lat !== DEFAULT_CITY.lat || city.lon !== DEFAULT_CITY.lon) {
      const fallback = await getWeatherForCity(DEFAULT_CITY)
      if (fallback?.current) return fallback
    }
    return { city: DEFAULT_CITY, current: null, daily: [] }
  })
  const airQualityFlow = cityFlow.then(getAirQualityForCity)

  const [
    news,
    memberCount,
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
    getCoinFamilleNews(6).catch(safe<CoinFamilleNewsItem[]>("news", [])),
    prisma.familyMember.count({ where: { userId } }).catch(safe<number>("memberCount", 0)),
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
    Promise.resolve(getUpcomingNotableDates()).catch(safe<NotableDateInstance[]>("notableDates", [])),
    Promise.resolve(getUpcomingDeadlines()).catch(safe<DeadlineInstance[]>("deadlines", [])),
  ])

  const data: CoinFamilleData = {
    news,
    hasFamily: memberCount > 0,
    weather,
    hasUserCity,
    airQuality,
    holidayB: holidayToSerializable(holidayB),
    holidayA: holidayToSerializable(holidayA),
    holidayC: holidayToSerializable(holidayC),
    holidayCalendar,
    notableDates,
    deadlines,
    anniversary,
    cinemaTendances,
  }

  return <CoinFamillePage data={data} serifClass={fraunces.className} />
}
