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
  const visible = scrolledPastHero && hasFilters

  return (
    <div
      className="fixed inset-x-0 z-40 border-b backdrop-blur-md transition-transform duration-300 motion-reduce:transition-none"
      style={{
        top: topOffset,
        transform: visible ? "translateY(0)" : "translateY(-130%)",
        background: "color-mix(in srgb, var(--paper) 92%, transparent)",
        borderColor: "var(--line)",
        boxShadow: "0 16px 32px -18px rgba(58,46,34,.5)",
      }}
      aria-hidden={!visible}
      inert={!visible}
    >
      <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-5 py-2.5 sm:px-7">
        <span className="hidden whitespace-nowrap text-[12.5px] font-bold sm:inline" style={{ color: "var(--ink-2)" }}>
          {typeof maxAge === "number" ? <>Adapté · jusqu&apos;à {maxAge} ans</> : "Filtré"}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
          {familyMembers.length > 0 && (
            <FamilyChips members={familyMembers} selectedMemberIds={selectedMemberIds} onToggleMember={onToggleMember} isLoggedIn={isLoggedIn} size="sm" />
          )}
          <AgeChips selectedKeys={selectedKeys} onToggleAge={onToggleAge} size="sm" />
        </div>
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1 whitespace-nowrap text-[12.5px] font-bold transition-opacity hover:opacity-70"
          style={{ color: "var(--terra)" }}
        >
          <X className="h-3.5 w-3.5" /> Effacer
        </button>
      </div>
    </div>
  )
}
