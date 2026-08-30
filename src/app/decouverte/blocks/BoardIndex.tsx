"use client"

import Link from "next/link"
import { toMediaRouteId } from "@/lib/media-route"
import { Em } from "@/components/home-redesign/parts"
import type { AssembledCard } from "@/lib/nl-search/assemble"

/**
 * The magazine's back page: the FULL selection as a dense, scannable index.
 * The editorial sections above feature a few titles large; this is what keeps
 * the board useful as a search result — every idea, one line each, linking to
 * its fiche.
 */
export function BoardIndex({ items, folio }: { items: AssembledCard[]; folio: string }) {
  if (items.length < 4) return null

  const third = Math.ceil(items.length / 3)
  const columns = [items.slice(0, third), items.slice(third, third * 2), items.slice(third * 2)]

  return (
    <section className="py-[52px] md:py-[62px]" style={{ background: "var(--paper-2)", borderBlock: "1px solid var(--line)" }}>
      <div className="mx-auto max-w-[1240px] px-5 sm:px-7">
        <div className="flex items-end justify-between gap-4 border-t pt-4" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--terra)" }} />
            <span className="text-[12.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--terra)" }}>
              L&apos;index
            </span>
          </div>
          <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: "var(--ink-3)" }}>
            {items.length} idées
          </span>
        </div>
        <div className="mt-3 flex items-start gap-5">
          <span
            aria-hidden
            className="mt-1 text-[clamp(30px,4vw,52px)] font-bold leading-none"
            style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.04em", color: "var(--terra)", opacity: 0.42 }}
          >
            {folio}
          </span>
          <h2
            className="max-w-[16ch] text-[clamp(26px,3.4vw,40px)] font-bold leading-[1.04]"
            style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em", color: "var(--ink)" }}
          >
            Votre sélection <Em tone="terra">complète</Em>
          </h2>
        </div>

        <div className="mt-7 grid gap-x-11 md:grid-cols-2 lg:grid-cols-3">
          {columns.map((column, columnIndex) => (
            <div key={columnIndex}>
              {column.map((item, rowIndex) => (
                <Link
                  key={item.id}
                  href={`/media/${toMediaRouteId(item.type, item.id)}`}
                  className="flex items-baseline gap-3 py-[9px] transition-opacity hover:opacity-70"
                  style={{ borderBottom: rowIndex === column.length - 1 ? "none" : "1px solid var(--line)" }}
                >
                  <span
                    className="min-w-0 flex-1 truncate text-[14.5px] font-bold"
                    style={{ fontFamily: "var(--font-bricolage)", color: "var(--ink)" }}
                  >
                    {item.title}
                  </span>
                  {item.genres[0] && (
                    <span className="hidden whitespace-nowrap text-[12.5px] sm:inline" style={{ color: "var(--ink-3)" }}>
                      {item.genres[0]}
                    </span>
                  )}
                  <span
                    className="whitespace-nowrap rounded-[8px] px-2 py-[3px] text-[12px] font-bold"
                    style={{ background: "var(--pine-soft)", color: "var(--pine)" }}
                  >
                    {item.expertAgeRec !== null ? `${item.expertAgeRec}+` : "à confirmer"}
                  </span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
