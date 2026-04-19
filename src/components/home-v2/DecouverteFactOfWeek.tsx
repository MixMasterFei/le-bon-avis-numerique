import { APERCU_PALETTE } from "./apercuTheme"
import type { FamilyFact } from "@/lib/family-facts"

export function DecouverteFactOfWeek({
  fact,
  serifClass,
}: {
  fact: FamilyFact
  serifClass: string
}) {
  const p = APERCU_PALETTE
  return (
    <section>
      <div
        className="text-[11px] font-semibold uppercase tracking-wide mb-3"
        style={{ color: p.accent }}
      >
        Le chiffre de la semaine
      </div>
      <div
        className="rounded-3xl px-6 py-8 md:px-10 md:py-12 grid md:grid-cols-[auto_1fr] gap-6 md:gap-10 items-center"
        style={{ background: p.bg2, border: `1px solid ${p.line}` }}
      >
        <div
          className={`${serifClass} text-5xl md:text-7xl font-medium leading-none`}
          style={{ color: p.accent, letterSpacing: "-0.03em" }}
        >
          {fact.stat}
        </div>
        <div>
          <p
            className={`${serifClass} text-lg md:text-xl leading-snug`}
            style={{ color: p.ink, letterSpacing: "-0.01em" }}
          >
            {fact.label}
          </p>
          <p
            className="text-xs md:text-sm italic mt-3"
            style={{ color: p.ink2 }}
          >
            {fact.sourceUrl ? (
              <a
                href={fact.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:opacity-80"
              >
                {fact.source} →
              </a>
            ) : (
              <>{fact.source}</>
            )}
          </p>
        </div>
      </div>
    </section>
  )
}
