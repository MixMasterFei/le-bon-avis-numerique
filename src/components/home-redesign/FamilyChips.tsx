"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { MemberMonogram } from "./MemberMonogram"
import { memberColor } from "./family"

export interface FamilyMemberLite {
  id: string
  name: string
  birthYear: number | null
  birthMonth: number | null
}

/**
 * "Votre famille sur mesure" — one chip per family member. Selecting a member
 * adapts the whole homepage to their age AND adds a personalized rail driven by
 * their profile (genres, sensitivity, avoid topics — see PersonalizedRail).
 * When the visitor has no family (logged out or no members yet), it shows a
 * single "+" that leads to family creation — a gentle sign-up / profile nudge.
 */
export function FamilyChips({
  members,
  selectedMemberIds,
  onToggleMember,
  isLoggedIn,
  size = "lg",
}: {
  members: FamilyMemberLite[]
  selectedMemberIds: string[]
  onToggleMember: (member: FamilyMemberLite) => void
  isLoggedIn: boolean
  size?: "lg" | "sm"
}) {
  const compact = size === "sm"

  if (members.length === 0) {
    const href = isLoggedIn ? "/profil" : "/inscription"
    const label = isLoggedIn ? "Ajouter un enfant" : "Créer ma famille"
    return (
      <Link
        href={href}
        className={`inline-flex items-center gap-2 rounded-full font-bold transition-colors ${compact ? "px-3 py-1 text-[12.5px]" : "px-4 py-2 text-[13.5px]"}`}
        style={{ background: "var(--pine)", color: "#fff", border: "1.5px solid var(--pine)" }}
      >
        <Plus className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        {label}
      </Link>
    )
  }

  return (
    // Compact = inside the sticky bar: non-wrapping row so it scrolls with the
    // bar instead of stacking. Large = hero, where wrapping is fine.
    <div className={compact ? "flex flex-nowrap gap-1.5" : "flex flex-wrap gap-2"}>
      {members.map((m, idx) => {
        const on = selectedMemberIds.includes(m.id)
        const color = memberColor(idx)
        return (
          <button
            key={m.id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggleMember(m)}
            className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition-colors disabled:opacity-60 ${compact ? "shrink-0 py-1 pl-1 pr-2.5 text-[12px]" : "py-1.5 pl-1.5 pr-3 text-[13px]"}`}
            style={{
              background: on ? `${color}1A` : "var(--paper-2)",
              border: `1.5px solid ${on ? color : "var(--line)"}`,
              color: "var(--ink)",
            }}
          >
            <MemberMonogram name={m.name} color={color} size={compact ? 18 : 22} />
            <span className="whitespace-nowrap">{m.name}</span>
          </button>
        )
      })}
    </div>
  )
}
