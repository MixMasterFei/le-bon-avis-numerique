"use client"

import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { NowInCinema } from "@/components/home/NowInCinema"
import { ExpertPicks } from "@/components/home/ExpertPicks"
import { StreamingSection } from "@/components/home/StreamingSection"
import { CuratedCollections } from "@/components/home/CuratedCollections"
import { ApercuHero } from "./ApercuHero"
import { ApercuAgeGrid } from "./ApercuAgeGrid"
import { ApercuPulse } from "./ApercuPulse"
import { ApercuFinalCTA } from "./ApercuFinalCTA"
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
        {/* Preview banner — reminds Xavier this is the test page */}
        <div
          className="text-center text-xs py-2"
          style={{
            background: p.ink,
            color: p.bg,
          }}
        >
          <span className="opacity-80">
            Aperçu design · non visible par les utilisateurs ·{" "}
            <a href="/apercu?font=poppins" className="underline">
              tester avec Poppins
            </a>
            {" · "}
            <a href="/apercu" className="underline">
              revenir à Fraunces
            </a>
          </span>
        </div>

        <ApercuHero serifClass={serifClass} />

        <section className="py-16" style={{ background: p.bg2 }}>
          <div className="container mx-auto px-4 md:px-8">
            <ExpertPicks showLoginHint={!isLoggedIn} />
          </div>
        </section>

        <section className="py-16" style={{ background: p.bg }}>
          <div className="container mx-auto px-4 md:px-8">
            <NowInCinema showLoginHint={!isLoggedIn} />
          </div>
        </section>

        <ApercuAgeGrid serifClass={serifClass} />

        <section className="py-16" style={{ background: p.bg2 }}>
          <div className="container mx-auto px-4 md:px-8">
            <StreamingSection showLoginHint={!isLoggedIn} />
          </div>
        </section>

        <section className="py-16" style={{ background: p.bg }}>
          <div className="container mx-auto px-4 md:px-8">
            <CuratedCollections />
          </div>
        </section>

        <ApercuPulse serifClass={serifClass} />

        <ApercuFinalCTA serifClass={serifClass} isLoggedIn={isLoggedIn} />
      </div>
    </FamilyFitProvider>
  )
}
