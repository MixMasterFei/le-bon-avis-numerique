"use client"

import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { ApercuHero } from "./ApercuHero"
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
import { TotemHeroEntry } from "@/components/totem/TotemHeroEntry"

interface HomepageApercuProps {
  isLoggedIn: boolean
  serifClass: string
  isAdmin?: boolean
  totemEnabled?: boolean
}

export function HomepageApercu({ isLoggedIn, serifClass, isAdmin = false, totemEnabled = false }: HomepageApercuProps) {
  const p = APERCU_PALETTE

  return (
    <FamilyFitProvider>
      <div
        className="flex flex-col overflow-x-hidden"
        style={{ background: p.bg, color: p.ink }}
      >
        <ApercuHero serifClass={serifClass} isLoggedIn={isLoggedIn} />

        {totemEnabled && (
          <section style={{ background: p.bg }}>
            <TotemHeroEntry serifClass={serifClass} />
          </section>
        )}

        {/* Section anchors below — each has id="..." matching
            HomeSectionNav's chips, and scroll-mt-24 to offset the
            sticky SiteHeader (~64-80px tall) so the section title
            isn't hidden under the header on jump-scroll. */}

        <section id="coups-de-coeur" className="py-10 md:py-14 scroll-mt-24" style={{ background: p.bg2 }}>
          <div className="container mx-auto px-4 md:px-8">
            {/* Quick-jump nav for the rest of the homepage — rendered
                as the first thing in Coups de cœur so it doesn't
                compete with the hero search above. */}
            <HomeSectionNav />
            <ApercuExpertPicks serifClass={serifClass} />
          </div>
        </section>

        <section id="cinema" className="py-10 md:py-14 scroll-mt-24" style={{ background: p.bg }}>
          <div className="container mx-auto px-4 md:px-8">
            <ApercuNowInCinema serifClass={serifClass} />
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
