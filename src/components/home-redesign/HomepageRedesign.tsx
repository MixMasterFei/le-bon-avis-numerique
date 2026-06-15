"use client"

import { useState } from "react"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { APERCU_AGE_BUCKETS } from "@/components/home-v2/apercuTheme"
import { v2FontVars } from "./fonts"
import { HeroRedesign } from "./HeroRedesign"
import { StickyAgeFilter } from "./StickyAgeFilter"
import { WeekendRail, UpcomingRail, CinemaRail, CoupsDeCoeurRail, GamesRail } from "./rails"
import { AgeGridRedesign, GenresGrid, FinalCTARedesign } from "./grids"
import { PlatformsSection } from "./PlatformsSection"
import { MethodeBand } from "./MethodeBand"
import { FamilyNudge } from "./FamilyNudge"

interface HomepageRedesignProps {
  isLoggedIn: boolean
  /** Real family-friendly poster URLs for the hero wall (weekly set). */
  heroPosters: string[]
  /** Family age floor (min(12, youngest minor)) — default weekend-rail cap. */
  defaultMaxAge: number
}

export function HomepageRedesign({ isLoggedIn, heroPosters, defaultMaxAge }: HomepageRedesignProps) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])

  const toggleAge = (k: string) =>
    setSelectedKeys((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))

  // The selected band with the largest maxAge drives the week-end rail and,
  // once any band is picked, the WHOLE homepage (all age-filterable rails show
  // only content for that age and below). No selection → no global filter.
  const selected = APERCU_AGE_BUCKETS.filter((b) => selectedKeys.includes(b.key))
  const activeBucket = selected.length
    ? selected.reduce((a, b) => (b.maxAge > a.maxAge ? b : a))
    : null
  const weekendMaxAge = activeBucket?.maxAge ?? defaultMaxAge
  const globalMaxAge = activeBucket?.maxAge // undefined when nothing selected

  return (
    <FamilyFitProvider>
      <div
        data-home="v2"
        className={`${v2FontVars} flex flex-col overflow-x-hidden`}
        style={{ background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-hanken), system-ui, sans-serif" }}
      >
        <HeroRedesign heroPosters={heroPosters} selectedKeys={selectedKeys} onToggleAge={toggleAge} />
        <StickyAgeFilter selectedKeys={selectedKeys} onToggleAge={toggleAge} onClear={() => setSelectedKeys([])} />
        <WeekendRail maxAge={weekendMaxAge} />
        <UpcomingRail />
        <CinemaRail maxAge={globalMaxAge} />
        <CoupsDeCoeurRail maxAge={globalMaxAge} />
        <AgeGridRedesign />
        <PlatformsSection maxAge={globalMaxAge} />
        <GamesRail maxAge={globalMaxAge} />
        <MethodeBand />
        <GenresGrid />
        <FinalCTARedesign isLoggedIn={isLoggedIn} />
        <FamilyNudge selectedKeys={selectedKeys} isLoggedIn={isLoggedIn} />
      </div>
    </FamilyFitProvider>
  )
}
