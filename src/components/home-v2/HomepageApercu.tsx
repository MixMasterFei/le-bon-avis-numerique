"use client"

import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { ApercuHero } from "./ApercuHero"
import { ApercuExpertPicks } from "./ApercuExpertPicks"
import { ApercuNowInCinema } from "./ApercuNowInCinema"
import { ApercuStreaming } from "./ApercuStreaming"
import { ApercuAgeGrid } from "./ApercuAgeGrid"
import { ApercuCollections } from "./ApercuCollections"
import { ApercuPulse } from "./ApercuPulse"
import { ApercuFinalCTA } from "./ApercuFinalCTA"
import { ApercuFooter } from "./ApercuFooter"
import { ApercuNav } from "./ApercuNav"
import { ApercuPreviewBanner } from "./ApercuPreviewBanner"
import { APERCU_PALETTE } from "./apercuTheme"

interface HomepageApercuProps {
  isLoggedIn: boolean
  serifClass: string
}

export function HomepageApercu({ isLoggedIn, serifClass }: HomepageApercuProps) {
  const p = APERCU_PALETTE

  return (
    <FamilyFitProvider>
      <div
        className="flex flex-col overflow-x-hidden"
        style={{ background: p.bg, color: p.ink }}
      >
        <ApercuPreviewBanner />
        <ApercuNav />

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

        <section className="py-10 md:py-14" style={{ background: p.bg }}>
          <div className="container mx-auto px-4 md:px-8">
            <ApercuCollections serifClass={serifClass} />
          </div>
        </section>

        <ApercuPulse serifClass={serifClass} />

        <ApercuFinalCTA serifClass={serifClass} isLoggedIn={isLoggedIn} />

        <ApercuFooter serifClass={serifClass} />
      </div>
    </FamilyFitProvider>
  )
}
