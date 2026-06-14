"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Play, Share2, Heart, Clapperboard, Calendar } from "lucide-react"
import { useFamilyFitData, useExtrasData } from "@/components/media/FicheDataContext"
import { familyFitBandFromLevel, type FamilyFitBand } from "@/lib/family-fit-display"

// Prototype status colours (green / blue / warn / coral).
const BAND_CHIP: Record<FamilyFitBand, { bg: string; border: string; text: string; mark: string }> = {
  veryAdapted: { bg: "#E7EFE7", border: "#cfe0d2", text: "#5C8A66", mark: "✓" },
  goodChoice: { bg: "#E7EDF5", border: "#d3deec", text: "#5777A4", mark: "✓" },
  check: { bg: "#F7ECD7", border: "#ecdcbc", text: "#C7892F", mark: "⚠" },
  notYet: { bg: "#FBEAE2", border: "#f0cdbe", text: "#DB6242", mark: "⚠" },
}

const AMBER_BADGE = "radial-gradient(circle at 32% 28%,#F9A23E,#EF8C2A)"

interface MediaDashboardBarProps {
  mediaId: string | null
  mediaType: string
  title: string
  posterUrl: string
  expertAgeRec: number | null
  isProvisional?: boolean
  hideContentAnalysis?: boolean
  releaseDateLabel?: string | null
  director?: string | null
  isUpcoming?: boolean
}

function Separator({ at }: { at: "md" | "lg" }) {
  return (
    <div
      className={`hidden ${at === "md" ? "md:block" : "lg:block"} h-11 w-px shrink-0`}
      style={{ background: "var(--color-line2)" }}
    />
  )
}

/**
 * Slim, collapsing summary bar that slides in once the hero scrolls behind
 * the site header. Mirrors the redesign prototype: poster · verdict, a
 * labelled "Ma famille" section (chips, or a "Se connecter" CTA when logged
 * out), a "Où le regarder" section, then the key actions. Sits on a lighter
 * elevated surface (with a drop shadow) so it stands out from the header.
 * Fixed overlay (no layout shift), respects reduced-motion.
 */
export function MediaDashboardBar({
  mediaId,
  mediaType,
  title,
  posterUrl,
  expertAgeRec,
  isProvisional,
  hideContentAnalysis,
  releaseDateLabel,
  director,
  isUpcoming,
}: MediaDashboardBarProps) {
  const { data: session } = useSession()
  const [show, setShow] = useState(false)
  const [topOffset, setTopOffset] = useState(64)
  const [inList, setInList] = useState(false)
  const [listBusy, setListBusy] = useState(false)
  const { data: familyFit } = useFamilyFitData(mediaId)
  const { data: extras } = useExtrasData(mediaId, mediaType)

  useEffect(() => {
    const hero = document.getElementById("fiche-hero")
    if (!hero) return
    const header = document.querySelector("header")
    let io: IntersectionObserver | null = null

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

  const members =
    !hideContentAnalysis &&
    familyFit &&
    (familyFit.status === "ok" || familyFit.status === "family_warning")
      ? familyFit.members.slice(0, 3)
      : []
  const familyStatus = familyFit?.status

  const flatrate = extras?.watchProviders?.flatrate ?? []
  const inTheaters = Boolean(extras?.inTheaters)
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

  const toggleList = async () => {
    if (!mediaId || listBusy) return
    setListBusy(true)
    setInList((v) => !v)
    try {
      const res = await fetch("/api/user/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId }),
      })
      if (res.ok) {
        const data = await res.json()
        setInList(Boolean(data.inWatchlist))
      }
    } catch {
      setInList((v) => !v)
    } finally {
      setListBusy(false)
    }
  }

  const labelClass = "text-[10px] font-bold uppercase tracking-[0.08em]"

  return (
    <div
      className="fixed inset-x-0 z-40 transition-transform duration-300 motion-reduce:transition-none"
      style={{
        top: topOffset,
        transform: show ? "translateY(0)" : "translateY(-130%)",
        background: "var(--color-card)",
        borderBottom: "1px solid var(--color-line2)",
        boxShadow: "0 16px 32px -16px rgba(58,46,34,.45)",
        backdropFilter: "saturate(140%) blur(12px)",
        WebkitBackdropFilter: "saturate(140%) blur(12px)",
      }}
      aria-hidden={!show}
      inert={!show}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-4 py-2">
          {/* poster + identity */}
          <div
            className="relative h-[54px] w-9 shrink-0 overflow-hidden rounded-md"
            style={{ background: "var(--color-placeholder)" }}
          >
            <Image src={posterUrl} alt={title} fill sizes="36px" className="object-cover" />
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span
              className="truncate font-serif text-base font-semibold"
              style={{ color: "var(--color-ink)", maxWidth: "38vw" }}
            >
              {title}
            </span>
            <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--color-ink2)" }}>
              {expertAgeRec ? (
                <>
                  <span
                    className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1 text-[11px] font-bold text-white"
                    style={{ background: AMBER_BADGE }}
                  >
                    {expertAgeRec}+
                  </span>
                  <span>Dès {expertAgeRec} ans{provisional ? " · à confirmer" : ""}</span>
                </>
              ) : (
                <span>Âge à venir</span>
              )}
            </span>
            {(releaseDateLabel || director) && (
              <span
                className="hidden truncate text-[11px] lg:block"
                style={{ color: "var(--color-ink2)", maxWidth: "34vw" }}
              >
                {[releaseDateLabel, director].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>

          {/* MA FAMILLE — chips, or a "Se connecter" CTA when logged out */}
          {!hideContentAnalysis && familyStatus && (
            <>
              <Separator at="md" />
              <div className="hidden shrink-0 flex-col gap-1 md:flex">
                <span className={labelClass} style={{ color: "var(--color-ink2)" }}>Ma famille</span>
                {members.length > 0 ? (
                  <div className="flex gap-1.5">
                    {members.map((m) => {
                      const c = BAND_CHIP[familyFitBandFromLevel(m.level)]
                      return (
                        <span
                          key={m.id}
                          className="whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold"
                          style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
                        >
                          {m.name} {c.mark}
                        </span>
                      )
                    })}
                  </div>
                ) : (
                  <Link
                    href={familyStatus === "no_family" ? "/profil" : "/connexion"}
                    className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
                    style={{ background: "var(--color-bg2)", color: "var(--color-accent)" }}
                  >
                    {familyStatus === "no_family" ? "Créer mon profil" : "Se connecter →"}
                  </Link>
                )}
              </div>
            </>
          )}

          {/* OÙ LE REGARDER — upcoming release date, "Au cinéma", or streaming */}
          {(isUpcoming || inTheaters || flatrate.length > 0) && (
            <>
              <Separator at="lg" />
              <div className="hidden shrink-0 flex-col gap-1 lg:flex">
                <span className={labelClass} style={{ color: "var(--color-ink2)" }}>Où le regarder</span>
                <div className="flex gap-1.5">
                  {isUpcoming ? (
                    <span
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-semibold"
                      style={{ background: "#F7ECD7", color: "#C7892F" }}
                    >
                      {mediaType === "MOVIE" ? (
                        <Clapperboard className="h-3 w-3" />
                      ) : (
                        <Calendar className="h-3 w-3" />
                      )}
                      {mediaType === "MOVIE"
                        ? releaseDateLabel
                          ? `Au cinéma le ${releaseDateLabel}`
                          : "Bientôt au cinéma"
                        : releaseDateLabel
                          ? `Sortie le ${releaseDateLabel}`
                          : "Bientôt disponible"}
                    </span>
                  ) : (
                    <>
                      {inTheaters && (
                        <span
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-semibold"
                          style={{ background: "#E7EFE7", color: "#5C8A66" }}
                        >
                          <Clapperboard className="h-3 w-3" />
                          Au cinéma
                        </span>
                      )}
                      {flatrate.slice(0, inTheaters ? 2 : 3).map((prov) => (
                        <span
                          key={prov.provider_id || prov.provider_name}
                          className="whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-semibold"
                          style={{ background: "var(--color-bg2)", color: "var(--color-ink)" }}
                        >
                          {prov.provider_name}
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </>
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
            {mediaId &&
              (session?.user ? (
                <button
                  onClick={toggleList}
                  disabled={listBusy}
                  aria-label="Ajouter à ma liste"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-60"
                  style={{ background: "var(--color-bg2)", color: inList ? "#5C8A66" : "var(--color-ink)" }}
                >
                  <Heart className="h-4 w-4" style={{ fill: inList ? "#5C8A66" : "transparent" }} />
                </button>
              ) : (
                <Link
                  href="/connexion"
                  aria-label="À voir"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: "var(--color-bg2)", color: "var(--color-ink)" }}
                >
                  <Heart className="h-4 w-4" />
                </Link>
              ))}
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
