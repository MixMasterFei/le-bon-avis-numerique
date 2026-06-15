"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { AgeChips } from "./AgeChips"
import { FamilyChips, type FamilyMemberLite } from "./FamilyChips"

/**
 * Filter bar that slides IN from the top once the hero (with its filters)
 * scrolls out of view — same scroll-triggered pattern as the media page's
 * MediaDashboardBar. It keeps the active age/family filters visible and
 * adjustable while browsing the rails, then slides away when you scroll back
 * to the hero. Only relevant when something is selected.
 */
export function StickyAgeFilter({
  selectedKeys,
  onToggleAge,
  onClear,
  familyMembers,
  selectedMemberIds,
  onToggleMember,
  maxAge,
  isLoggedIn,
}: {
  selectedKeys: string[]
  onToggleAge: (key: string) => void
  onClear: () => void
  familyMembers: FamilyMemberLite[]
  selectedMemberIds: string[]
  onToggleMember: (member: FamilyMemberLite) => void
  /** Global cap (oldest selected band/member) for the bar label. */
  maxAge?: number
  isLoggedIn: boolean
}) {
  const [scrolledPastHero, setScrolledPastHero] = useState(false)
  const [topOffset, setTopOffset] = useState(64)

  useEffect(() => {
    const hero = document.getElementById("v2-hero")
    if (!hero) return
    const header = document.querySelector("header")
    let io: IntersectionObserver | null = null
    const setup = () => {
      const h = header?.offsetHeight ?? 64
      setTopOffset(h)
      io?.disconnect()
      io = new IntersectionObserver(
        ([entry]) => setScrolledPastHero(!entry.isIntersecting),
        { rootMargin: `-${h}px 0px 0px 0px`, threshold: 0 },
      )
      io.observe(hero)
    }
    setup()
    window.addEventListener("resize", setup)
    return () => {
      io?.disconnect()
      window.removeEventListener("resize", setup)
    }
  }, [])

  const hasFilters = selectedKeys.length > 0 || selectedMemberIds.length > 0
  // Show the dashboard whenever the hero is scrolled past — "Effacer" only
  // clears the selection, it doesn't dismiss the bar.
  const visible = scrolledPastHero

  return (
    <div
      // Desktop/tablet only — the sticky filter dashboard is hidden on phones
      // (the hero filters remain the way to personalize on mobile).
      className="fixed inset-x-0 z-40 hidden transition-transform duration-300 motion-reduce:transition-none sm:block"
      style={{
        top: topOffset,
        transform: `translateY(${visible ? "0" : "-130%"})`,
        background: "color-mix(in srgb, var(--card) 92%, transparent)",
        borderBottom: "1px solid var(--line)",
        boxShadow: "0 16px 32px -20px rgba(58,46,34,.45)",
        backdropFilter: "saturate(140%) blur(12px)",
        WebkitBackdropFilter: "saturate(140%) blur(12px)",
      }}
      aria-hidden={!visible}
      inert={!visible}
    >
      {/* Full-bleed bar flush under the header (same pattern as the media page's
          MediaDashboardBar) — page-wide and connected. Content is centered via
          `mx-auto w-max`, which degrades to a left-anchored horizontal scroll on
          phones when the chips don't fit (no clipped start, no page overflow). */}
      <div className="overflow-x-auto px-4 py-2.5">
        <div className="mx-auto flex w-max items-center gap-1.5 sm:gap-2.5">
          {hasFilters && typeof maxAge === "number" && (
          <span className="hidden shrink-0 whitespace-nowrap pl-1 text-[12px] font-bold sm:inline" style={{ color: "var(--ink-2)" }}>
            jusqu&apos;à {maxAge} ans
          </span>
        )}
        {familyMembers.length > 0 && (
          <div className="shrink-0">
            <FamilyChips members={familyMembers} selectedMemberIds={selectedMemberIds} onToggleMember={onToggleMember} isLoggedIn={isLoggedIn} size="sm" />
          </div>
        )}
        <div className="shrink-0">
          <AgeChips selectedKeys={selectedKeys} onToggleAge={onToggleAge} size="sm" />
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[12px] font-bold transition-opacity hover:opacity-70"
            style={{ color: "var(--terra)" }}
          >
            <X className="h-3.5 w-3.5" /> Effacer
          </button>
        )}
        </div>
      </div>
    </div>
  )
}
