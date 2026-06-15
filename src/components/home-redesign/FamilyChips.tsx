"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { getMemberAge } from "@/lib/age-utils"
import { ageBucketKeyForAge } from "@/components/home-v2/apercuTheme"
import { MemberMonogram } from "./MemberMonogram"
import { memberColor } from "./family"

export interface FamilyMemberLite {
  id: string
  name: string
  birthYear: number | null
  birthMonth: number | null
}

/**
 * "Votre famille sur mesure" — one chip per family member; clicking a member
 * activates the homepage age filter for their age band (maps to the same
 * selectedKeys the age chips use). When the visitor has no family (logged out
 * or no members yet), it shows a single "+" that leads to family creation — a
 * gentle nudge to sign up / build a profile.
 */
export function FamilyChips({
  members,
  selectedKeys,
  onToggleAge,
  isLoggedIn,
  size = "lg",
}: {
  members: FamilyMemberLite[]
  selectedKeys: string[]
  onToggleAge: (key: string) => void
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
    <div className={compact ? "flex flex-wrap gap-1.5" : "flex flex-wrap gap-2"}>
      {members.map((m, idx) => {
        const age = getMemberAge(m.birthYear, m.birthMonth)
        const bucketKey = age != null ? ageBucketKeyForAge(age) : null
        const on = bucketKey ? selectedKeys.includes(bucketKey) : false
        const color = memberColor(idx)
        return (
          <button
            key={m.id}
            type="button"
            aria-pressed={on}
            disabled={!bucketKey}
            onClick={() => bucketKey && onToggleAge(bucketKey)}
            className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition-colors disabled:opacity-60 ${compact ? "py-1 pl-1 pr-2.5 text-[12px]" : "py-1.5 pl-1.5 pr-3 text-[13px]"}`}
            style={{
              background: on ? `${color}1A` : "var(--paper-2)",
              border: `1.5px solid ${on ? color : "var(--line)"}`,
              color: "var(--ink)",
            }}
          >
            <MemberMonogram name={m.name} color={color} size={compact ? 18 : 22} />
            <span className="whitespace-nowrap">
              {m.name}
              {age != null && <span style={{ color: "var(--ink-3)" }}> · {age} ans</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
