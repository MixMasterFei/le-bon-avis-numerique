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
      className="fixed left-1/2 z-40 transition-all duration-300 motion-reduce:transition-none"
      style={{
        top: topOffset + 10,
        transform: `translateX(-50%) translateY(${visible ? "0" : "-160%"})`,
        opacity: visible ? 1 : 0,
        maxWidth: "calc(100vw - 24px)",
      }}
      aria-hidden={!visible}
      inert={!visible}
    >
      {/* Rounded, content-width card — a floating filter dashboard, not a
          full-bleed bar. */}
      <div
        className="flex items-center gap-2.5 overflow-x-auto rounded-full border px-3 py-2 backdrop-blur-md"
        style={{
          background: "color-mix(in srgb, var(--card) 94%, transparent)",
          borderColor: "var(--line)",
          boxShadow: "0 18px 40px -16px rgba(58,46,34,.55)",
        }}
      >
        {hasFilters && typeof maxAge === "number" && (
          <span className="hidden whitespace-nowrap pl-1 text-[12px] font-bold sm:inline" style={{ color: "var(--ink-2)" }}>
            jusqu&apos;à {maxAge} ans
          </span>
        )}
        {familyMembers.length > 0 && (
          <FamilyChips members={familyMembers} selectedMemberIds={selectedMemberIds} onToggleMember={onToggleMember} isLoggedIn={isLoggedIn} size="sm" />
        )}
        <AgeChips selectedKeys={selectedKeys} onToggleAge={onToggleAge} size="sm" />
        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[12px] font-bold transition-opacity hover:opacity-70"
            style={{ color: "var(--terra)" }}
          >
            <X className="h-3.5 w-3.5" /> Effacer
          </button>
        )}
      </div>
    </div>
  )
}
