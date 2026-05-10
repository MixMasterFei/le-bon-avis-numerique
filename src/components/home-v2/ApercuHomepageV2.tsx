"use client"

import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { ApercuAgeGrid } from "./ApercuAgeGrid"
import { ApercuCollections } from "./ApercuCollections"
import { ApercuExpertPicks } from "./ApercuExpertPicks"
import { ApercuFinalCTA } from "./ApercuFinalCTA"
import { ApercuHomepageHeroV2 } from "./ApercuHomepageHeroV2"
import { ApercuNowInCinema } from "./ApercuNowInCinema"
import { ApercuPulse } from "./ApercuPulse"
import { ApercuStreaming } from "./ApercuStreaming"
import { HomepageDifferenceBand } from "./HomepageDifferenceBand"
import { HomepageFamilyFitPreview } from "./HomepageFamilyFitPreview"
import { HomepageWeeklyForFamilies } from "./HomepageWeeklyForFamilies"
import { NouveautesGamesRail } from "./NouveautesGamesRail"
import { APERCU_PALETTE } from "./apercuTheme"

const PREVIEW_SECTIONS = [
  { id: "difference", label: "Pourquoi" },
  { id: "profil-famille", label: "Profil famille" },
  { id: "cette-semaine", label: "Cette semaine" },
  { id: "selection", label: "Sélection" },
  { id: "catalogue", label: "Catalogue vivant" },
]

export function ApercuHomepageV2({
  isLoggedIn,
  serifClass,
  topSlot,
}: {
  isLoggedIn: boolean
  serifClass: string
  topSlot?: React.ReactNode
}) {
  const p = APERCU_PALETTE

  return (
    <FamilyFitProvider>
      <div className="flex flex-col overflow-x-hidden" style={{ background: p.bg, color: p.ink }}>
        <ApercuHomepageHeroV2 serifClass={serifClass} isLoggedIn={isLoggedIn} />
        <PreviewNav />

        <div id="difference" className="scroll-mt-24">
          <HomepageDifferenceBand serifClass={serifClass} />
        </div>

        <div id="profil-famille" className="scroll-mt-24">
          <HomepageFamilyFitPreview serifClass={serifClass} isLoggedIn={isLoggedIn} />
        </div>

        <div id="cette-semaine" className="scroll-mt-24">
          <HomepageWeeklyForFamilies serifClass={serifClass} />
        </div>

        <div id="selection" className="scroll-mt-24">
          {topSlot}
        </div>

        <section className="py-10 md:py-14 scroll-mt-24" style={{ background: p.bg2 }}>
          <div className="container mx-auto px-4 md:px-8">
            <ApercuExpertPicks serifClass={serifClass} />
          </div>
        </section>

        <div id="catalogue" className="scroll-mt-24">
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
              <NouveautesGamesRail serifClass={serifClass} />
            </div>
          </section>

          <section className="py-10 md:py-14" style={{ background: p.bg2 }}>
            <div className="container mx-auto px-4 md:px-8">
              <ApercuCollections serifClass={serifClass} />
            </div>
          </section>

          <ApercuPulse serifClass={serifClass} />
        </div>

        <ApercuFinalCTA serifClass={serifClass} isLoggedIn={isLoggedIn} />
      </div>
    </FamilyFitProvider>
  )
}

function PreviewNav() {
  const p = APERCU_PALETTE
  return (
    <nav
      aria-label="Sections de la preview homepage"
      className="sticky top-[72px] z-30 border-y py-2 backdrop-blur"
      style={{ background: "var(--color-header-bg)", borderColor: p.line }}
    >
      <div className="container mx-auto flex gap-2 overflow-x-auto px-4 md:px-8">
        {PREVIEW_SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-opacity hover:opacity-70"
            style={{ background: p.card, border: `1px solid ${p.line2}`, color: p.ink }}
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  )
}
