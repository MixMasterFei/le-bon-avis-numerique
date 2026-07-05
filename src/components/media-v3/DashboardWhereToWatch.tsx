"use client"

import { useState } from "react"
import { useExtrasData } from "@/components/media/FicheDataContext"

/**
 * "Où regarder" card for the V3 dashboard: a segmented Location / Achat ·
 * Streaming · Cinéma control on the header row, then the matching provider
 * list below (no prices). Segments with nothing available are greyed out and
 * not selectable — so a cinema-only title lands on a green-lit Cinéma segment
 * with Location & Streaming disabled. Real data via the shared extras fetch.
 */

interface Provider {
  provider_name: string
  logo_path: string
}

const LABEL = "text-[10px] font-bold uppercase tracking-[.13em]"

function dedup(list: Provider[]): Provider[] {
  const seen = new Set<string>()
  const out: Provider[] = []
  for (const p of list) {
    const k = p.provider_name.toLowerCase()
    if (!seen.has(k)) {
      seen.add(k)
      out.push(p)
    }
  }
  return out
}

function ProviderRows({ providers }: { providers: Provider[] }) {
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? providers : providers.slice(0, 4)
  const extra = providers.length - shown.length
  return (
    <div>
      <div className="flex flex-col">
        {shown.map((p, i) => (
          <div
            key={p.provider_name}
            className="flex items-center gap-2.5 py-1.5"
            style={{ borderTop: i === 0 ? "none" : "1px solid #EFE6D6" }}
          >
            <span className="h-[22px] w-[22px] flex-none overflow-hidden rounded-md" style={{ background: "#EDE4D5" }}>
              {p.logo_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                  alt={p.provider_name}
                  width={22}
                  height={22}
                  className="h-full w-full object-cover"
                />
              )}
            </span>
            <span className="text-[12px] font-semibold" style={{ color: "#2A251F" }}>
              {p.provider_name}
            </span>
          </div>
        ))}
      </div>
      {extra > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2.5 w-full rounded-lg border border-dashed py-1.5 text-[11px] font-semibold"
          style={{ borderColor: "#D2A85A", background: "#FBF4E4", color: "#A8752A" }}
        >
          + {extra} autre{extra > 1 ? "s" : ""} plateforme{extra > 1 ? "s" : ""}
        </button>
      )}
    </div>
  )
}

type Key = "location" | "streaming" | "cinema"

export function DashboardWhereToWatch({ mediaId, mediaType }: { mediaId: string; mediaType: string }) {
  const { data, loading } = useExtrasData(mediaId, mediaType)
  const [active, setActive] = useState<Key | null>(null)

  const wp = data?.watchProviders
  const location = dedup([...(wp?.rent ?? []), ...(wp?.buy ?? [])])
  const streaming = dedup([...(wp?.flatrate ?? []), ...(wp?.free ?? [])])
  const cinema = Boolean(data?.inTheaters)

  const segments: { key: Key; label: string; available: boolean }[] = [
    { key: "location", label: "Location / Achat", available: location.length > 0 },
    { key: "streaming", label: "Streaming", available: streaming.length > 0 },
    { key: "cinema", label: "Cinéma", available: cinema },
  ]

  const firstAvailable = segments.find((s) => s.available)?.key ?? null
  const current = active && segments.find((s) => s.key === active)?.available ? active : firstAvailable
  const anyAvailable = firstAvailable !== null

  return (
    <>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className={LABEL} style={{ color: "#A89A82" }}>
          Où regarder
        </div>
        {anyAvailable && (
          <div className="inline-flex items-center rounded-lg p-0.5" style={{ background: "#EFE6D6" }}>
            {segments.map((s) => {
              const isActive = current === s.key
              const style = !s.available
                ? { color: "#C4B8A0", background: "transparent" as const }
                : isActive
                  ? { color: "#FFFFFF", background: "#2A251F" }
                  : { color: "#6B6154", background: "transparent" as const }
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={!s.available}
                  onClick={() => setActive(s.key)}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10.5px] font-semibold transition-colors disabled:cursor-default"
                  style={style}
                >
                  {s.key === "cinema" && s.available && (
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#3E8158" }} />
                  )}
                  {s.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-5 animate-pulse rounded" style={{ background: "#EDE4D5" }} />
          ))}
        </div>
      ) : !anyAvailable ? (
        <p className="text-[12.5px]" style={{ color: "#8A8072" }}>
          Disponibilités bientôt.
        </p>
      ) : current === "cinema" ? (
        <div className="flex items-center gap-2 py-1 text-[12.5px] font-medium" style={{ color: "#3E8158" }}>
          <span className="h-2 w-2 rounded-full" style={{ background: "#3E8158" }} />
          Actuellement au cinéma
        </div>
      ) : current === "streaming" ? (
        <ProviderRows providers={streaming} />
      ) : (
        <ProviderRows providers={location} />
      )}
    </>
  )
}
