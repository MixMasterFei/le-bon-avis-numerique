"use client"

import Link from "next/link"
import { ArrowRight, Users } from "lucide-react"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { DeferUntilVisible } from "@/components/home-redesign/DeferUntilVisible"
import { CoinFamillePicksRail } from "@/components/home-redesign/CoinFamillePicksRail"
import { CoinFamilleUpcomingRail } from "@/components/home-redesign/CoinFamilleUpcomingRail"
import { CoinFamilleNewsCard } from "./CoinFamilleNewsCard"
import type { CoinFamilleNewsItem } from "@/lib/coin-famille-news"
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

export interface CoinFamilleData {
  news: CoinFamilleNewsItem[]
  hasFamily: boolean
  familyMembers: { id: string; name: string }[]
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

// One named "Pour <name>" rail per member (capped so a big family doesn't
// produce a wall of rails — the rest still get the family + upcoming rails).
const MAX_MEMBER_RAILS = 4

export function CoinFamillePage({ data, serifClass }: { data: CoinFamilleData; serifClass: string }) {
  const p = APERCU_PALETTE

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
                    Votre rendez-vous{" "}
                    <em className="italic" style={{ color: p.accent }}>
                      famille
                    </em>{" "}
                    du jour
                  </h1>
                  <p className="mt-2 text-sm md:text-[15px]" style={{ color: p.ink2 }}>
                    Actus utiles, sorties et idées — choisies pour votre foyer.{" "}
                    <Link href="/profil" className="inline-flex items-center gap-1 font-semibold underline underline-offset-2" style={{ color: p.ink }}>
                      <Users className="h-3.5 w-3.5" /> Gérer ma famille
                    </Link>
                  </p>
                </div>

                {/* Curated news — compact, always-imaged, 2 rows on desktop */}
                {data.news.length > 0 && (
                  <div>
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: p.ink2 }}>
                      À lire aujourd&apos;hui
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {data.news.slice(0, 8).map((s) => (
                        <CoinFamilleNewsCard key={s.slug} story={s} serifClass={serifClass} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Personalized categories — one per member + the whole family +
                    upcoming. Each is deferred and self-hides when thin. */}
                {data.hasFamily ? (
                  <div className="flex flex-col gap-8">
                    <DeferUntilVisible minHeight={300}>
                      <CoinFamillePicksRail
                        serifClass={serifClass}
                        eyebrow="Toute la famille"
                        title="À regarder tous ensemble"
                        memberIds={[]}
                      />
                    </DeferUntilVisible>
                    {data.familyMembers.slice(0, MAX_MEMBER_RAILS).map((m) => (
                      <DeferUntilVisible key={m.id} minHeight={300}>
                        <CoinFamillePicksRail
                          serifClass={serifClass}
                          eyebrow="Rien que pour"
                          title={`Pour ${m.name}`}
                          memberIds={[m.id]}
                        />
                      </DeferUntilVisible>
                    ))}
                    <DeferUntilVisible minHeight={300}>
                      <CoinFamilleUpcomingRail serifClass={serifClass} />
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
