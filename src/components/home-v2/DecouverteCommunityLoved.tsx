import { ApercuMediaCard } from "./ApercuMediaCard"
import { APERCU_PALETTE } from "./apercuTheme"
import type { LovedMedia } from "@/lib/discover-digest"

interface DecouverteCommunityLovedProps {
  serifClass: string
  loved: LovedMedia[]
}

export function DecouverteCommunityLoved({
  serifClass,
  loved,
}: DecouverteCommunityLovedProps) {
  const p = APERCU_PALETTE
  if (loved.length === 0) return null

  return (
    <section>
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <h2
          className={`${serifClass} text-2xl md:text-3xl font-medium`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          Ce que les familles ont{" "}
          <em className="italic" style={{ color: p.accent2 }}>
            adoré
          </em>
        </h2>
        <span className="text-xs" style={{ color: p.ink2 }}>
          ces 7 derniers jours
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {loved.map((m) => (
          <div key={m.id} className="relative">
            <ApercuMediaCard media={m} size="sm" serifClass={serifClass} />
            <div
              className="absolute top-1.5 right-1.5 z-30 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: "#FFFFFF", color: p.accent, border: `1px solid ${p.line}` }}
              aria-label={`${m.loveCount} familles ont adoré`}
            >
              <span aria-hidden>❤️</span>
              {m.loveCount}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
