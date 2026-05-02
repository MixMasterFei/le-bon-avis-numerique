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
import { APERCU_PALETTE } from "./apercuTheme"

interface HomepageApercuProps {
  isLoggedIn: boolean
  serifClass: string
  isAdmin?: boolean
}

export function HomepageApercu({ isLoggedIn, serifClass, isAdmin = false }: HomepageApercuProps) {
  const p = APERCU_PALETTE

  return (
    <FamilyFitProvider>
      <div
        className="flex flex-col overflow-x-hidden"
        style={{ background: p.bg, color: p.ink }}
      >
        <ApercuHero serifClass={serifClass} isLoggedIn={isLoggedIn} />

        <section className="py-10 md:py-14" style={{ background: p.bg2 }}>
          <div className="container mx-auto px-4 md:px-8">
            <ApercuExpertPicks serifClass={serifClass} />
          </div>
        </section>

        <section className="py-10 md:py-14" style={{ background: p.bg }}>
          <div className="container mx-auto px-4 md:px-8">
            <ApercuNowInCinema serifClass={serifClass} />
          </div>
        </section>

        <ApercuAgeGrid serifClass={serifClass} />

        <section className="py-10 md:py-14" style={{ background: p.bg2 }}>
          <div className="container mx-auto px-4 md:px-8">
            <ApercuStreaming serifClass={serifClass} />
          </div>
        </section>

        {/* Recent console game releases — self-hiding below 3 items so
            the homepage stays clean during sparse IGDB sync windows. */}
        <section className="py-10 md:py-14" style={{ background: p.bg }}>
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

        <section className="py-10 md:py-14" style={{ background: p.bg }}>
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
