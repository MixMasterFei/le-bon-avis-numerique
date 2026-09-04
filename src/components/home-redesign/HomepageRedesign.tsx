"use client"

import { useEffect, useRef, useState } from "react"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { TopProgressBar } from "@/components/ui/TopProgressBar"
import { DeferUntilVisible } from "./DeferUntilVisible"
import { getMemberAge } from "@/lib/age-utils"
import { homepageAgeCap } from "@/lib/homepage-age-cap"
import { v2FontVars } from "./fonts"
import { HeroRedesign } from "./HeroRedesign"
import { StickyAgeFilter } from "./StickyAgeFilter"
import { PersonalizedRail } from "./PersonalizedRail"
import { TopPicksRail, UpcomingRail, CinemaRail, CoupsDeCoeurRail, GamesRail } from "./rails"
import { AgeGridRedesign, GenresGrid, FinalCTARedesign } from "./grids"
import { PlatformsSection } from "./PlatformsSection"
import { MethodeBand } from "./MethodeBand"
import { CollectionsStrip } from "./CollectionsStrip"
import { FamilyNudge } from "./FamilyNudge"

import type { FamilyMemberLite } from "./FamilyChips"
import type { HomepageState } from "@/lib/homepage-time-context"

interface HomepageRedesignProps {
  isLoggedIn: boolean
  /** Account display name — drives the "Bon retour, famille X !" greeting. */
  userName?: string | null
  /** User-chosen family display name (User.familyName), if set. */
  familyDisplayName?: string | null
  /** Real family-friendly poster URLs for the hero wall (weekly set). */
  heroPosters: string[]
  /** Family age floor (min(12, youngest minor)) — default weekend-rail cap. */
  defaultMaxAge: number
  /** The signed-in family's members (for the "Votre famille" shortcuts). */
  familyMembers: FamilyMemberLite[]
  /** Paris-time moment for the first rail (tonight / weekend / holidays / day). */
  homepageState: HomepageState
  /** Natural-language search in the hero (NL_SEARCH_PUBLIC, see nl-search/access). */
  nlSearchEnabled?: boolean
}

/**
 * Drives the same top red progress sweep the catalogue shows on filter changes
 * (TopProgressBar) for the homepage. The homepage filters client-side (no route
 * transition), so we pulse the bar whenever the age/family selection changes.
 *
 * It is deliberately NOT tied to FamilyFitProvider's `isLoading`: the lower
 * rails mount lazily (DeferUntilVisible) and each one kicks off its own
 * family-fit batch as you scroll, so binding the bar to `isLoading` made it
 * flash repeatedly all the way down the page — reading as lag even though the
 * fetches are just background hydration of the per-member avatars. The bar now
 * fires only on an explicit filter change, where the feedback is actually
 * useful; background hydration stays silent.
 */
function HomeFilterProgress({ filterKey }: { filterKey: string }) {
  const [pulse, setPulse] = useState(false)
  const didMount = useRef(false)

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }
    // Defer the rising edge out of the effect body (avoids the cascading-render
    // lint rule); the falling edge is already deferred via setTimeout.
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setPulse(true)
    })
    const t = setTimeout(() => setPulse(false), 500)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [filterKey])

  return <TopProgressBar loading={pulse} />
}

export function HomepageRedesign({ isLoggedIn, userName = null, familyDisplayName = null, heroPosters, defaultMaxAge, familyMembers, homepageState, nlSearchEnabled = false }: HomepageRedesignProps) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])

  const toggleAge = (k: string) =>
    setSelectedKeys((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))

  const toggleMember = (m: FamilyMemberLite) =>
    setSelectedMemberIds((prev) => (prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]))

  // Audience cap that adapts the WHOLE homepage:
  //  - the youngest selected member or age-band lower bound wins, including
  //    when both controls are used, so the selection suits every viewer;
  //  - nothing → no filter.
  const selectedMembers = familyMembers.filter((m) => selectedMemberIds.includes(m.id))
  const memberAges = selectedMembers
    .map((m) => getMemberAge(m.birthYear, m.birthMonth))
    .filter((a): a is number => typeof a === "number")
  const globalMaxAge = homepageAgeCap(selectedKeys, memberAges)
  // The family age cap that EVERY browse rail falls back to when the visitor
  // hasn't picked an age/member yet (globalMaxAge is undefined). Defined once
  // and passed to all of them so no rail can silently ship un-capped — the gap
  // that let PEGI 16/18 games fill the default "jeux vidéo" rail. When the
  // visitor DOES pick an age band or member, globalMaxAge wins and this widens
  // to exactly their choice.
  const effectiveMaxAge = globalMaxAge ?? defaultMaxAge
  // The now-playing cinema rail is informational (a factual theatrical listing,
  // watched with a parent present), so it uses a slightly older default cap
  // than the browse rails. Deliberately 14, not defaultMaxAge — do NOT
  // "harmonize" this to 12; the two caps encode different intents.
  const cinemaMaxAge = globalMaxAge ?? 14

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
      <HomeFilterProgress filterKey={`${selectedKeys.join(",")}|${selectedMemberIds.join(",")}`} />
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
          userName={userName}
          familyDisplayName={familyDisplayName}
          nlSearchEnabled={nlSearchEnabled}
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
        {/* First rail stays eager (at/just-below the fold). The rest are heavy
            data rails (each fetches + renders a poster grid) — deferred until
            scrolled near, so they don't all mount on load and delay LCP. */}
        <TopPicksRail maxAge={effectiveMaxAge} audience={audienceLabel} rankByMemberIds={selectedMemberIds} state={homepageState} />
        <DeferUntilVisible minHeight={300}>
          <UpcomingRail maxAge={effectiveMaxAge} />
        </DeferUntilVisible>
        <DeferUntilVisible>
          <CinemaRail maxAge={cinemaMaxAge} audience={audienceLabel} rankByMemberIds={selectedMemberIds} />
        </DeferUntilVisible>
        <DeferUntilVisible>
          <CoupsDeCoeurRail maxAge={effectiveMaxAge} audience={audienceLabel} rankByMemberIds={selectedMemberIds} />
        </DeferUntilVisible>
        <AgeGridRedesign />
        <DeferUntilVisible>
          <PlatformsSection maxAge={effectiveMaxAge} audience={audienceLabel} rankByMemberIds={selectedMemberIds} />
        </DeferUntilVisible>
        <DeferUntilVisible>
          <GamesRail maxAge={effectiveMaxAge} audience={audienceLabel} rankByMemberIds={selectedMemberIds} />
        </DeferUntilVisible>
        {/* Static band, NOT deferred: these are the crawlable links to the
            collection pages — hiding them behind IntersectionObserver would
            take them out of the server HTML again. */}
        <CollectionsStrip />
        <MethodeBand />
        <GenresGrid />
        <FinalCTARedesign isLoggedIn={isLoggedIn} />
        <FamilyNudge selectedKeys={selectedKeys} isLoggedIn={isLoggedIn} />
      </div>
    </FamilyFitProvider>
  )
}
