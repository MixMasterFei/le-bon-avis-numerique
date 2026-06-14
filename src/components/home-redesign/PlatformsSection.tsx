"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Band, Wrap, SectionHead, Em, RailRow } from "./parts"
import { RedesignCard, type RedesignCardMedia } from "./RedesignCard"

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

export function PlatformsSection() {
  const [sel, setSel] = useState<Provider>(PROVIDERS[0])
  const [items, setItems] = useState<RedesignCardMedia[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetch(`/api/db/streaming?provider=${encodeURIComponent(sel.search)}&limit=12&maxAge=12&type=SUBSCRIPTION&shuffle=weekly&language=fr,en`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        const arr = Array.isArray(data?.movies) ? data.movies : []
        setItems(
          arr.map((m: { id: string; type?: string; title: string; posterUrl: string | null; expertAgeRec?: number | null; genres?: string[]; contentMetrics?: RedesignCardMedia["contentMetrics"] }) => ({
            id: m.id,
            type: m.type === "TV" ? "TV" : "MOVIE",
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
  }, [sel])

  return (
    <Band alt id="streaming">
      <Wrap>
        <SectionHead
          eyebrow="Ce soir"
          title={<>Sur vos <Em tone="pine">plateformes</Em></>}
          lead="Ce qui est dispo, là, maintenant — filtré par vos abonnements."
        />
        <div className="mb-6 flex flex-wrap gap-2.5">
          {PROVIDERS.map((pr) => {
            const active = sel.id === pr.id
            return (
              <button
                key={pr.id}
                onClick={() => setSel(pr)}
                aria-pressed={active}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-bold transition-colors"
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
          <RailRow>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-none" style={{ width: 178, scrollSnapAlign: "start" }}>
                <div className="aspect-[2/3] animate-pulse rounded-[14px]" style={{ background: "var(--placeholder, #E6DFCE)" }} />
              </div>
            ))}
          </RailRow>
        ) : items.length > 0 ? (
          <>
            <RailRow>
              {items.map((m) => (
                <div key={m.id} className="flex-none" style={{ width: 178, scrollSnapAlign: "start" }}>
                  <RedesignCard media={m} totem="compact" showType />
                </div>
              ))}
            </RailRow>
            <div className="mt-3 text-[14px]" style={{ color: "var(--ink-2)" }}>
              {total.toLocaleString("fr-FR")} titres sur {sel.label} ·{" "}
              <Link
                href={`/films/recherche?platforms=${encodeURIComponent(sel.filter)}&maxAge=12`}
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
