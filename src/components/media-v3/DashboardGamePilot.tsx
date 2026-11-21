import type { AgeRationale } from "@/lib/age-rationale"
import type { PracticalSheet } from "@/lib/game-practical-sheet"

/**
 * Blocks shown on the game fiches of the « augmentation » pilot only
 * (src/lib/game-pilot.ts). Server components, no client state: everything is
 * computed by pure builders from stored data — no new age, no generated fact.
 */

const SECTION_LABEL = "text-[10px] font-bold uppercase tracking-[.13em]"

const cardStyle = { background: "var(--f-card)", border: "1px solid var(--f-border)" } as const

/** Visible « Pourquoi cet âge ? » — the same text the FAQ JSON-LD carries. */
export function DashboardAgeRationale({
  rationale,
  pegiComparison,
}: {
  rationale: AgeRationale
  pegiComparison: string | null
}) {
  if (!rationale.show) return null
  return (
    <section className="mb-[13px] rounded-2xl p-4 sm:p-[18px]" style={cardStyle} aria-labelledby="pourquoi-cet-age">
      <div className={`${SECTION_LABEL} mb-2`} style={{ color: "var(--f-faint)" }}>
        Pourquoi cet âge ?
      </div>
      <h2
        id="pourquoi-cet-age"
        className="font-serif text-[15px] font-semibold leading-snug sm:text-[16px]"
        style={{ color: "var(--f-ink)", letterSpacing: "-.01em" }}
      >
        {rationale.heading}
      </h2>
      <p className="mt-1.5 text-[12.5px] leading-[1.55]" style={{ color: "var(--f-body)" }}>
        {rationale.lead}
      </p>
      {pegiComparison && (
        <p className="mt-1.5 text-[12.5px] leading-[1.55]" style={{ color: "var(--f-body)" }}>
          {pegiComparison}
        </p>
      )}
      {rationale.noDriverNote && (
        <p className="mt-1.5 text-[12.5px] leading-[1.55]" style={{ color: "var(--f-body)" }}>
          {rationale.noDriverNote}
        </p>
      )}
      {rationale.positives.length > 0 && (
        <p className="mt-1.5 text-[12.5px] leading-[1.55]" style={{ color: "var(--f-body)" }}>
          Points d&apos;appui : {rationale.positives.join(", ")}.
        </p>
      )}
      {rationale.contextNotes.map((note) => (
        <p key={note} className="mt-1.5 text-[12.5px] leading-[1.55]" style={{ color: "var(--f-body)" }}>
          {note}
        </p>
      ))}
      <p className="mt-2 text-[11px] leading-[1.5]" style={{ color: "var(--f-faint)" }}>
        {rationale.trustLine}
      </p>
    </section>
  )
}

/** « Fiche pratique » — players, online/local play, purchases, studio, series, duration. */
export function DashboardPracticalSheet({ sheet }: { sheet: PracticalSheet }) {
  if (!sheet.show) return null
  return (
    <section className="mb-[13px] rounded-2xl p-4 sm:p-[18px]" style={cardStyle} aria-labelledby="fiche-pratique">
      <h2 id="fiche-pratique" className={`${SECTION_LABEL} mb-3`} style={{ color: "var(--f-faint)" }}>
        Fiche pratique
      </h2>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {sheet.rows.map((row) => (
          <div
            key={row.key}
            className="flex items-baseline justify-between gap-3 border-b pb-1.5"
            style={{ borderColor: "var(--f-divider)" }}
          >
            <dt className="text-[12px]" style={{ color: "var(--f-muted)" }}>
              {row.label}
            </dt>
            <dd
              className="text-right text-[12.5px] font-medium"
              style={{ color: row.known ? "var(--f-ink)" : "var(--f-faint)" }}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2.5 text-[11px]" style={{ color: "var(--f-faint)" }}>
        {sheet.caveat}
      </p>
    </section>
  )
}
