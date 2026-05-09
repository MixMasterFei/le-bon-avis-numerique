"use client"

import Link from "next/link"
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
import { AirQualiteCard } from "./AirQualiteCard"
import { JourANoterCard } from "./JourANoterCard"
import { PenseBeteCard } from "./PenseBeteCard"
import type { AirQualitySnapshot } from "@/lib/air-quality"
import type { NotableDateInstance } from "@/lib/notable-dates"
import type { DeadlineInstance } from "@/lib/family-deadlines"
import { NewsletterCTA } from "./NewsletterCTA"
import { APERCU_PALETTE } from "./apercuTheme"
import type { StoryResearch } from "./ApercuDecouverteStory"
import type { CatalogAnniversary } from "@/lib/catalog-anniversary"
import type { WeatherSnapshot } from "@/lib/weather"

export interface DecouverteV3Data {
  // Curated French lead story (rendered as the page hero).
  frenchHero: ApercuNewsCardData | null
  // Next 3 parent-priority French briefs (3-up grid below the hero).
  frenchTop: ApercuNewsCardData[]
  // Tech & IA strand — dedicated 3-up grid between French briefs
  // and the dossier. Mixes FR + INTL TECH-category briefs (since
  // the topic is inherently global; flags differentiate origin).
  techTop: ApercuNewsCardData[]
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
  // True when the user has already saved a weather city (any non-default
  // pick). Drives whether the Météo widget surfaces the one-time
  // geolocation consent prompt or stays quiet.
  hasUserCity: boolean
  // Sidebar: air quality + pollen for the same saved city. Null when
  // the upstream Open-Meteo Air Quality API is unreachable.
  airQuality: AirQualitySnapshot | null
  // Sidebar: well-known French civic / cultural dates (next 120
  // days), curated. Empty array hides the widget.
  notableDates: NotableDateInstance[]
  // Sidebar: recurring family administrative deadlines (impôts, école,
  // CAF…) within the next 180 days. Empty array hides the widget.
  deadlines: DeadlineInstance[]
  // True for admin users (always) or any authenticated user when
  // NEWSLETTER_PUBLIC=true. Controls whether the bottom-of-page CTA
  // shows a working form or the "en bêta privée" stub.
  canSubscribe: boolean
  // Set when the chosen hero brief is older than 36h. Drives a small
  // banner above the news grid so visitors know the synthesis is
  // catching up, instead of seeing a polished page with stale content
  // and assuming this is just how the site looks. Optional for
  // back-compat with callers that don't pass it (defaults to false).
  isStale?: boolean
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

      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4 md:px-8">
          {/* Page header */}
          <div className="mb-6">
            <div
              className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: p.accent }}
            >
              Découverte · Aperçu v3
            </div>
            <h1
              className={`${serifClass} text-2xl md:text-4xl font-medium leading-[1.05] max-w-2xl`}
              style={{ color: p.ink, letterSpacing: "-0.02em" }}
            >
              L&apos;actualité qui compte{" "}
              <em className="italic" style={{ color: p.accent }}>
                pour les familles
              </em>
            </h1>
          </div>

          {/* Stale-content banner — only shown when the most recent
              hero brief is older than 36h. Tells visitors the synthesis
              is catching up so they don't mistake stale content for
              "the site is just like this". Hidden as soon as a fresh
              cron run lands new stories. */}
          {data.isStale && (
            <div
              className="mb-5 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
              style={{
                background: p.bg2,
                border: `1px solid ${p.line2}`,
                color: p.ink2,
              }}
            >
              <span aria-hidden>⏳</span>
              <span>
                Synthèse du jour en cours — voici les actualités les plus
                récentes en attendant.
              </span>
            </div>
          )}

          {/* 2-column layout: main feed + sticky sidebar.
              Mobile collapses to single column with sidebar inlined
              between the FR briefs and the INTL section. */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-12">
            {/* ─────── MAIN FEED ─────── */}
            <main className="min-w-0 flex flex-col gap-5">
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

              {/* Tech & IA strand — Xavier's dedicated section so
                  families see the AI/tech angle as a deliberate
                  editorial choice, not buried in the main grid. */}
              {data.techTop.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-end justify-between gap-3 mb-5 flex-wrap">
                    <div>
                      <div
                        className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
                        style={{ color: p.accent }}
                      >
                        Tech &amp; IA · Pour les familles
                      </div>
                      <h2
                        className={`${serifClass} text-2xl md:text-3xl font-medium leading-[1.05] m-0`}
                        style={{ color: p.ink, letterSpacing: "-0.02em" }}
                      >
                        Comprendre le numérique{" "}
                        <em className="italic" style={{ color: p.accent }}>
                          en famille
                        </em>
                      </h2>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {data.techTop.slice(0, 6).map((s) => (
                      <ApercuNewsCard key={s.slug} story={s} serifClass={serifClass} />
                    ))}
                  </div>
                </div>
              )}

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

              {/* "Voir toutes les actualités" — opens the V3 historique,
                  a paginated archive of every story V3 is allowed to
                  surface (same category/region matrix). Visually a
                  continuation of "Plus tôt cette semaine" rather than
                  the older /apercudecouverte/actualites listing, which
                  used a different curation lens. */}
              <div className="mt-8 flex justify-center">
                <Link
                  href="/apercudecouverte-v3/historique"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ background: p.ink, color: p.bg }}
                >
                  Voir toutes les actualités <span aria-hidden>→</span>
                </Link>
              </div>

              {/* Mobile-only: sidebar content inlines AFTER the news
                  feed so the reading flow stays uninterrupted. Xavier's
                  call (April 2026): widgets become a 'browse mode'
                  block at the end rather than wedging into the news.
                  Hidden on lg+ where the sticky sidebar handles them. */}
              <div className="lg:hidden flex flex-col gap-4 mt-8">
                <div
                  className="text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: p.ink2 }}
                >
                  Le foyer
                </div>
                <MeteoFamilleCard initial={data.weather} hasUserCity={data.hasUserCity} serifClass={serifClass} />
                {data.airQuality && (
                  <AirQualiteCard snapshot={data.airQuality} serifClass={serifClass} />
                )}
                {data.deadlines.length > 0 && (
                  <PenseBeteCard deadlines={data.deadlines} serifClass={serifClass} />
                )}
                <VacancesScolairesCard
                  initialFR={data.holidayB}
                  initialZoneA={data.holidayA}
                  initialZoneC={data.holidayC}
                  calendar={data.holidayCalendar}
                  serifClass={serifClass}
                />
                {data.notableDates.length > 0 && (
                  <JourANoterCard dates={data.notableDates} serifClass={serifClass} />
                )}
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
            </main>

            {/* ─────── DESKTOP STICKY SIDEBAR ─────── */}
            {/* Five blocks stacked vertically. The sidebar is taller
                than the viewport on purpose — sticky scroll lets the
                reader catch each block as they progress through the
                main feed. Order: takeaways (most actionable) →
                research highlight → études (sourced links out) →
                week stats (pulse) → sources trust (transparency). */}
            <aside className="hidden lg:block">
              {/* Sidebar order, top-down (Météo + Air on top per Xavier):
                  1. Météo famille (instant "today" anchor + city picker)
                  2. Air & pollens (paired with weather)
                  3. Pense-Bête famille (recurring deadlines)
                  4. Vacances scolaires (high-utility, calendar expand)
                  5. Jour à noter (cultural / civic dates)
                  6. Anniversaire catalogue (nostalgia hook)
                  7. Au cinéma cette semaine (catalog tie-in)
                  8. Recherche highlight
                  9. Études récentes (sourced links out)
                  10. Sources de confiance (transparency footer)
                  No max-height / no inner overflow — the sidebar
                  extends with the page so all blocks are reachable
                  by normal page scroll, not a nested scroll. */}
              <div className="flex flex-col gap-4">
                <MeteoFamilleCard initial={data.weather} hasUserCity={data.hasUserCity} serifClass={serifClass} />
                {data.airQuality && (
                  <AirQualiteCard snapshot={data.airQuality} serifClass={serifClass} />
                )}
                {data.deadlines.length > 0 && (
                  <PenseBeteCard deadlines={data.deadlines} serifClass={serifClass} />
                )}
                <VacancesScolairesCard
                  initialFR={data.holidayB}
                  initialZoneA={data.holidayA}
                  initialZoneC={data.holidayC}
                  calendar={data.holidayCalendar}
                  serifClass={serifClass}
                />
                {data.notableDates.length > 0 && (
                  <JourANoterCard dates={data.notableDates} serifClass={serifClass} />
                )}
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

          {/* Image takedown link. Discreet, below-the-fold — visible to
              anyone who reads to the bottom but doesn't compete with the
              newsletter CTA above. mailto for now; a dedicated form
              route can replace it later. */}
          <p
            className="mt-8 text-center text-xs"
            style={{ color: APERCU_PALETTE.ink2 }}
          >
            <a
              href="mailto:contact@totemavise.com?subject=Signalement%20image"
              className="underline underline-offset-2 hover:opacity-70"
            >
              Signaler une image
            </a>
          </p>
        </div>
      </section>
    </div>
  )
}
