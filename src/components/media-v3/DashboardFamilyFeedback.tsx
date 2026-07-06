"use client"

import { useState } from "react"
import { Users, ChevronDown, ChevronUp } from "lucide-react"
import { FamilyReactions } from "@/components/media/FamilyReactions"
import { ReviewsSection } from "@/components/media/ReviewsSection"
import type { DashboardReview } from "@/lib/media-dashboard-data"

/**
 * Collapsible "Vous l'avez vu ?" section for the V3 dashboard, collapsed by
 * default to stay synthetic. Expands to per-member family reactions and, via a
 * toggle, the written avis families can read — reusing the existing
 * FamilyReactions and ReviewsSection so behaviour matches the classic fiche.
 */
export function DashboardFamilyFeedback({
  mediaId,
  mediaTitle,
  reviews,
}: {
  mediaId: string
  mediaTitle: string
  reviews: DashboardReview[]
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"reactions" | "reviews">("reactions")
  const Chevron = open ? ChevronUp : ChevronDown

  const seg = (t: "reactions" | "reviews", label: string) => {
    const active = tab === t
    return (
      <button
        type="button"
        onClick={() => setTab(t)}
        className="rounded-md px-3 py-1 text-[11px] font-semibold transition-colors"
        style={
          active
            ? { background: "#2A251F", color: "#FFFFFF", boxShadow: "0 1px 2px rgba(42,37,31,.22)" }
            : { color: "#6B6154", background: "transparent" }
        }
      >
        {label}
      </button>
    )
  }

  return (
    <div className="mb-[13px]">
      <div className="rounded-2xl" style={{ background: "#FFFFFF", border: "1px solid #E4DAC8" }}>
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <span
              className="flex h-8 w-8 flex-none items-center justify-center rounded-lg"
              style={{ background: "#F3DECE", color: "#C0512E" }}
            >
              <Users className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span
                className="block font-serif text-[16px] font-medium"
                style={{ color: "#2A251F", letterSpacing: "-.01em" }}
              >
                Vous l&apos;avez vu ?
              </span>
              <span className="block text-[11.5px]" style={{ color: "#8A8072" }}>
                Réactions &amp; avis de votre famille{reviews.length > 0 ? ` · ${reviews.length} avis` : ""}
              </span>
            </span>
          </button>
          <div className="flex flex-none items-center gap-3">
            {open && (
              <div className="inline-flex items-center rounded-[10px] p-1" style={{ background: "#E7DCC8" }}>
                {seg("reactions", "Réactions")}
                {seg("reviews", `Avis écrits${reviews.length ? ` (${reviews.length})` : ""}`)}
              </div>
            )}
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? "Réduire" : "Développer"}
              className="rounded-full p-1 transition-opacity hover:opacity-70"
            >
              <Chevron className="h-4 w-4" style={{ color: "#8A8072" }} />
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t px-4 pb-4 pt-4 sm:px-5" style={{ borderColor: "#EFE6D6" }}>
            {tab === "reactions" ? (
              <FamilyReactions mediaId={mediaId} mediaTitle={mediaTitle} embedded />
            ) : (
              <ReviewsSection reviews={reviews} mediaId={mediaId} mediaTitle={mediaTitle} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
