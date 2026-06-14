"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Play, Share2 } from "lucide-react"
import { useFamilyFitData, useExtrasData } from "@/components/media/FicheDataContext"
import {
  familyFitBandFromLevel,
  FAMILY_FIT_LABELS,
  type FamilyFitBand,
} from "@/lib/family-fit-display"
import { ageBadgeColor } from "@/components/home-v2/apercuTheme"

const BAND_CHIP: Record<FamilyFitBand, { bg: string; text: string; mark: string }> = {
  veryAdapted: { bg: "rgba(92,138,92,0.16)", text: "#4d8a63", mark: "✓" },
  goodChoice: { bg: "rgba(62,126,156,0.14)", text: "#3E7E9C", mark: "✓" },
  check: { bg: "rgba(192,138,62,0.18)", text: "#B07A2E", mark: "·" },
  notYet: { bg: "rgba(209,106,74,0.16)", text: "#C8512F", mark: "⚠" },
}

interface MediaDashboardBarProps {
  mediaId: string | null
  mediaType: string
  title: string
  posterUrl: string
  expertAgeRec: number | null
  isProvisional?: boolean
  hideContentAnalysis?: boolean
}

/**
 * Slim, collapsing summary bar that slides in once the hero scrolls behind
 * the site header. Reads the shared fiche data (family fit + streaming) from
 * FicheDataProvider. Fixed overlay (no layout shift), sits just below the
 * sticky header, and respects prefers-reduced-motion.
 */
export function MediaDashboardBar({
  mediaId,
  mediaType,
  title,
  posterUrl,
  expertAgeRec,
  isProvisional,
  hideContentAnalysis,
}: MediaDashboardBarProps) {
  const [show, setShow] = useState(false)
  const [topOffset, setTopOffset] = useState(64)
  const { data: familyFit } = useFamilyFitData(mediaId)
  const { data: extras } = useExtrasData(mediaId, mediaType)

  useEffect(() => {
    const hero = document.getElementById("fiche-hero")
    if (!hero) return
    const header = document.querySelector("header")
    let io: IntersectionObserver | null = null

    // Position the bar right under the (variable-height) header and reveal
    // it once the hero has scrolled past that line. Recomputed on resize so
    // the offset tracks the header growing/shrinking across breakpoints.
    const setup = () => {
      const h = header?.offsetHeight ?? 64
      setTopOffset(h)
      io?.disconnect()
      io = new IntersectionObserver(
        ([entry]) => setShow(!entry.isIntersecting),
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

  const ageColor = ageBadgeColor(expertAgeRec)
  const members =
    !hideContentAnalysis &&
    familyFit &&
    (familyFit.status === "ok" || familyFit.status === "family_warning")
      ? familyFit.members.slice(0, 3)
      : []

  const flatrate = extras?.watchProviders?.flatrate ?? []
  const trailerKey = extras?.trailer?.key ?? null
  const provisional = isProvisional || hideContentAnalysis

  const handleShare = () => {
    if (typeof window === "undefined") return
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {})
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {})
    }
  }

  return (
    <div
      className="fixed inset-x-0 z-40 transition-transform duration-300 motion-reduce:transition-none"
      style={{
        top: topOffset,
        transform: show ? "translateY(0)" : "translateY(-130%)",
        background: "var(--color-header-bg)",
        borderBottom: "1px solid var(--color-line)",
        backdropFilter: "saturate(140%) blur(12px)",
        WebkitBackdropFilter: "saturate(140%) blur(12px)",
      }}
      aria-hidden={!show}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 sm:gap-4 py-2">
          {/* poster + identity */}
          <div
            className="relative h-12 w-8 shrink-0 overflow-hidden rounded"
            style={{ background: "var(--color-placeholder)" }}
          >
            <Image src={posterUrl} alt={title} fill sizes="32px" className="object-cover" />
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span
              className="truncate font-serif text-sm font-medium sm:text-base"
              style={{ color: "var(--color-ink)", maxWidth: "42vw" }}
            >
              {title}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--color-ink2)" }}>
              {expertAgeRec ? (
                <>
                  <span
                    className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
                    style={{ background: ageColor.bg, color: ageColor.text }}
                  >
                    {expertAgeRec}+
                  </span>
                  <span className="hidden sm:inline">
                    Dès {expertAgeRec} ans{provisional ? " · à confirmer" : ""}
                  </span>
                </>
              ) : (
                <span className="hidden sm:inline">Âge à venir</span>
              )}
            </span>
          </div>

          {/* family chips — hidden < md */}
          {members.length > 0 && (
            <div
              className="ml-1 hidden items-center gap-1.5 border-l pl-3 md:flex"
              style={{ borderColor: "var(--color-line)" }}
            >
              {members.map((m) => {
                const band = familyFitBandFromLevel(m.level)
                const c = BAND_CHIP[band]
                return (
                  <span
                    key={m.id}
                    className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: c.bg, color: c.text }}
                    title={FAMILY_FIT_LABELS[band]}
                  >
                    {m.name} {c.mark}
                  </span>
                )
              })}
            </div>
          )}

          {/* streaming chips — hidden < lg */}
          {flatrate.length > 0 && (
            <div
              className="ml-1 hidden items-center gap-1.5 border-l pl-3 lg:flex"
              style={{ borderColor: "var(--color-line)" }}
            >
              {flatrate.slice(0, 3).map((prov) => (
                <span
                  key={prov.provider_id || prov.provider_name}
                  className="whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: "var(--color-bg2)", color: "var(--color-ink)" }}
                >
                  {prov.provider_name}
                </span>
              ))}
            </div>
          )}

          {/* actions */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {trailerKey && (
              <a
                href={`https://www.youtube.com/watch?v=${trailerKey}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white sm:text-sm"
                style={{ background: "var(--color-accent)" }}
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span className="hidden sm:inline">Bande-annonce</span>
              </a>
            )}
            <button
              onClick={handleShare}
              aria-label="Partager"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: "var(--color-bg2)", color: "var(--color-ink)" }}
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
