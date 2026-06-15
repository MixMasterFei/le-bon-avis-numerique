"use client"

import { X } from "lucide-react"
import { APERCU_AGE_BUCKETS } from "@/components/home-v2/apercuTheme"
import { AgeChips } from "./AgeChips"
import { FamilyChips, type FamilyMemberLite } from "./FamilyChips"

/**
 * Slim filter bar shown once age bands are selected. Placed right after the
 * hero with `sticky top-16`, it scrolls with the page until it tucks just under
 * the global header, then stays — so the active filters remain visible (and
 * adjustable) while browsing the rails below. Hidden when nothing is selected.
 */
export function StickyAgeFilter({
  selectedKeys,
  onToggleAge,
  onClear,
  familyMembers,
  isLoggedIn,
}: {
  selectedKeys: string[]
  onToggleAge: (key: string) => void
  onClear: () => void
  familyMembers: FamilyMemberLite[]
  isLoggedIn: boolean
}) {
  if (selectedKeys.length === 0) return null

  const selected = APERCU_AGE_BUCKETS.filter((b) => selectedKeys.includes(b.key))
  const maxAge = selected.reduce((m, b) => Math.max(m, b.maxAge), 0)

  return (
    <div
      className="sticky top-16 z-40 border-b backdrop-blur-md"
      style={{ background: "color-mix(in srgb, var(--paper) 90%, transparent)", borderColor: "var(--line)" }}
    >
      <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-5 py-2.5 sm:px-7">
        <span className="hidden whitespace-nowrap text-[12.5px] font-bold sm:inline" style={{ color: "var(--ink-2)" }}>
          Adapté · jusqu&apos;à {maxAge} ans
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
          {familyMembers.length > 0 && (
            <FamilyChips members={familyMembers} selectedKeys={selectedKeys} onToggleAge={onToggleAge} isLoggedIn={isLoggedIn} size="sm" />
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
