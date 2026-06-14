"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { preserveStickyParams } from "./stickyParams"

/**
 * Smart ellipsis pager (the mock's `.pager`) that scales to hundreds of pages:
 *   ‹ Précédent · 1 … 86 [87] 88 … 174 · Suivant ›  + an "Aller à la page" jump.
 * On mobile the numbers collapse to a compact "p / n" between the arrows.
 *
 * Hrefs are built from the server `filterQuery` + `route`, with the sticky
 * params (`v`, `font`) carried through so paging never drops the V2 variant.
 */

/** [1, "…", p-1, p, p+1, "…", total] with edge-aware windows. */
function pageList(cur: number, total: number): (number | "…")[] {
  const wanted = new Set<number>([1, total, cur, cur - 1, cur + 1])
  const sorted = [...wanted].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: (number | "…")[] = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) out.push("…")
    out.push(p)
    prev = p
  }
  return out
}

export function CataloguePager({
  page,
  totalPages,
  filterQuery,
  route,
}: {
  page: number
  totalPages: number
  filterQuery: string
  route: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [jump, setJump] = useState("")

  if (totalPages <= 1) return null

  const buildHref = (target: number) => {
    const sp = new URLSearchParams(filterQuery)
    if (target > 1) sp.set("page", String(target))
    else sp.delete("page")
    preserveStickyParams(sp, searchParams)
    const qs = sp.toString()
    return qs ? `${route}?${qs}` : route
  }

  const go = (target: number) => {
    const clamped = Math.min(totalPages, Math.max(1, target))
    router.push(buildHref(clamped))
  }

  const submitJump = () => {
    const n = parseInt(jump, 10)
    if (Number.isFinite(n)) go(n)
    setJump("")
  }

  const items = pageList(page, totalPages)

  return (
    <nav
      className="mt-10 flex flex-col items-center gap-4 border-t pt-6"
      style={{ borderColor: "var(--line-2)" }}
      aria-label="Pagination"
    >
      <div className="flex items-center gap-1.5">
        <Arrow href={page > 1 ? buildHref(page - 1) : null} dir="prev" />

        {/* Numbered buttons — desktop */}
        <div className="hidden items-center gap-1.5 sm:flex">
          {items.map((it, i) =>
            it === "…" ? (
              <span key={`e${i}`} className="px-1.5 text-sm" style={{ color: "var(--ink-3)" }}>…</span>
            ) : it === page ? (
              <span
                key={it}
                aria-current="page"
                className="inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-bold"
                style={{ background: "var(--terra)", color: "#fff" }}
              >
                {it}
              </span>
            ) : (
              <Link
                key={it}
                href={buildHref(it)}
                className="inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-semibold transition-colors hover:opacity-70"
                style={{ background: "var(--card)", color: "var(--ink)", border: "1px solid var(--line)" }}
              >
                {it}
              </Link>
            ),
          )}
        </div>

        {/* Compact "p / n" — mobile */}
        <span className="px-3 text-sm font-semibold sm:hidden" style={{ color: "var(--ink)" }}>
          {page} / {totalPages}
        </span>

        <Arrow href={page < totalPages ? buildHref(page + 1) : null} dir="next" />
      </div>

      {/* Jump box */}
      <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--ink-2)" }}>
        <span>Aller à la page</span>
        <input
          value={jump}
          onChange={(e) => setJump(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitJump()
          }}
          inputMode="numeric"
          aria-label="Numéro de page"
          className="h-8 w-16 rounded-lg px-2 text-center text-sm outline-none"
          style={{ background: "var(--card)", color: "var(--ink)", border: "1px solid var(--line)" }}
        />
        <button
          onClick={submitJump}
          className="h-8 rounded-lg px-3 text-sm font-bold transition-opacity hover:opacity-80"
          style={{ background: "var(--ink)", color: "var(--paper)" }}
        >
          OK
        </button>
        <span style={{ color: "var(--ink-3)" }}>sur {totalPages}</span>
      </div>
    </nav>
  )
}

function Arrow({ href, dir }: { href: string | null; dir: "prev" | "next" }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight
  const label = dir === "prev" ? "Précédent" : "Suivant"
  const base = "inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold"
  if (!href) {
    return (
      <span
        className={`${base} cursor-not-allowed opacity-40`}
        style={{ background: "var(--card)", color: "var(--ink-2)", border: "1px solid var(--line)" }}
        aria-disabled="true"
      >
        {dir === "prev" && <Icon className="h-4 w-4" />}
        <span className="hidden sm:inline">{label}</span>
        {dir === "next" && <Icon className="h-4 w-4" />}
      </span>
    )
  }
  return (
    <Link
      href={href}
      rel={dir === "prev" ? "prev" : "next"}
      className={`${base} transition-colors hover:opacity-70`}
      style={{ background: "var(--card)", color: "var(--ink)", border: "1px solid var(--line)" }}
    >
      {dir === "prev" && <Icon className="h-4 w-4" />}
      <span className="hidden sm:inline">{label}</span>
      {dir === "next" && <Icon className="h-4 w-4" />}
    </Link>
  )
}
