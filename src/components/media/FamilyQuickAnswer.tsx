"use client"

import Link from "next/link"
import { Sparkles, LogIn, UserPlus } from "lucide-react"
import {
  useFamilyFitData,
  type FamilyFitMember,
} from "@/components/media/FicheDataContext"
import { familyFitBandFromLevel, type FamilyFitBand } from "@/lib/family-fit-display"

const BAND_PILL: Record<FamilyFitBand, { bg: string; text: string; mark: string }> = {
  veryAdapted: { bg: "#E7EFE7", text: "#5C8A66", mark: "✓" },
  goodChoice: { bg: "#E7EDF5", text: "#5777A4", mark: "✓" },
  check: { bg: "#F7ECD7", text: "#C7892F", mark: "· à voir" },
  notYet: { bg: "#FBEAE2", text: "#DB6242", mark: "⚠" },
}

function joinNames(members: FamilyFitMember[]): string {
  const names = members.map((m) => m.name)
  if (names.length <= 1) return names.join("")
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`
}

// Shared "mine" card shell (coral-tinted), used for every state so the
// "Adapté à ma famille ?" box is always present beside the generic answer.
function Shell({
  subtitle,
  className,
  children,
}: {
  subtitle: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={`flex-1 rounded-xl p-4 ${className ?? ""}`}
      style={{
        // Dark-aware warm tokens so the box flips in Soirée mode (the old
        // #FFF7F3 / #f0cdbe hex stayed light).
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
        {subtitle}
      </p>
      {children}
    </div>
  )
}

const primaryBtn =
  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
const secondaryBtn =
  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-opacity hover:opacity-80"

/**
 * "Adapté à ma famille ?" — the personalized companion to the generic quick
 * answer. Always rendered beside it (the page gates it off only for
 * provisional fiches): personalized when logged in with family members,
 * otherwise a connect / create-profile prompt.
 */
export function FamilyQuickAnswer({ mediaId, className }: { mediaId: string; className?: string }) {
  const { data, loading } = useFamilyFitData(mediaId)

  if (loading) {
    return (
      <Shell subtitle="Réponse personnalisée" className={className}>
        <div className="space-y-2 pt-1">
          <div className="h-3 w-3/4 rounded animate-pulse" style={{ background: "var(--color-warm-bg2)" }} />
          <div className="h-3 w-1/2 rounded animate-pulse" style={{ background: "var(--color-warm-bg2)" }} />
        </div>
      </Shell>
    )
  }

  const members = data && (data.status === "ok" || data.status === "family_warning") ? data.members : []

  // Logged out, no family, or no members yet → invite to connect / build a profile.
  if (members.length === 0) {
    const noFamily = data?.status === "no_family"
    return (
      <Shell subtitle="Réponse personnalisée" className={className}>
        <p className="mb-3 text-sm leading-relaxed" style={{ color: "var(--color-warm-ink2)" }}>
          {noFamily
            ? "Ajoutez les membres de votre famille pour savoir si ce film convient à chacun de vos enfants."
            : "Connectez-vous pour savoir si ce film convient à chacun de vos enfants."}
        </p>
        <div className="flex flex-wrap gap-2">
          {noFamily ? (
            <Link href="/profil" className={primaryBtn} style={{ background: "var(--color-warm-accent)" }}>
              <UserPlus className="h-4 w-4" />
              Ajouter ma famille
            </Link>
          ) : (
            <>
              <Link href="/connexion" className={primaryBtn} style={{ background: "var(--color-warm-accent)" }}>
                <LogIn className="h-4 w-4" />
                Se connecter
              </Link>
              <Link
                href="/inscription"
                className={secondaryBtn}
                style={{ color: "var(--color-warm-ink)", border: "1px solid var(--color-warm-line)" }}
              >
                Créer un profil
              </Link>
            </>
          )}
        </div>
      </Shell>
    )
  }

  // Personalized answer
  const band = (m: FamilyFitMember) => familyFitBandFromLevel(m.level)
  const good = members.filter((m) => band(m) === "veryAdapted" || band(m) === "goodChoice")
  const caution = members.filter((m) => band(m) === "check")
  const tooEarly = members.filter((m) => band(m) === "notYet")

  const sentences: string[] = []
  if (good.length) sentences.push(`Convient bien à ${joinNames(good)}.`)
  if (caution.length) sentences.push(`Pour ${joinNames(caution)}, c'est tout juste — à voir selon ses goûts.`)
  if (tooEarly.length) sentences.push(`Encore un peu tôt pour ${joinNames(tooEarly)}.`)

  return (
    <Shell subtitle="D'après les profils de vos enfants" className={className}>
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
    </Shell>
  )
}
