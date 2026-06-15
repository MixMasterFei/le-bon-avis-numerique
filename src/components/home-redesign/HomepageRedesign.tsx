"use client"

import { useState } from "react"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { APERCU_AGE_BUCKETS } from "@/components/home-v2/apercuTheme"
import { getMemberAge } from "@/lib/age-utils"
import { v2FontVars } from "./fonts"
import { HeroRedesign } from "./HeroRedesign"
import { StickyAgeFilter } from "./StickyAgeFilter"
import { PersonalizedRail } from "./PersonalizedRail"
import { WeekendRail, UpcomingRail, CinemaRail, CoupsDeCoeurRail, GamesRail } from "./rails"
import { AgeGridRedesign, GenresGrid, FinalCTARedesign } from "./grids"
import { PlatformsSection } from "./PlatformsSection"
import { MethodeBand } from "./MethodeBand"
import { FamilyNudge } from "./FamilyNudge"

import type { FamilyMemberLite } from "./FamilyChips"

interface HomepageRedesignProps {
  isLoggedIn: boolean
  /** Real family-friendly poster URLs for the hero wall (weekly set). */
  heroPosters: string[]
  /** Family age floor (min(12, youngest minor)) — default weekend-rail cap. */
  defaultMaxAge: number
  /** The signed-in family's members (for the "Votre famille" shortcuts). */
  familyMembers: FamilyMemberLite[]
}

export function HomepageRedesign({ isLoggedIn, heroPosters, defaultMaxAge, familyMembers }: HomepageRedesignProps) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])

  const toggleAge = (k: string) =>
    setSelectedKeys((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))

  const toggleMember = (m: FamilyMemberLite) =>
    setSelectedMemberIds((prev) => (prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]))

  // Audience cap that adapts the WHOLE homepage:
  //  - members selected → the YOUNGEST selected child's age, so a family
  //    selection shows content everyone can actually watch (and each picked
  //    member fits every card);
  //  - only age bands → the oldest selected band;
  //  - nothing → no filter.
  const selectedMembers = familyMembers.filter((m) => selectedMemberIds.includes(m.id))
  const memberAges = selectedMembers
    .map((m) => getMemberAge(m.birthYear, m.birthMonth))
    .filter((a): a is number => typeof a === "number")
  const bandMax = APERCU_AGE_BUCKETS.filter((b) => selectedKeys.includes(b.key)).map((b) => b.maxAge)
  const globalMaxAge = memberAges.length
    ? Math.min(...memberAges)
    : bandMax.length
      ? Math.max(...bandMax)
      : undefined
  const weekendMaxAge = globalMaxAge ?? defaultMaxAge

  // Shown in section titles so every rail visibly reflects the selection.
  const personalizedTitle =
    selectedMembers.length === 1 ? selectedMembers[0].name : "votre famille"
  const audienceLabel =
    selectedMembers.length === 1
      ? `pour ${selectedMembers[0].name}`
      : selectedMembers.length > 1
        ? "pour votre famille"
        : undefined

  return (
    <FamilyFitProvider>
      <div
        data-home="v2"
        className={`${v2FontVars} flex flex-col overflow-x-hidden`}
        style={{ background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-hanken), system-ui, sans-serif" }}
      >
        <HeroRedesign
          heroPosters={heroPosters}
          selectedKeys={selectedKeys}
          onToggleAge={toggleAge}
          familyMembers={familyMembers}
          selectedMemberIds={selectedMemberIds}
          onToggleMember={toggleMember}
          isLoggedIn={isLoggedIn}
        />
        <StickyAgeFilter
          selectedKeys={selectedKeys}
          onToggleAge={toggleAge}
          onClear={() => { setSelectedKeys([]); setSelectedMemberIds([]) }}
          familyMembers={familyMembers}
          selectedMemberIds={selectedMemberIds}
          onToggleMember={toggleMember}
          maxAge={globalMaxAge}
          isLoggedIn={isLoggedIn}
        />
        {/* Preference-aware rail when a child is picked — quiz fit + age, like
            the catalogue's "Adapter à". */}
        {selectedMemberIds.length > 0 && (
          <PersonalizedRail memberIds={selectedMemberIds} title={personalizedTitle} maxAge={globalMaxAge} />
        )}
        <WeekendRail maxAge={weekendMaxAge} audience={audienceLabel} />
        <UpcomingRail />
        <CinemaRail maxAge={globalMaxAge} audience={audienceLabel} />
        <CoupsDeCoeurRail maxAge={globalMaxAge} audience={audienceLabel} />
        <AgeGridRedesign />
        <PlatformsSection maxAge={globalMaxAge} audience={audienceLabel} />
        <GamesRail maxAge={globalMaxAge} audience={audienceLabel} />
        <MethodeBand />
        <GenresGrid />
        <FinalCTARedesign isLoggedIn={isLoggedIn} />
        <FamilyNudge selectedKeys={selectedKeys} isLoggedIn={isLoggedIn} />
      </div>
    </FamilyFitProvider>
  )
}
