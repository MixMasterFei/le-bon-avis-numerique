"use client"

import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { ApercuHero, type HeroPick } from "./ApercuHero"
import { ApercuExpertPicks } from "./ApercuExpertPicks"
import { ApercuNowInCinema } from "./ApercuNowInCinema"
import { ApercuStreaming } from "./ApercuStreaming"
import { ApercuAgeGrid } from "./ApercuAgeGrid"
import { ApercuCollections } from "./ApercuCollections"
import { NouveautesMangaRail } from "./NouveautesMangaRail"
import { NouveautesGamesRail } from "./NouveautesGamesRail"
import { ApercuPulse } from "./ApercuPulse"
import { ApercuFinalCTA } from "./ApercuFinalCTA"
import { HomeSectionNav } from "./HomeSectionNav"
import { APERCU_PALETTE } from "./apercuTheme"

interface HomepageApercuProps {
  isLoggedIn: boolean
  serifClass: string
  isAdmin?: boolean
  /**
   * Server-rendered slot inserted just below the hero search and above
   * Coups de Cœur. Used by `page.tsx` to mount the time-aware rail
   * (which is an async server component and can't be imported here
   * since this file is "use client").
   */
  topSlot?: React.ReactNode
  /**
   * Server-fetched hero showcase (5 poster cards + catalog count for the
   * stats badge). Rendered into the initial HTML — the poster stack is the
   * desktop LCP element, so it must not wait for a client-side fetch.
   */
  heroPicks?: HeroPick[]
  heroCatalogCount?: number | null
}

export function HomepageApercu({
  isLoggedIn,
  serifClass,
  isAdmin = false,
  topSlot,
  heroPicks = [],
  heroCatalogCount = null,
}: HomepageApercuProps) {
  const p = APERCU_PALETTE

  return (
    <FamilyFitProvider>
      <div
        className="flex flex-col overflow-x-hidden"
        style={{ background: p.bg, color: p.ink }}
      >
        <ApercuHero
          serifClass={serifClass}
          isLoggedIn={isLoggedIn}
          picks={heroPicks}
          totalCatalog={heroCatalogCount}
        />

        {topSlot}

        {/* Section anchors below — each has id="..." matching
            HomeSectionNav's chips, and scroll-mt-24 to offset the
            sticky SiteHeader (~64-80px tall) so the section title
            isn't hidden under the header on jump-scroll. */}

        {/* Cinéma promoted directly under the time-aware rail: it's the
            freshest, most differentiated signal (live theatrical listings
            + expert ages, which AlloCiné doesn't do). The quick-jump nav
            rides up here too so it stays near the top of the page. */}
        <section id="cinema" className="py-10 md:py-14 scroll-mt-24" style={{ background: p.bg }}>
          <div className="container mx-auto px-4 md:px-8">
            <HomeSectionNav />
            <ApercuNowInCinema serifClass={serifClass} />
          </div>
        </section>

        {/* NOTE: a promoted social-proof section ("Ce que les familles
            regardent") used to sit here. Pulled until there's enough
            engagement to show — a single "1 réaction" reads weaker than
            no social proof at all. The buzz/additions rows live on in
            ApercuPulse lower down. Re-promote once reaction volume grows. */}

        <section id="coups-de-coeur" className="py-10 md:py-14 scroll-mt-24" style={{ background: p.bg2 }}>
          <div className="container mx-auto px-4 md:px-8">
            <ApercuExpertPicks serifClass={serifClass} />
          </div>
        </section>

        <div id="par-age" className="scroll-mt-24">
          <ApercuAgeGrid serifClass={serifClass} />
        </div>

        <section id="streaming" className="py-10 md:py-14 scroll-mt-24" style={{ background: p.bg2 }}>
          <div className="container mx-auto px-4 md:px-8">
            <ApercuStreaming serifClass={serifClass} />
          </div>
        </section>

        {/* Recent console game releases — self-hiding below 3 items so
            the homepage stays clean during sparse IGDB sync windows. */}
        <section id="jeux-recents" className="py-10 md:py-14 scroll-mt-24" style={{ background: p.bg }}>
          <div className="container mx-auto px-4 md:px-8">
            <NouveautesGamesRail serifClass={serifClass} />
          </div>
        </section>

        {/* Admin-only during soft launch. Self-hiding below 3 items. */}
        {isAdmin && (
          <section className="py-10 md:py-14" style={{ background: p.bg2 }}>
            <div className="container mx-auto px-4 md:px-8">
              <NouveautesMangaRail serifClass={serifClass} />
            </div>
          </section>
        )}

        <section id="collections" className="py-10 md:py-14 scroll-mt-24" style={{ background: p.bg }}>
          <div className="container mx-auto px-4 md:px-8">
            <ApercuCollections serifClass={serifClass} />
          </div>
        </section>

        <ApercuPulse serifClass={serifClass} />

        <ApercuFinalCTA serifClass={serifClass} isLoggedIn={isLoggedIn} />
      </div>
    </FamilyFitProvider>
  )
}
