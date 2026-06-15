"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import { Search, Sparkles } from "lucide-react"
import { Wrap, Em } from "./parts"
import { AgeChips } from "./AgeChips"

// Column drift durations (s) — slow, staggered, like the prototype.
const DRIFT = [54, 63, 47, 71, 50, 67, 44, 58]
const COLS = 8

interface HeroRedesignProps {
  /** Real family-friendly poster URLs for the background wall (weekly set). */
  heroPosters: string[]
  selectedKeys: string[]
  onToggleAge: (key: string) => void
}

export function HeroRedesign({ heroPosters, selectedKeys, onToggleAge }: HeroRedesignProps) {
  const router = useRouter()
  const [q, setQ] = useState("")

  // Distribute posters round-robin into columns; triple each column so the
  // -33.33% drift loops seamlessly.
  const columns: string[][] = Array.from({ length: COLS }, () => [])
  heroPosters.forEach((src, i) => columns[i % COLS].push(src))

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    if (term) router.push(`/recherche?q=${encodeURIComponent(term)}`)
  }

  return (
    <section className="relative overflow-hidden" style={{ borderBottom: "1px solid var(--line)" }}>
      {/* Poster wall — subtle, recognizable, drifting */}
      {heroPosters.length > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 grid grid-cols-8 gap-3.5 px-3.5"
          style={{ transform: "rotate(-8deg) scale(1.5)", transformOrigin: "center", opacity: 0.25, filter: "saturate(.9)" }}
        >
          {columns.map((col, ci) => (
            <div
              key={ci}
              className="v2-drift-col flex flex-col gap-3.5"
              style={{ animation: `v2-drift ${DRIFT[ci % DRIFT.length]}s linear infinite`, animationDirection: ci % 2 ? "reverse" : "normal" }}
            >
              {[...col, ...col, ...col].map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-[10px] object-cover" />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Veil so the wall sits behind the text */}
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, transparent 40%, var(--paper) 86%), linear-gradient(180deg, color-mix(in srgb, var(--paper) 55%, transparent), var(--paper) 78%)",
        }}
      />

      <Wrap className="relative z-[2] py-16 text-center">
        <span
          className="inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-[13px] font-semibold"
          style={{ background: "var(--card)", border: "1px solid var(--line)", color: "var(--ink-2)" }}
        >
          <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--pine-2)" }} />
          <b style={{ color: "var(--pine-2)" }}>Indépendant</b> · pensé pour les familles
        </span>

        <h1
          className="mx-auto mt-6 max-w-[14ch] text-[clamp(40px,6vw,76px)] font-bold leading-[1.04]"
          style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em", color: "var(--ink)" }}
        >
          Trouvez les <Em tone="pine">bons contenus</Em>, pour votre <Em tone="terra">famille</Em>.
        </h1>
        <p className="mx-auto mt-4 max-w-[46ch] text-[clamp(17px,2vw,20px)]" style={{ color: "var(--ink-2)" }}>
          Une famille, des goûts, des repères sur-mesure. Voyez en un coup d&apos;œil ce qui convient — et pourquoi.
        </p>

        {/* Personalization module */}
        <div
          className="mx-auto mt-8 max-w-[720px] rounded-[22px] p-[22px] text-left"
          style={{ background: "var(--card)", border: "1px solid var(--line)", boxShadow: "var(--shadow, 0 18px 40px -28px rgba(40,28,12,.55))" }}
        >
          <div className="flex items-center gap-2.5 text-[14px] font-bold" style={{ color: "var(--ink)" }}>
            <span className="grid h-[22px] w-[22px] place-items-center rounded-full text-[12px] text-white" style={{ background: "var(--pine)" }}>1</span>
            Les âges de vos enfants&nbsp;?
          </div>

          <div className="mt-3">
            <AgeChips selectedKeys={selectedKeys} onToggleAge={onToggleAge} size="lg" />
          </div>

          <form onSubmit={onSubmit} className="mt-[18px] flex items-center gap-3">
            <label className="flex flex-1 items-center gap-2.5 rounded-full px-[18px] py-[13px]" style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}>
              <Search className="h-[17px] w-[17px]" style={{ color: "var(--ink-3)" }} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Un titre, un thème, une humeur…"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                style={{ color: "var(--ink)" }}
              />
            </label>
            <a
              href="#weekend"
              className="whitespace-nowrap rounded-full px-5 py-[13px] text-[14.5px] font-bold text-white"
              style={{ background: "var(--terra)" }}
            >
              Voir la sélection
            </a>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]" style={{ color: "var(--ink-3)" }}>
            Populaire :
            {[
              { label: "Films pour enfants", href: "/films?maxAge=7" },
              { label: "Animation", href: "/films/recherche?genres=Animation" },
              { label: "Aventure", href: "/films/recherche?genres=Aventure" },
              { label: "Comédie", href: "/films/recherche?genres=Comédie" },
            ].map((t) => (
              <Link key={t.label} href={t.href} className="rounded-full px-[11px] py-[5px] font-semibold" style={{ background: "var(--paper-2)", border: "1px solid var(--line)", color: "var(--ink-2)" }}>
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      </Wrap>
    </section>
  )
}
