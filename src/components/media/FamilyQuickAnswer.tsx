"use client"

import { Sparkles } from "lucide-react"
import {
  useFamilyFitData,
  type FamilyFitMember,
} from "@/components/media/FicheDataContext"
import { familyFitBandFromLevel, type FamilyFitBand } from "@/lib/family-fit-display"

const BAND_PILL: Record<FamilyFitBand, { bg: string; text: string; mark: string }> = {
  veryAdapted: { bg: "rgba(92,138,92,0.16)", text: "#4d8a63", mark: "✓" },
  goodChoice: { bg: "rgba(62,126,156,0.14)", text: "#3E7E9C", mark: "✓" },
  check: { bg: "rgba(192,138,62,0.18)", text: "#B07A2E", mark: "· à voir" },
  notYet: { bg: "rgba(209,106,74,0.16)", text: "#C8512F", mark: "⚠" },
}

function joinNames(members: FamilyFitMember[]): string {
  const names = members.map((m) => m.name)
  if (names.length <= 1) return names.join("")
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`
}

/**
 * "Adapté à ma famille ?" — the personalized companion to the generic quick
 * answer. Renders only for a logged-in user with family members (reads the
 * shared family-fit data); returns null otherwise so the generic answer
 * spans full width. The page already gates this off for provisional fiches.
 */
export function FamilyQuickAnswer({ mediaId, className }: { mediaId: string; className?: string }) {
  const { data, loading } = useFamilyFitData(mediaId)

  if (loading) return null
  if (!data || (data.status !== "ok" && data.status !== "family_warning")) return null

  const { members } = data
  if (members.length === 0) return null

  const band = (m: FamilyFitMember) => familyFitBandFromLevel(m.level)
  const good = members.filter((m) => band(m) === "veryAdapted" || band(m) === "goodChoice")
  const caution = members.filter((m) => band(m) === "check")
  const tooEarly = members.filter((m) => band(m) === "notYet")

  const sentences: string[] = []
  if (good.length) sentences.push(`Convient bien à ${joinNames(good)}.`)
  if (caution.length) sentences.push(`Pour ${joinNames(caution)}, c'est tout juste — à voir selon ses goûts.`)
  if (tooEarly.length) sentences.push(`Encore un peu tôt pour ${joinNames(tooEarly)}.`)

  return (
    <div
      className={`flex-1 rounded-xl p-4 ${className ?? ""}`}
      style={{
        background: "linear-gradient(135deg, var(--color-warm-bg2), var(--color-warm-card))",
        border: "1px solid var(--color-warm-line)",
      }}
    >
      <h3
        className="mb-0.5 flex items-center gap-1.5 font-serif text-base font-medium sm:text-lg"
        style={{ color: "var(--color-warm-ink)", letterSpacing: "-0.02em" }}
      >
        <Sparkles className="h-4 w-4" style={{ color: "var(--color-warm-accent)" }} />
        Adapté à ma famille&nbsp;?
      </h3>
      <p className="mb-2 text-xs" style={{ color: "var(--color-warm-ink2)" }}>
        D&apos;après les profils de vos enfants
      </p>
      <p className="text-sm leading-relaxed" style={{ color: "var(--color-warm-ink2)" }}>
        {sentences.join(" ")}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {members.map((m) => {
          const c = BAND_PILL[band(m)]
          return (
            <span
              key={m.id}
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ background: c.bg, color: c.text }}
            >
              {m.name} {c.mark}
            </span>
          )
        })}
      </div>
    </div>
  )
}
