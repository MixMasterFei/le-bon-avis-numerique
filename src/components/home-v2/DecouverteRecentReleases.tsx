import { ApercuMediaCard, type ApercuCardMedia } from "./ApercuMediaCard"
import { APERCU_PALETTE } from "./apercuTheme"

interface DecouverteRecentReleasesProps {
  serifClass: string
  releases: ApercuCardMedia[]
}

export function DecouverteRecentReleases({
  serifClass,
  releases,
}: DecouverteRecentReleasesProps) {
  const p = APERCU_PALETTE
  if (releases.length === 0) return null

  return (
    <section>
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <h2
          className={`${serifClass} text-2xl md:text-3xl font-medium`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          Sorties{" "}
          <em className="italic" style={{ color: p.accent }}>
            à découvrir
          </em>
        </h2>
        <span className="text-xs" style={{ color: p.ink2 }}>
          dans le catalogue ce mois-ci
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {releases.map((m) => (
          <ApercuMediaCard
            key={m.id}
            media={m}
            size="sm"
            serifClass={serifClass}
          />
        ))}
      </div>
    </section>
  )
}
