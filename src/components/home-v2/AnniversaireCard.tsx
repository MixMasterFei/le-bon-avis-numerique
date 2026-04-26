"use client"

import Link from "next/link"
import { SafeImage } from "@/components/ui/SafeImage"
import { Cake, ArrowRight } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"
import { toMediaRouteId } from "@/lib/media-route"
import type { CatalogAnniversary } from "@/lib/catalog-anniversary"

const TYPE_NOUN: Record<CatalogAnniversary["type"], string> = {
  MOVIE: "le film",
  TV: "la série",
  GAME: "le jeu",
}

/**
 * Sidebar widget: "Il y a X ans aujourd'hui sortait …" — pulled from
 * the existing catalog. Pure nostalgia hook + a recurring reason to
 * click into a media detail page (which has age recs, content metrics,
 * the whole Totem treatment).
 */
export function AnniversaireCard({
  anniversary,
  serifClass,
}: {
  anniversary: CatalogAnniversary
  serifClass: string
}) {
  const p = APERCU_PALETTE
  const href = `/media/${toMediaRouteId(anniversary.type, anniversary.id)}`

  return (
    <Link
      href={href}
      className="group block rounded-2xl p-5 transition-transform duration-200 hover:-translate-y-0.5"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3"
        style={{ background: p.bg2, color: p.ink }}
      >
        <Cake className="w-3 h-3" />
        Anniversaire catalogue
      </div>
      <div className="flex gap-3 items-start">
        {anniversary.posterUrl && (
          <div
            className="relative w-16 h-24 rounded-lg overflow-hidden shrink-0"
            style={{ background: p.placeholder }}
          >
            <SafeImage
              src={anniversary.posterUrl}
              alt={anniversary.title}
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[11px] mb-1" style={{ color: p.ink2 }}>
            Il y a <strong style={{ color: p.accent, fontWeight: 700 }}>{anniversary.yearsAgo} ans</strong> aujourd&apos;hui sortait {TYPE_NOUN[anniversary.type]}
          </div>
          <div
            className={`${serifClass} text-base leading-snug font-medium mb-2`}
            style={{ color: p.ink, letterSpacing: "-0.01em" }}
          >
            {anniversary.title}
          </div>
          <div
            className="inline-flex items-center gap-1 text-xs font-semibold group-hover:opacity-70"
            style={{ color: p.accent }}
          >
            Voir la fiche
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </Link>
  )
}
