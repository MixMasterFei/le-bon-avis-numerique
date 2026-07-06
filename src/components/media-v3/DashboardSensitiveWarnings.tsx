"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { AlertTriangle, ChevronDown, ChevronUp, Plus } from "lucide-react"
import { TriggerChip } from "@/components/media/TriggerChip"
import { useTriggerVotes } from "@/components/media/FicheDataContext"
import { VALID_SENSITIVE_WARNINGS } from "@/lib/sensitive-warnings"

/**
 * "Ce qui peut marquer" for the V3 dashboard — the community trigger-warning
 * card (doesthedogdie-style). Collapsed by default: the labels are mild
 * spoilers ("mort d'un animal"), so revealing them is an explicit tap, same
 * collapsible pattern as DashboardFamilyFeedback.
 *
 * Contents = the AI-seeded flags (confidence-gated by the caller) ∪ categories
 * the community has voted on ∪ labels added this session via the picker. Each
 * renders as the existing TriggerChip (confirm / "pas dans ce film" votes).
 * The picker is a plain <select> over the closed vocabulary — deliberately no
 * free text (moderation + spoiler-trolling) and no new UI machinery.
 */
export function DashboardSensitiveWarnings({
  mediaId,
  aiItems,
}: {
  mediaId: string
  aiItems: string[]
}) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { data: votes } = useTriggerVotes(mediaId)
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [added, setAdded] = useState<string[]>([])
  const [pickerError, setPickerError] = useState<string | null>(null)

  // AI flags first (their enrichment order), then community-voted categories
  // the AI didn't flag, then labels added this session.
  const items = useMemo(() => {
    const base = [...aiItems]
    for (const [cat, c] of Object.entries(votes?.categories ?? {})) {
      if (c.total > 0 && !base.includes(cat)) base.push(cat)
    }
    for (const cat of added) if (!base.includes(cat)) base.push(cat)
    return base
  }, [aiItems, votes, added])

  const available = VALID_SENSITIVE_WARNINGS.filter((w) => !items.includes(w))

  const submitPick = async (category: string) => {
    if (!category) return
    setPickerError(null)
    try {
      const res = await fetch(`/api/media/${mediaId}/trigger-vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, present: true }),
      })
      if (res.status === 403) {
        setPickerError("Ajoutez un profil famille pour signaler un élément.")
        return
      }
      if (!res.ok) {
        setPickerError("Impossible d'enregistrer — réessayez.")
        return
      }
      setAdded((a) => [...a, category])
      setPicking(false)
    } catch {
      setPickerError("Impossible d'enregistrer — réessayez.")
    }
  }

  const Chevron = open ? ChevronUp : ChevronDown

  return (
    <div className="mb-[13px] rounded-2xl" style={{ background: "#FFFFFF", border: "1px solid #E4DAC8" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left sm:p-5"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg"
            style={{ background: "#F7ECD7", color: "#C7892F" }}
          >
            <AlertTriangle className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span
              className="block font-serif text-[16px] font-medium"
              style={{ color: "#2A251F", letterSpacing: "-.01em" }}
            >
              Ce qui peut marquer
            </span>
            <span className="block text-[11.5px]" style={{ color: "#8A8072" }}>
              {items.length > 0
                ? `${items.length} point${items.length > 1 ? "s" : ""} de vigilance · afficher (peut divulgâcher)`
                : "Aucun point signalé pour l'instant"}
            </span>
          </span>
        </span>
        <Chevron className="h-4 w-4 flex-none" style={{ color: "#8A8072" }} />
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3.5 sm:px-5" style={{ borderColor: "#EFE6D6" }}>
          <p className="mb-3 text-[12px] leading-relaxed" style={{ color: "#8A8072" }}>
            Repères signalés par l&apos;analyse et confirmés par les parents — des points à
            vérifier selon la sensibilité de votre enfant, pas des scènes garanties.
          </p>

          {items.length > 0 && (
            <div className="mb-3 flex flex-wrap items-start gap-2">
              {items.map((item) => (
                <TriggerChip
                  key={item}
                  mediaId={mediaId}
                  category={item}
                  seedUserVote={added.includes(item)}
                />
              ))}
            </div>
          )}

          {session?.user ? (
            picking ? (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  defaultValue=""
                  onChange={(e) => submitPick(e.target.value)}
                  className="rounded-lg px-2.5 py-1.5 text-[12.5px]"
                  style={{ background: "#FBF8F2", border: "1px solid #E4DAC8", color: "#4A433A" }}
                  aria-label="Choisir un élément sensible à signaler"
                >
                  <option value="" disabled>
                    Choisir un élément…
                  </option>
                  {available.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setPicking(false)
                    setPickerError(null)
                  }}
                  className="text-[12px]"
                  style={{ color: "#8A8072" }}
                >
                  Annuler
                </button>
              </div>
            ) : (
              available.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-opacity hover:opacity-80"
                  style={{ background: "#FBF8F2", border: "1px solid #E4DAC8", color: "#6B6154" }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Signaler un autre élément
                </button>
              )
            )
          ) : (
            <Link
              href={`/connexion?callbackUrl=${encodeURIComponent(pathname)}`}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold transition-opacity hover:opacity-80"
              style={{ color: "#C0512E" }}
            >
              <Plus className="h-3.5 w-3.5" />
              Connectez-vous pour signaler un élément
            </Link>
          )}

          {pickerError && (
            <p className="mt-2 text-[12px]" style={{ color: "#C0512E" }}>
              {pickerError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
