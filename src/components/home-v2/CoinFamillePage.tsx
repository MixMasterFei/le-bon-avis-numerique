"use client"

import Link from "next/link"
import { ArrowRight, Users } from "lucide-react"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { DeferUntilVisible } from "@/components/home-redesign/DeferUntilVisible"
import { CoinFamillePicksRail } from "@/components/home-redesign/CoinFamillePicksRail"
import { CoinFamilleUpcomingRail } from "@/components/home-redesign/CoinFamilleUpcomingRail"
import { CoinFamilleNewsCard } from "./CoinFamilleNewsCard"
import type { CoinFamilleNewsItem } from "@/lib/coin-famille-news"
import { homepageRailLabel, type HomepageState } from "@/lib/homepage-time-context"
import { APERCU_PALETTE } from "./apercuTheme"
import { MeteoFamilleCard } from "./MeteoFamilleCard"
import { AirQualiteCard } from "./AirQualiteCard"
import { PenseBeteCard } from "./PenseBeteCard"
import { VacancesScolairesCard, type SerializableHoliday } from "./VacancesScolairesCard"
import { JourANoterCard } from "./JourANoterCard"
import { AnniversaireCard } from "./AnniversaireCard"
import { CinemaTendancesCard } from "./CinemaTendancesCard"
import { SourcesTrustCard } from "./SourcesTrustCard"
import type { WeatherSnapshot } from "@/lib/weather"
import type { AirQualitySnapshot } from "@/lib/air-quality"
import type { CalendarHoliday } from "@/lib/school-holidays"
import type { NotableDateInstance } from "@/lib/notable-dates"
import type { DeadlineInstance } from "@/lib/family-deadlines"
import type { CatalogAnniversary } from "@/lib/catalog-anniversary"
import type { CinemaTendance } from "@/lib/news-cinema-tendances"
import { CoinFamilleProfileNudge, type ProfileNudgeMember } from "./CoinFamilleProfileNudge"

export interface CoinFamilleData {
  news: CoinFamilleNewsItem[]
  hasFamily: boolean
  timeState: HomepageState
  timeSubtitle: string
  profileNudges: ProfileNudgeMember[]
  // Right-rail (reused from the aperçu "Le foyer" stack).
  weather: WeatherSnapshot
  hasUserCity: boolean
  airQuality: AirQualitySnapshot | null
  holidayB: SerializableHoliday | null
  holidayA: SerializableHoliday | null
  holidayC: SerializableHoliday | null
  holidayCalendar: CalendarHoliday[]
  notableDates: NotableDateInstance[]
  deadlines: DeadlineInstance[]
  anniversary: CatalogAnniversary | null
  cinemaTendances: CinemaTendance[]
}

export function CoinFamillePage({ data, serifClass }: { data: CoinFamilleData; serifClass: string }) {
  const p = APERCU_PALETTE
  const pageLabel = homepageRailLabel(data.timeState)

  const RightRail = (
    <div className="flex flex-col gap-4">
      <MeteoFamilleCard initial={data.weather} hasUserCity={data.hasUserCity} serifClass={serifClass} />
      {data.airQuality && <AirQualiteCard snapshot={data.airQuality} serifClass={serifClass} />}
      {data.deadlines.length > 0 && <PenseBeteCard deadlines={data.deadlines} serifClass={serifClass} />}
      <VacancesScolairesCard
        initialFR={data.holidayB}
        initialZoneA={data.holidayA}
        initialZoneC={data.holidayC}
        calendar={data.holidayCalendar}
        serifClass={serifClass}
      />
      {data.notableDates.length > 0 && <JourANoterCard dates={data.notableDates} serifClass={serifClass} />}
      {data.anniversary && <AnniversaireCard anniversary={data.anniversary} serifClass={serifClass} />}
      {data.cinemaTendances.length > 0 && <CinemaTendancesCard tendances={data.cinemaTendances} serifClass={serifClass} />}
      <SourcesTrustCard serifClass={serifClass} />
    </div>
  )

  return (
    <FamilyFitProvider>
      <div className="flex flex-col min-h-screen overflow-x-hidden" style={{ background: p.bg, color: p.ink }}>
        <section className="py-6 md:py-8">
          <div className="container mx-auto px-4 md:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-12 items-start">
              {/* ─────── MAIN COLUMN ─────── */}
              <main className="min-w-0 flex flex-col gap-8">
                {/* Header — Coin Famille vs Profil made explicit */}
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: p.accent }}>
                    Le Coin Famille
                  </div>
                  <h1
                    className={`${serifClass} text-2xl md:text-4xl font-medium leading-[1.05] max-w-2xl text-balance`}
                    style={{ color: p.ink, letterSpacing: "-0.02em" }}
                  >
                    {pageLabel.prefix}
                    <em className="italic" style={{ color: p.accent }}>
                      {pageLabel.emphasis}
                    </em>
                    {pageLabel.suffix}
                  </h1>
                  <p className="mt-2 text-sm md:text-[15px]" style={{ color: p.ink2 }}>
                    {pageLabel.lead}{" "}
                    {data.timeSubtitle && (
                      <span className="font-medium" style={{ color: p.ink }}>
                        · {data.timeSubtitle}
                      </span>
                    )}{" "}
                    <Link href="/profil" className="inline-flex items-center gap-1 font-semibold underline underline-offset-2" style={{ color: p.ink }}>
                      <Users className="h-3.5 w-3.5" /> Gérer ma famille
                    </Link>
                  </p>
                </div>

                {/* Personalized heart — one request, then instant family/member
                    tabs. This leads the page; generic editorial news comes after
                    the useful, household-specific choices. */}
                {data.hasFamily ? (
                  <div className="flex flex-col gap-8">
                    {data.profileNudges.length > 0 && <CoinFamilleProfileNudge members={data.profileNudges} />}
                    <DeferUntilVisible minHeight={300}>
                      <CoinFamillePicksRail serifClass={serifClass} />
                    </DeferUntilVisible>
                    <DeferUntilVisible minHeight={300}>
                      <CoinFamilleUpcomingRail serifClass={serifClass} timeState={data.timeState} />
                    </DeferUntilVisible>
                  </div>
                ) : (
                  <div className="rounded-2xl p-6" style={{ background: p.card, border: `1px solid ${p.line}` }}>
                    <h3 className={`${serifClass} text-xl font-medium`} style={{ color: p.ink }}>
                      Des suggestions sur-mesure pour votre foyer
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: p.ink2 }}>
                      Créez un profil famille (âges, goûts, sensibilités) pour voir ici les films, séries et
                      jeux qui correspondent vraiment à chaque membre — et les sorties à venir faites pour vous.
                    </p>
                    <Link
                      href="/profil"
                      className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
                      style={{ background: p.ink, color: p.bg }}
                    >
                      Créer mon profil famille
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}

                {/* Curated news — useful context, deliberately secondary to the
                    personalized media choices. */}
                <div>
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: p.ink2 }}>
                    L&apos;essentiel pour les parents
                  </div>
                  {data.news.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                      {data.news.slice(0, 6).map((story) => (
                        <CoinFamilleNewsCard key={story.slug} story={story} serifClass={serifClass} />
                      ))}
                    </div>
                  ) : (
                    <div
                      className="rounded-2xl px-5 py-6 text-center"
                      style={{ background: p.card, border: `1px solid ${p.line}` }}
                    >
                      <p className={`${serifClass} text-lg font-medium`} style={{ color: p.ink }}>
                        Rien d’essentiel à signaler aujourd’hui
                      </p>
                      <p className="mt-1 text-sm" style={{ color: p.ink2 }}>
                        Nous préférons une sélection courte et utile plutôt qu’un fil rempli pour rien.
                      </p>
                    </div>
                  )}
                </div>

                {/* Mobile: the "Le foyer" rail inlined after the feed */}
                <div className="lg:hidden flex flex-col gap-4 mt-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: p.ink2 }}>
                    Le foyer
                  </div>
                  {RightRail}
                </div>
              </main>

              {/* ─────── DESKTOP STICKY SIDEBAR ─────── */}
              <aside className="hidden lg:block">{RightRail}</aside>
            </div>
          </div>
        </section>
      </div>
    </FamilyFitProvider>
  )
}
