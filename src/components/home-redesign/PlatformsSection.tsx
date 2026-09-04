"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Band, Wrap, SectionHead, Em } from "./parts"
import { isOutOfSeason } from "@/lib/seasonal"
import { RedesignCard, type RedesignCardMedia } from "./RedesignCard"
import { useRankedByFit } from "./useRankedByFit"
import { fitsHomepageAge } from "@/lib/homepage-age-cap"

interface StreamingRow {
  id: string
  type?: string
  title: string
  posterUrl: string | null
  expertAgeRec?: number | null
  genres?: string[]
  topics?: string[]
  contentMetrics?: RedesignCardMedia["contentMetrics"]
}

interface Provider {
  id: string
  label: string
  search: string
  filter: string
  dot: string
}

const PROVIDERS: Provider[] = [
  { id: "netflix", label: "Netflix", search: "Netflix", filter: "Netflix", dot: "#E50914" },
  { id: "disney", label: "Disney+", search: "Disney Plus", filter: "Disney+", dot: "#113CCF" },
  { id: "prime", label: "Prime Video", search: "Amazon Prime Video", filter: "Prime Video", dot: "#00A8E1" },
  { id: "canal", label: "Canal+", search: "Canal", filter: "Canal+", dot: "#111111" },
]

export function PlatformsSection({ maxAge, audience, rankByMemberIds }: { maxAge?: number; audience?: string; rankByMemberIds?: string[] }) {
  const [sel, setSel] = useState<Provider>(PROVIDERS[0])
  const [items, setItems] = useState<RedesignCardMedia[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // Family-oriented section: default cap 12; when the homepage age filter is
  // active, follow it.
  const cap = typeof maxAge === "number" ? maxAge : 12
  const eligible = useMemo(() => items.filter((item) => fitsHomepageAge(item, cap)), [items, cap])
  const ranked = useRankedByFit(eligible, rankByMemberIds)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    // Over-fetch (24 for a 12-card row): the seasonal gate below can legitimately
    // drop several titles — Netflix's family catalogue is dense with Noël films
    // and the rail was serving them in August, which is the loudest possible
    // "this site is stale" signal.
    const month = new Date().getMonth()
    fetch(`/api/db/streaming?provider=${encodeURIComponent(sel.search)}&limit=24&maxAge=${cap}&type=SUBSCRIPTION&shuffle=weekly&language=fr,en`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        const arr: StreamingRow[] = Array.isArray(data?.movies) ? data.movies : []
        setItems(
          arr
            .filter((m) => !isOutOfSeason({ title: m.title, genres: m.genres, topics: m.topics }, month))
            .slice(0, 12)
            .map((m) => ({
              id: m.id,
              type: m.type === "TV" ? ("TV" as const) : ("MOVIE" as const),
              title: m.title,
              posterUrl: m.posterUrl,
              expertAgeRec: m.expertAgeRec ?? null,
              genres: m.genres ?? [],
              contentMetrics: m.contentMetrics ?? null,
            })),
        )
        setTotal(typeof data?.total === "number" ? data.total : arr.length)
      })
      .catch(() => { if (!cancelled) { setItems([]); setTotal(0) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sel, cap])

  return (
    <Band alt id="streaming">
      <Wrap>
        <SectionHead
          eyebrow="Ce soir"
          title={audience ? <>Sur vos <Em tone="pine">plateformes</Em> <Em tone="terra">· {audience}</Em></> : <>Sur vos <Em tone="pine">plateformes</Em></>}
          lead="Ce qui est dispo, là, maintenant — filtré par vos abonnements."
        />
        <div className="mb-6 flex flex-wrap gap-2 sm:gap-2.5">
          {PROVIDERS.map((pr) => {
            const active = sel.id === pr.id
            return (
              <button
                key={pr.id}
                onClick={() => setSel(pr)}
                aria-pressed={active}
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors sm:px-4 sm:py-2 sm:text-[14px]"
                style={{
                  border: `1.5px solid ${active ? "var(--ink)" : "var(--line)"}`,
                  background: active ? "var(--paper-2)" : "var(--card)",
                  color: active ? "var(--ink)" : "var(--ink-2)",
                }}
              >
                <span className="inline-block h-[11px] w-[11px] rounded-[3px]" style={{ background: pr.dot }} />
                {pr.label}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="v2-row">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-[14px]" style={{ background: "var(--placeholder, #E6DFCE)" }} />
            ))}
          </div>
        ) : ranked.length > 0 ? (
          <>
            <div className="v2-row">
              {ranked.map((m) => (
                <RedesignCard key={m.id} media={m} totem="compact" showType />
              ))}
            </div>
            <div className="mt-3 text-[14px]" style={{ color: "var(--ink-2)" }}>
              {total.toLocaleString("fr-FR")} titres sur {sel.label} ·{" "}
              <Link
                href={`/films/recherche?platforms=${encodeURIComponent(sel.filter)}&maxAge=${cap}`}
                className="font-bold"
                style={{ color: "var(--terra)" }}
              >
                Voir tout →
              </Link>
            </div>
          </>
        ) : (
          <p className="text-sm" style={{ color: "var(--ink-3)" }}>
            Pas encore de données pour {sel.label}. Mise à jour quotidienne.
          </p>
        )}
      </Wrap>
    </Band>
  )
}
