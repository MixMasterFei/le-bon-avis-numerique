"use client"

import Link from "next/link"
import Image from "next/image"
import { Film } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"
import { ageBadgeColor } from "./apercuTheme"
import type { CinemaTendance } from "@/lib/news-cinema-tendances"
import { ageBadgeLabel } from "@/lib/age-label"

/**
 * Sidebar widget: family-friendly films currently in cinemas. Replaces
 * the previous meta-stats ("33 actualités publiées"…) with concrete
 * catalog content — what's actually showing this week, scoped to
 * family-rated titles.
 *
 * Each row links to the media detail page when the film is in our DB.
 * For TMDB-only matches (not yet imported by the cron), the row stays
 * non-clickable rather than 404'ing.
 */
export function CinemaTendancesCard({
  tendances,
  serifClass,
}: {
  tendances: CinemaTendance[]
  serifClass: string
}) {
  const p = APERCU_PALETTE

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: p.bg2, border: `1px solid ${p.line2}` }}
    >
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3"
        style={{ background: p.ink, color: p.bg }}
      >
        <Film className="w-3 h-3" />
        Au cinéma cette semaine
      </div>
      <div className={`${serifClass} text-sm font-medium mb-3`} style={{ color: p.ink }}>
        Pour les familles
      </div>
      <ul className="flex flex-col gap-3">
        {tendances.map((t) => {
          const ageColor = ageBadgeColor(t.expertAgeRec)
          const row = (
            <div className="flex items-center gap-3">
              <div
                className="relative shrink-0 rounded overflow-hidden"
                style={{ width: 48, height: 72, background: p.placeholder }}
              >
                {t.posterUrl && (
                  <Image
                    src={t.posterUrl}
                    alt={t.expertAgeRec !== null ? `${t.title} — dès ${t.expertAgeRec} ans` : t.title}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="text-sm font-medium leading-snug line-clamp-2"
                  style={{ color: p.ink }}
                >
                  {t.title}
                </div>
                {ageBadgeLabel(t.expertAgeRec) && (
                  <span
                    className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold"
                    style={{ background: ageColor.bg, color: ageColor.text }}
                  >
                    {ageBadgeLabel(t.expertAgeRec)}
                  </span>
                )}
              </div>
            </div>
          )
          return (
            <li key={t.id}>
              {t.inDatabase ? (
                <Link href={`/media/${t.id}`} className="block hover:opacity-80 transition-opacity">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
