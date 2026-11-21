import Link from "next/link"
import { SafeImage } from "@/components/ui/SafeImage"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { toMediaRouteId } from "@/lib/media-route"
import { ageSentenceLabel } from "@/lib/age-label"
import { officialRatingLabel } from "@/lib/utils"
import type { BandGroup } from "@/lib/noel/selection"
import type { NoelCard } from "@/lib/noel/queries"

/**
 * The age-band sections shared by the /noel pages: one anchored section per
 * band (« 3 à 5 ans »…), a poster grid inside, every card linking to its
 * fiche. Server component — the list must be in the crawled HTML.
 */
export function NoelBandNav({ groups }: { groups: BandGroup<NoelCard>[] }) {
  const p = APERCU_PALETTE
  return (
    <nav aria-label="Tranches d'âge" className="flex flex-wrap gap-2">
      {groups.map(({ band, items }) => (
        <a
          key={band.key}
          href={`#age-${band.key}`}
          className="rounded-full px-4 py-1.5 text-sm font-semibold hover:opacity-80"
          style={{ background: p.bg2, color: p.ink, border: `1px solid ${p.line}` }}
        >
          {band.label}
          <span className="ml-1.5 font-normal" style={{ color: p.ink2 }}>
            {items.length}
          </span>
        </a>
      ))}
    </nav>
  )
}

export function NoelBandSections({
  groups,
  emptyText,
  seeAll,
}: {
  groups: BandGroup<NoelCard>[]
  /** Shown in a band with no title yet. */
  emptyText: string
  /** Optional « Voir tout » link per band (must carry the band's filters). */
  seeAll?: (band: BandGroup<NoelCard>["band"]) => { href: string; label: string } | null
}) {
  const p = APERCU_PALETTE
  return (
    <div className="space-y-14">
      {groups.map(({ band, items }) => {
        const more = seeAll?.(band) ?? null
        return (
          <section key={band.key} id={`age-${band.key}`} className="scroll-mt-24">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <h2
                className="font-serif text-2xl md:text-3xl font-medium"
                style={{ color: p.ink, letterSpacing: "-0.02em" }}
              >
                {band.label}
              </h2>
              {more && (
                <Link href={more.href} className="text-sm font-semibold hover:opacity-70" style={{ color: p.accent }}>
                  {more.label} →
                </Link>
              )}
            </div>
            {items.length === 0 ? (
              <p className="text-sm" style={{ color: p.ink2 }}>
                {emptyText}
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {items.map((item) => (
                  <li key={item.id}>
                    <NoelCardView item={item} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function NoelCardView({ item }: { item: NoelCard }) {
  const p = APERCU_PALETTE
  const href = `/media/${toMediaRouteId(item.type, item.id)}`
  const age = ageSentenceLabel(item.expertAgeRec)
  const pegi = item.type === "GAME" ? officialRatingLabel(item.officialRating, "GAME") : null
  const name = item.disambiguationYear ? `${item.title} (${item.disambiguationYear})` : item.title
  return (
    <div className="group">
      <Link href={href} className="block">
        <div
          className="relative aspect-[2/3] overflow-hidden rounded-xl"
          style={{ background: p.placeholder, boxShadow: `0 4px 12px ${p.line}` }}
        >
          {item.posterUrl && (
            <SafeImage
              src={item.posterUrl}
              alt={name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
        </div>
        <h3 className="mt-2 text-sm font-semibold leading-snug group-hover:opacity-70" style={{ color: p.ink }}>
          {name}
        </h3>
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
        {age && (
          <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: p.bg2, color: p.accent2 }}>
            {age}
          </span>
        )}
        {pegi && <span style={{ color: p.ink2 }}>{pegi}</span>}
      </div>
      {item.platforms.length > 0 && (
        <p className="mt-1 text-xs" style={{ color: p.ink2 }}>
          {item.platforms.join(" · ")}
        </p>
      )}
      {item.guideKey && (
        <Link
          href={`/jeux/guide/${item.guideKey}`}
          className="mt-1 inline-block text-xs font-semibold hover:opacity-70"
          style={{ color: p.accent }}
        >
          Guide parents
        </Link>
      )}
    </div>
  )
}
