"use client"

import { ApercuPreviewBanner } from "./ApercuPreviewBanner"
import { ApercuNav } from "./ApercuNav"
import { ApercuNewsHeroCard } from "./ApercuNewsHeroCard"
import { ApercuNewsCard, type ApercuNewsCardData } from "./ApercuNewsCard"
import { PhraseDuJour } from "./PhraseDuJour"
import { RechercheHighlightCard } from "./RechercheHighlightCard"
import { EtudesRecentesCard, type EtudeRef } from "./EtudesRecentesCard"
import { CinemaTendancesCard } from "./CinemaTendancesCard"
import { SourcesTrustCard } from "./SourcesTrustCard"
import type { CinemaTendance } from "@/lib/news-cinema-tendances"
import {
  VacancesScolairesCard,
  type SerializableHoliday,
} from "./VacancesScolairesCard"
import type { CalendarHoliday } from "@/lib/school-holidays"
import { AnniversaireCard } from "./AnniversaireCard"
import { MeteoFamilleCard } from "./MeteoFamilleCard"
import { NewsletterCTA } from "./NewsletterCTA"
import { APERCU_PALETTE } from "./apercuTheme"
import type { StoryResearch } from "./ApercuDecouverteStory"
import type { CatalogAnniversary } from "@/lib/catalog-anniversary"
import type { WeatherSnapshot } from "@/lib/weather"

export interface DecouverteV3Data {
  // Latest French story (rendered as the page hero).
  frenchHero: ApercuNewsCardData | null
  // Next 3 most recent French briefs (3-up grid below the hero).
  frenchTop: ApercuNewsCardData[]
  // International strand inlined as its own section (no tab).
  internationalTop: ApercuNewsCardData[]
  // Latest weekly dossier (long-read), pinned with featured treatment.
  dossier: ApercuNewsCardData | null
  // Older briefs scrolled in below the dossier.
  olderBriefs: ApercuNewsCardData[]
  // Editorial pull-quote inserted between French and INTL sections.
  // Server picks the candidate from a recent story body.
  phrase: { quote: string; storyTitle: string; storySlug: string } | null
  // Sidebar: latest story carrying a research sidebar.
  research: { research: StoryResearch; storyTitle: string; storySlug: string } | null
  // Sidebar: curated scientific / institutional studies (sourced).
  etudes: EtudeRef[]
  // Sidebar: family-friendly films currently in French theaters (replaces
  // the prior meta-stats widget — Xavier wanted real-world numbers /
  // catalog ties rather than "n articles published").
  cinemaTendances: CinemaTendance[]
  // Sidebar: school-holidays widget (Zone B is the default; cards
  // for A and C are pre-fetched so the toggle is instant client-side).
  holidayB: SerializableHoliday | null
  holidayA: SerializableHoliday | null
  holidayC: SerializableHoliday | null
  // 90-day calendar of upcoming holidays for all 3 zones (drives the
  // expandable calendar view inside VacancesScolairesCard).
  holidayCalendar: CalendarHoliday[]
  // Sidebar: catalog anniversary ("Il y a X ans aujourd'hui sortait …").
  anniversary: CatalogAnniversary | null
  // Sidebar: per-user weather snapshot (current + 5-day) + activity
  // ideas matched to today's condition. Null current/empty daily =
  // upstream API failed; the card still renders the city header so
  // the user can switch cities via the picker.
  weather: WeatherSnapshot
  // True for admin users (always) or any authenticated user when
  // NEWSLETTER_PUBLIC=true. Controls whether the bottom-of-page CTA
  // shows a working form or the "en bêta privée" stub.
  canSubscribe: boolean
}

/**
 * V3 layout — single scroll, no tabs. Inspired by Courrier International:
 * everything visible on one page with strong vertical rhythm + a
 * sticky sidebar of secondary content. Replaces the tabbed FR/INTL
 * split that hid international stories from most readers.
 */
export function ApercuDecouverteV3({
  data,
  serifClass,
}: {
  data: DecouverteV3Data
  serifClass: string
}) {
  const p = APERCU_PALETTE

  return (
    <div
      className="flex flex-col min-h-screen overflow-x-hidden"
      style={{ background: p.bg, color: p.ink }}
    >
      <ApercuPreviewBanner />
      <ApercuNav />

      <section className="py-10 md:py-14">
        <div className="container mx-auto px-4 md:px-8">
          {/* Page header */}
          <div className="mb-8">
            <div
              className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: p.accent }}
            >
              Découverte · Aperçu v3
            </div>
            <h1
              className={`${serifClass} text-3xl md:text-5xl font-medium leading-[1.05] max-w-2xl`}
              style={{ color: p.ink, letterSpacing: "-0.02em" }}
            >
              L&apos;actualité qui compte{" "}
              <em className="italic" style={{ color: p.accent }}>
                pour les familles
              </em>
            </h1>
          </div>

          {/* 2-column layout: main feed + sticky sidebar.
              Mobile collapses to single column with sidebar inlined
              between the FR briefs and the INTL section. */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-12">
            {/* ─────── MAIN FEED ─────── */}
            <main className="min-w-0 flex flex-col gap-6">
              {/* French hero */}
              {data.frenchHero && (
                <ApercuNewsHeroCard story={data.frenchHero} serifClass={serifClass} />
              )}

              {/* French briefs — 3-up grid */}
              {data.frenchTop.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {data.frenchTop.map((s) => (
                    <ApercuNewsCard key={s.slug} story={s} serifClass={serifClass} />
                  ))}
                </div>
              )}

              {/* Mobile-only: sidebar content inlines here so it's
                  not buried at the bottom on phones. Hidden on lg+
                  where the sticky sidebar takes over. */}
              <div className="lg:hidden flex flex-col gap-4 my-2">
                <VacancesScolairesCard
                  initialFR={data.holidayB}
                  initialZoneA={data.holidayA}
                  initialZoneC={data.holidayC}
                  calendar={data.holidayCalendar}
                  serifClass={serifClass}
                />
                <MeteoFamilleCard initial={data.weather} serifClass={serifClass} />
                {data.anniversary && (
                  <AnniversaireCard anniversary={data.anniversary} serifClass={serifClass} />
                )}
                {data.cinemaTendances.length > 0 && (
                  <CinemaTendancesCard tendances={data.cinemaTendances} serifClass={serifClass} />
                )}
                {data.research && (
                  <RechercheHighlightCard
                    research={data.research.research}
                    storyTitle={data.research.storyTitle}
                    storySlug={data.research.storySlug}
                    serifClass={serifClass}
                  />
                )}
                {data.etudes.length > 0 && (
                  <EtudesRecentesCard etudes={data.etudes} serifClass={serifClass} />
                )}
                <SourcesTrustCard serifClass={serifClass} />
              </div>

              {/* Pull-quote break */}
              {data.phrase && (
                <PhraseDuJour
                  quote={data.phrase.quote}
                  storyTitle={data.phrase.storyTitle}
                  storySlug={data.phrase.storySlug}
                  serifClass={serifClass}
                />
              )}

              {/* International strand — inlined, not behind a tab */}
              {data.internationalTop.length > 0 && (
                <div>
                  <div className="flex items-end justify-between gap-3 mb-5 flex-wrap">
                    <div>
                      <div
                        className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
                        style={{ color: p.accent }}
                      >
                        Vu d&apos;ailleurs
                      </div>
                      <h2
                        className={`${serifClass} text-2xl md:text-3xl font-medium leading-[1.05] m-0`}
                        style={{ color: p.ink, letterSpacing: "-0.02em" }}
                      >
                        Ce qu&apos;on lit{" "}
                        <em className="italic" style={{ color: p.accent }}>
                          ailleurs
                        </em>
                      </h2>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {data.internationalTop.slice(0, 6).map((s) => (
                      <ApercuNewsCard key={s.slug} story={s} serifClass={serifClass} />
                    ))}
                  </div>
                </div>
              )}

              {/* Dossier de la semaine — featured */}
              {data.dossier && (
                <div className="relative mt-6">
                  <div
                    className="absolute -top-3 left-4 z-10 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: p.accent, color: "#FFFFFF" }}
                  >
                    Dossier de la semaine
                  </div>
                  <ApercuNewsHeroCard story={data.dossier} serifClass={serifClass} />
                </div>
              )}

              {/* Older briefs */}
              {data.olderBriefs.length > 0 && (
                <div className="mt-6">
                  <div
                    className="text-[11px] font-semibold uppercase tracking-wide mb-4"
                    style={{ color: p.ink2 }}
                  >
                    Plus tôt cette semaine
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {data.olderBriefs.map((s) => (
                      <ApercuNewsCard key={s.slug} story={s} serifClass={serifClass} />
                    ))}
                  </div>
                </div>
              )}
            </main>

            {/* ─────── DESKTOP STICKY SIDEBAR ─────── */}
            {/* Five blocks stacked vertically. The sidebar is taller
                than the viewport on purpose — sticky scroll lets the
                reader catch each block as they progress through the
                main feed. Order: takeaways (most actionable) →
                research highlight → études (sourced links out) →
                week stats (pulse) → sources trust (transparency). */}
            <aside className="hidden lg:block">
              {/* Sidebar order, top-down:
                  1. Vacances scolaires (most-checked widget — pin first)
                  2. Météo famille (immediate "today" feel + city picker)
                  3. Anniversaire catalogue (nostalgia hook)
                  4. Au cinéma cette semaine (catalog tie-in)
                  5. Recherche highlight
                  6. Études récentes (sourced links out)
                  7. Sources de confiance (transparency footer)
                  No max-height / no inner overflow — the sidebar
                  extends with the page so all blocks are reachable
                  by normal page scroll, not a nested scroll. */}
              <div className="flex flex-col gap-4">
                <VacancesScolairesCard
                  initialFR={data.holidayB}
                  initialZoneA={data.holidayA}
                  initialZoneC={data.holidayC}
                  calendar={data.holidayCalendar}
                  serifClass={serifClass}
                />
                <MeteoFamilleCard initial={data.weather} serifClass={serifClass} />
                {data.anniversary && (
                  <AnniversaireCard anniversary={data.anniversary} serifClass={serifClass} />
                )}
                {data.cinemaTendances.length > 0 && (
                  <CinemaTendancesCard tendances={data.cinemaTendances} serifClass={serifClass} />
                )}
                {data.research && (
                  <RechercheHighlightCard
                    research={data.research.research}
                    storyTitle={data.research.storyTitle}
                    storySlug={data.research.storySlug}
                    serifClass={serifClass}
                  />
                )}
                {data.etudes.length > 0 && (
                  <EtudesRecentesCard etudes={data.etudes} serifClass={serifClass} />
                )}
                <SourcesTrustCard serifClass={serifClass} />
              </div>
            </aside>
          </div>

          {/* Newsletter — full width below the grid, after the user has
              scrolled the whole feed. */}
          <NewsletterCTA serifClass={serifClass} canSubscribe={data.canSubscribe} />
        </div>
      </section>
    </div>
  )
}
