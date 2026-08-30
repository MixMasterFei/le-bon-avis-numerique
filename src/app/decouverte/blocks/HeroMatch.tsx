"use client"

import Link from "next/link"
import { SafeImage } from "@/components/ui/SafeImage"
import { tmdbPosterAtSize } from "@/lib/tmdb-image"
import { toMediaRouteId } from "@/lib/media-route"
import { Em } from "@/components/home-redesign/parts"
import type { BlockMeta, HeroData } from "@/lib/nl-search/resolve-blocks"

/**
 * The board's opening statement: one title, given real estate.
 *
 * Two treatments, chosen by what art actually exists. Films and series have a
 * reliable `backdropUrl` and get the full-bleed cinematic version; games never
 * have one (the importer stores covers and stills only), so they get a
 * poster-led composition on warm paper. The poster path is not a degraded
 * fallback — it has to look deliberate, because it is what every game renders.
 *
 * Everything written here is either catalogue data or one of the deterministic
 * builders (quick answer, age rationale, totem voice line). Nothing on this
 * block is generated at request time.
 */
export function HeroMatch({ meta, hero }: { meta: BlockMeta; hero: HeroData }) {
  const { card, backdropUrl, screenshots, synopsis, voiceLine, quickAnswer, ageRationale } = hero
  const href = `/media/${toMediaRouteId(card.type, card.id)}`
  const eyebrow = meta.eyebrow ?? meta.title ?? "Notre meilleure pioche"
  const wide = backdropUrl ?? screenshots[0] ?? null
  const age = card.expertAgeRec

  return (
    <section className="relative mt-10 overflow-hidden rounded-[22px]" style={{ border: "1px solid var(--line)" }}>
      {wide && (
        <div className="absolute inset-0" aria-hidden>
          <SafeImage
            src={wide}
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 1200px"
            className="object-cover"
            fallbackClassName="h-full w-full"
          />
          {/* Two scrims: one to seat the text, one to keep the paper palette
              present so the block still reads as part of the site. */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(105deg, rgba(20,15,10,.92) 0%, rgba(20,15,10,.72) 45%, rgba(20,15,10,.35) 100%)" }}
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(20,15,10,.55) 0%, rgba(0,0,0,0) 55%)" }}
          />
        </div>
      )}

      <div
        className="relative flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:gap-8 md:p-10"
        style={wide ? undefined : { background: "var(--card)" }}
      >
        <Link href={href} className="shrink-0 self-start transition-transform duration-200 hover:-translate-y-1">
          <div
            className="relative aspect-[2/3] w-[132px] overflow-hidden rounded-[14px] sm:w-[164px] md:w-[196px]"
            style={{ background: "var(--placeholder, #E6DFCE)", boxShadow: "0 18px 40px -22px rgba(20,15,10,.75)" }}
          >
            {card.posterUrl && (
              <SafeImage
                src={tmdbPosterAtSize(card.posterUrl, "w342")}
                alt={card.title}
                fill
                sizes="(max-width: 768px) 40vw, 200px"
                className="object-cover"
                fallbackClassName="h-full w-full"
              />
            )}
          </div>
        </Link>

        <div className="min-w-0 flex-1">
          <p
            className="text-[12.5px] font-bold uppercase tracking-[0.16em]"
            style={{ color: wide ? "#E8B48A" : "var(--terra)" }}
          >
            {eyebrow}
          </p>

          <h2
            className="mt-2 text-[clamp(26px,3.6vw,44px)] font-bold leading-[1.05]"
            style={{
              fontFamily: "var(--font-bricolage)",
              letterSpacing: "-0.02em",
              color: wide ? "#FFFDF8" : "var(--ink)",
            }}
          >
            <Link href={href}>{card.title}</Link>
          </h2>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {age !== null && (
              <span
                className="rounded-full px-3 py-1 text-[13px] font-bold"
                style={{ background: wide ? "rgba(255,253,248,.16)" : "var(--pine-soft)", color: wide ? "#FFFDF8" : "var(--pine)" }}
              >
                {quickAnswer?.age ?? `Dès ${age} ans`}
              </span>
            )}
            {card.genres.slice(0, 3).map((genre) => (
              <span
                key={genre}
                className="rounded-full px-3 py-1 text-[12.5px] font-semibold"
                style={{
                  background: wide ? "rgba(255,253,248,.10)" : "var(--paper-2)",
                  color: wide ? "rgba(255,253,248,.86)" : "var(--ink-2)",
                  border: wide ? "1px solid rgba(255,253,248,.18)" : "1px solid var(--line)",
                }}
              >
                {genre}
              </span>
            ))}
          </div>

          {(voiceLine || synopsis) && (
            <p
              className="mt-4 max-w-[62ch] text-[15.5px] leading-relaxed"
              style={{ color: wide ? "rgba(255,253,248,.90)" : "var(--ink-2)" }}
            >
              {voiceLine ?? synopsis}
            </p>
          )}

          {ageRationale && ageRationale.drivers.length > 0 && (
            <div className="mt-5">
              <p
                className="text-[12.5px] font-bold uppercase tracking-[0.14em]"
                style={{ color: wide ? "rgba(255,253,248,.62)" : "var(--ink-3)" }}
              >
                Ce qui pèse dans l&apos;âge conseillé
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ageRationale.drivers.slice(0, 4).map((driver) => (
                  <span
                    key={driver.key}
                    className="rounded-full px-3 py-1 text-[12.5px] font-semibold"
                    style={{
                      background: wide ? "rgba(255,253,248,.10)" : "var(--paper-2)",
                      color: wide ? "rgba(255,253,248,.86)" : "var(--ink-2)",
                      border: wide ? "1px solid rgba(255,253,248,.18)" : "1px solid var(--line)",
                    }}
                  >
                    {driver.label} · {driver.level}
                  </span>
                ))}
              </div>
            </div>
          )}

          {meta.lead && (
            <p
              className="mt-4 max-w-[60ch] text-[14px]"
              style={{ color: wide ? "rgba(255,253,248,.72)" : "var(--ink-3)" }}
            >
              {meta.lead}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={href}
              className="rounded-full px-5 py-[11px] text-[14.5px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--terra)" }}
            >
              Voir la fiche
            </Link>
            {hero.hideContentAnalysis && (
              <span className="text-[12.5px]" style={{ color: wide ? "rgba(255,253,248,.70)" : "var(--ink-3)" }}>
                Âge provisoire, à confirmer après la sortie
              </span>
            )}
          </div>
        </div>
      </div>

      {screenshots.length > 1 && (
        <div className="relative grid grid-cols-3 gap-1 p-1 sm:grid-cols-4" style={{ background: wide ? "rgba(20,15,10,.55)" : "var(--paper-2)" }}>
          {screenshots.slice(0, 4).map((url, index) => (
            <div key={url} className={`relative aspect-video overflow-hidden rounded-[8px] ${index === 3 ? "hidden sm:block" : ""}`}>
              <SafeImage src={url} alt="" fill sizes="25vw" className="object-cover" fallbackClassName="h-full w-full" />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** Shared helper so every board heading gets the same italic-accent treatment. */
export function BoardHeading({
  title,
  em,
  as = "h2",
}: {
  title: string
  em: string | null
  as?: "h2" | "h3"
}) {
  const Tag = as
  const index = em ? title.toLowerCase().indexOf(em.toLowerCase()) : -1
  const style = {
    fontFamily: "var(--font-bricolage)",
    letterSpacing: "-0.02em",
    color: "var(--ink)",
  } as const
  const className =
    as === "h2"
      ? "text-[clamp(26px,3.4vw,40px)] font-bold leading-[1.04]"
      : "text-[clamp(20px,2.4vw,28px)] font-bold leading-[1.06]"

  if (index < 0 || !em) {
    return (
      <Tag className={className} style={style}>
        {title}
      </Tag>
    )
  }
  return (
    <Tag className={className} style={style}>
      {title.slice(0, index)}
      <Em tone="terra">{title.slice(index, index + em.length)}</Em>
      {title.slice(index + em.length)}
    </Tag>
  )
}
