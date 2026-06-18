import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import type { AgeRationale } from "@/lib/age-rationale"

/**
 * Public, server-rendered "Pourquoi cet âge ?" panel.
 *
 * Renders the age recommendation reasoning as crawlable text (no hover-only
 * content) so parents, Google and answer engines can read and cite WHY a title
 * carries its age. It deliberately uses qualitative words for the content
 * levels (the exact 0–5 numbers live in the score bars below) and never states
 * the scoring rules themselves — see src/lib/age-rationale.ts.
 */
export function WhyThisAge({ rationale }: { rationale: AgeRationale }) {
  if (!rationale.show) return null

  return (
    <section
      className="rounded-2xl p-5 sm:p-6"
      aria-labelledby="why-this-age-heading"
      style={{
        background: "var(--color-warm-card)",
        border: "1px solid var(--color-warm-line)",
        boxShadow:
          "0 1px 2px rgba(58,46,34,.05), 0 14px 34px -18px rgba(58,46,34,.18)",
      }}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-wide mb-1"
        style={{ color: "var(--color-warm-accent)" }}
      >
        Pourquoi cet âge
      </p>
      <h2
        id="why-this-age-heading"
        className="font-serif text-lg sm:text-xl font-medium mb-2"
        style={{ color: "var(--color-warm-ink)", letterSpacing: "-0.02em" }}
      >
        {rationale.heading}
      </h2>

      <p className="text-sm leading-relaxed" style={{ color: "var(--color-warm-ink2)" }}>
        {rationale.lead}
      </p>

      {rationale.drivers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {rationale.drivers.map((d) => (
            <span
              key={d.key}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium"
              style={{
                background: "var(--color-warm-bg2)",
                border: "1px solid var(--color-warm-line)",
                color: "var(--color-warm-ink)",
              }}
            >
              {d.label}
              <span style={{ color: "var(--color-warm-accent)" }}>· {d.level}</span>
            </span>
          ))}
        </div>
      )}

      {rationale.noDriverNote && (
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-warm-ink2)" }}>
          {rationale.noDriverNote}
        </p>
      )}

      {rationale.positives.length > 0 && (
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-warm-ink2)" }}>
          <span className="font-medium" style={{ color: "var(--color-warm-ink)" }}>
            Points d&apos;appui :
          </span>{" "}
          {rationale.positives.join(", ")}.
        </p>
      )}

      {rationale.contextNotes.map((note) => (
        <p
          key={note}
          className="mt-3 text-sm leading-relaxed"
          style={{ color: "var(--color-warm-ink2)" }}
        >
          {note}
        </p>
      ))}

      {/* Trust footer — the "AI as strength" message: independent + guardrailed
          + community-calibrated. Links to the full method. */}
      <div
        className="mt-4 pt-3 flex items-start gap-2.5"
        style={{ borderTop: "1px solid var(--color-warm-line)" }}
      >
        <ShieldCheck
          className="h-4 w-4 mt-0.5 shrink-0"
          style={{ color: "var(--color-warm-accent)" }}
          aria-hidden
        />
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-warm-ink2)" }}>
          {rationale.trustLine}{" "}
          <Link
            href="/notre-methode#recommandations-age"
            className="font-medium underline decoration-dotted underline-offset-2"
            style={{ color: "var(--color-warm-accent)" }}
          >
            Notre méthode
          </Link>
        </p>
      </div>
    </section>
  )
}
