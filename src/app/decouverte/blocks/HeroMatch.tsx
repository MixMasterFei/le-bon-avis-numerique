"use client"

import Link from "next/link"
import { X } from "lucide-react"
import { SafeImage } from "@/components/ui/SafeImage"
import { useSettings } from "@/contexts/SettingsContext"
import { shouldBlurMedia } from "@/lib/should-blur-media"
import { tmdbPosterAtSize } from "@/lib/tmdb-image"
import { toMediaRouteId } from "@/lib/media-route"
import { Em } from "@/components/home-redesign/parts"
import { totemAxesFor, totemLevel, TOTEM_COLORS, TOTEM_WORDS } from "@/components/home-redesign/totem"
import type { TotemMetrics } from "@/components/home-redesign/totem"
import type { BlockMeta, HeroData } from "@/lib/nl-search/resolve-blocks"

const CREAM = "#FBF5EA"

/**
 * « La une » + « la grande séance » : the board's opening spread, per the
 * approved canvas. Two covers, chosen by what art actually exists — the dark
 * cinematic one when a backdrop or still is available (films/séries), the
 * light poster-led one otherwise (every game, and any title whose art the
 * mature gate withheld server-side). Below the cover, the feature article:
 * lede with drop cap, pull-quote from the catalogue's parent bullets, and the
 * verdict card with the totem meters.
 *
 * Guardrails preserved from the previous hero: matureArt strips wide art
 * server-side, the poster follows the per-user blur rule, and a provisional /
 * unreleased title shows its age « à confirmer » with no content analysis.
 */
export function HeroMatch({
  meta,
  hero,
  onDismiss,
}: {
  meta: BlockMeta
  hero: HeroData
  /** « Pas celui-là » on the cover itself — the next best match takes the une.
   *  Absent on shared boards, where viewers must not curate. */
  onDismiss?: () => void
}) {
  const { card, backdropUrl, screenshots, synopsis, voiceLine, quickAnswer, ageRationale } = hero
  const { settings } = useSettings()
  const metrics = (card.contentMetrics ?? null) as TotemMetrics | null

  const blurPoster = shouldBlurMedia(
    {
      type: card.type,
      expertAgeRec: card.expertAgeRec,
      violence: metrics?.violence,
      sexNudity: metrics?.sexNudity,
      language: metrics?.language,
      substanceUse: metrics?.substanceUse,
    },
    settings.blur18Plus,
  )

  const href = `/media/${toMediaRouteId(card.type, card.id)}`
  const wide = backdropUrl ?? screenshots[0] ?? null
  const dark = !!wide
  const age = card.expertAgeRec

  const kickerColor = dark ? "var(--gold)" : "var(--pine-2)"
  const inkMain = dark ? "#FFFDF8" : "var(--ink)"
  const inkSoft = dark ? "rgba(251,245,234,.85)" : "var(--ink-2)"

  return (
    <section className="mt-10">
      {/* ── La une ─────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-[22px]"
        style={{ border: "1px solid var(--line)", background: dark ? "#101B17" : "var(--paper-2)" }}
      >
        {dark ? (
          <div className="absolute inset-0" aria-hidden>
            <SafeImage src={wide!} alt="" fill sizes="(max-width: 1024px) 100vw, 1200px" className="object-cover" fallbackClassName="h-full w-full" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(100deg, rgba(12,17,14,.94) 0%, rgba(12,17,14,.72) 45%, rgba(12,17,14,.22) 80%)" }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(12,17,14,.6) 0%, rgba(0,0,0,0) 50%)" }} />
          </div>
        ) : (
          <div
            className="absolute -right-24 -top-24 h-[420px] w-[420px]"
            style={{ background: "var(--pine-soft)", borderRadius: "41% 59% 54% 46% / 47% 44% 56% 53%" }}
            aria-hidden
          />
        )}

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            title="Retirer ce titre de la sélection"
            aria-label={`Retirer ${card.title} de la sélection`}
            className="absolute right-4 top-4 z-20 grid h-8 w-8 place-items-center rounded-full transition-opacity hover:opacity-75"
            style={
              dark
                ? { background: "rgba(251,245,234,.14)", border: "1px solid rgba(251,245,234,.3)", color: CREAM }
                : { background: "var(--card)", border: "1px solid var(--line)", color: "var(--ink-2)" }
            }
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="relative flex flex-col gap-7 p-7 sm:p-10 md:flex-row md:items-center md:gap-10">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: kickerColor }} />
              <span className="text-[12.5px] font-bold uppercase tracking-[0.16em]" style={{ color: kickerColor }}>
                À la une
              </span>
            </div>

            <h2
              className="mt-3 text-[clamp(34px,4.6vw,64px)] font-bold leading-[1.02]"
              style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em", color: inkMain }}
            >
              <Link href={href}>{card.title}</Link>
            </h2>

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {age !== null && (
                <span
                  className="rounded-full px-4 py-1.5 text-[14px] font-bold"
                  style={dark ? { background: "var(--pine-soft)", color: "var(--pine)" } : { background: "var(--pine)", color: CREAM }}
                >
                  {quickAnswer?.age ?? `Dès ${age} ans`}
                </span>
              )}
              {card.genres.slice(0, 3).map((genre) => (
                <span
                  key={genre}
                  className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
                  style={
                    dark
                      ? { border: "1px solid rgba(251,245,234,.3)", color: "rgba(251,245,234,.9)" }
                      : { border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)" }
                  }
                >
                  {genre}
                </span>
              ))}
            </div>

            {(voiceLine || synopsis) && (
              <p
                className="mt-5 max-w-[56ch] text-[clamp(16px,1.6vw,19px)] leading-[1.5]"
                style={{ fontFamily: "var(--font-newsreader)", fontStyle: "italic", fontWeight: 500, color: inkSoft }}
              >
                {voiceLine ?? synopsis}
              </p>
            )}

            {hero.hideContentAnalysis && (
              <p className="mt-4 text-[12.5px]" style={{ color: dark ? "rgba(251,245,234,.66)" : "var(--ink-3)" }}>
                Âge provisoire, à confirmer après la sortie.
              </p>
            )}
          </div>

          <Link href={href} className="shrink-0 self-center transition-transform duration-200 hover:-translate-y-1 md:self-auto">
            <div
              className="relative aspect-[2/3] w-[150px] overflow-hidden rounded-[16px] sm:w-[190px] md:w-[220px]"
              style={{
                background: "var(--placeholder, #E6DFCE)",
                transform: "rotate(-2.5deg)",
                boxShadow: "0 34px 70px -28px rgba(12,17,14,.75)",
                border: dark ? "1px solid rgba(251,245,234,.2)" : "1px solid var(--line)",
              }}
            >
              {card.posterUrl && (
                <SafeImage
                  src={tmdbPosterAtSize(card.posterUrl, "w342")}
                  alt={card.title}
                  fill
                  sizes="(max-width: 768px) 45vw, 220px"
                  className={blurPoster ? "object-cover blur-md brightness-90" : "object-cover"}
                  fallbackClassName="h-full w-full"
                />
              )}
            </div>
          </Link>
        </div>
      </div>

      {/* ── La grande séance ───────────────────────────────────────── */}
      <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1fr)_396px] md:gap-12">
        <div className="min-w-0">
          {synopsis && (
            <p className="text-[16px] leading-[1.7]" style={{ color: "var(--ink-2)", maxWidth: "64ch" }}>
              <span
                className="float-left pr-3 pt-1 text-[58px] font-bold leading-[0.8]"
                style={{ fontFamily: "var(--font-bricolage)", color: "var(--terra)" }}
              >
                {synopsis.trim().charAt(0)}
              </span>
              {synopsis.trim().slice(1)}
            </p>
          )}

          {hero.whatParentsNeedToKnow.length > 0 && (
            <figure className="mt-7 border-y py-6" style={{ borderTopWidth: 2, borderTopColor: "var(--ink)", borderBottomColor: "var(--line)", margin: "28px 0 0" }}>
              <div className="flex items-start gap-4">
                <span aria-hidden className="text-[54px] leading-[0.7]" style={{ fontFamily: "var(--font-newsreader)", fontStyle: "italic", color: "var(--terra)" }}>
                  «
                </span>
                <div>
                  <blockquote
                    className="max-w-[44ch] text-[clamp(19px,2vw,24px)] leading-[1.42]"
                    style={{ fontFamily: "var(--font-newsreader)", fontStyle: "italic", fontWeight: 500, color: "var(--ink)" }}
                  >
                    {hero.whatParentsNeedToKnow[0]}&nbsp;»
                  </blockquote>
                  <figcaption className="mt-2.5 text-[10.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--ink-3)" }}>
                    Points de vigilance · analyse Totem Avisé
                  </figcaption>
                </div>
              </div>
            </figure>
          )}

          {ageRationale && (ageRationale.drivers.length > 0 || ageRationale.positives.length > 0) && (
            <div className="mt-7">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--ink-3)" }}>
                Ce qui pèse dans l&apos;âge conseillé
              </p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {ageRationale.drivers.slice(0, 4).map((driver) => (
                  <span
                    key={driver.key}
                    className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
                    style={{ background: "rgba(224,144,42,.14)", border: "1px solid rgba(224,144,42,.35)", color: "#8A5A14" }}
                  >
                    {driver.label} · {driver.level}
                  </span>
                ))}
                {ageRationale.positives.slice(0, 3).map((positive) => (
                  <span
                    key={positive}
                    className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
                    style={{ background: "var(--pine-soft)", border: "1px solid rgba(46,92,77,.3)", color: "var(--pine)" }}
                  >
                    {positive}
                  </span>
                ))}
              </div>
            </div>
          )}

          {screenshots.length > 1 && (
            <div className="mt-7">
              <div className="grid grid-cols-3 gap-3.5">
                {screenshots.slice(dark ? 1 : 0, dark ? 4 : 3).map((url) => (
                  <div key={url} className="relative aspect-video overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--line)" }}>
                    <SafeImage src={url} alt="" fill sizes="(max-width: 768px) 33vw, 300px" className="object-cover" fallbackClassName="h-full w-full" />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[12px]" style={{ color: "var(--ink-3)" }}>
                Images du titre
              </p>
            </div>
          )}
        </div>

        {/* Le verdict */}
        <aside
          className="h-fit rounded-[18px] p-7"
          style={{ background: "var(--card)", border: "1px solid var(--line)", boxShadow: "0 18px 40px -28px rgba(40,28,12,.55)" }}
        >
          <p className="text-[12.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--terra)" }}>
            Le verdict
          </p>
          <p className="mt-1.5 text-[clamp(34px,3vw,44px)] font-bold leading-none" style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em", color: "var(--pine)" }}>
            {age !== null ? `Dès ${age} ans` : "Âge à confirmer"}
          </p>
          <p className="mt-2 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
            {hero.hideContentAnalysis
              ? "Estimation avant sortie, précisée ensuite."
              : "Âge conseillé par Totem Avisé, affiné par les votes des familles."}
          </p>

          {!hero.hideContentAnalysis && metrics && (
            <>
              <div className="my-5 h-px" style={{ background: "var(--line)" }} />
              <div className="flex flex-col gap-3">
                {totemAxesFor(card.type).map((axis) => {
                  const level = totemLevel(metrics[axis.key as keyof TotemMetrics] as number | null | undefined)
                  const words = axis.words ?? TOTEM_WORDS
                  return (
                    <div key={axis.key} className="flex items-center justify-between gap-3">
                      <span className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
                        {axis.label}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                          {words[level]}
                        </span>
                        <span className="flex gap-1.5" aria-hidden>
                          {[1, 2, 3].map((step) => (
                            <span
                              key={step}
                              className="inline-block h-[9px] w-[9px] rounded-full"
                              style={{ background: level >= step ? TOTEM_COLORS[level] : "var(--line)" }}
                            />
                          ))}
                        </span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {hero.whatParentsNeedToKnow.length > 1 && (
            <>
              <div className="my-5 h-px" style={{ background: "var(--line)" }} />
              <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--ink-3)" }}>
                Ce que les parents doivent savoir
              </p>
              <ul className="mt-2.5 flex flex-col gap-2">
                {hero.whatParentsNeedToKnow.slice(1, 3).map((item) => (
                  <li key={item} className="text-[13.5px] leading-[1.55]" style={{ color: "var(--ink-2)" }}>
                    {item}
                  </li>
                ))}
              </ul>
            </>
          )}

          {(card.memberScores?.length ?? 0) > 0 && (
            <>
              <div className="my-5 h-px" style={{ background: "var(--line)" }} />
              <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--ink-3)" }}>
                Chez vous
              </p>
              <div className="mt-2.5 flex flex-col gap-2.5">
                {card.memberScores!.slice(0, 4).map((member) => (
                  <div key={member.memberId} className="flex items-center gap-2.5">
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
                      {member.memberName}
                    </span>
                    <span className="block h-[6px] w-[38%] overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
                      <span className="block h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, member.score))}%`, background: "var(--pine-2)" }} />
                    </span>
                    <span className="w-[4ch] text-right text-[13.5px] font-bold tabular-nums" style={{ fontFamily: "var(--font-bricolage)", color: "var(--pine)" }}>
                      {Math.round(member.score)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {hero.platforms.length > 0 && (
            <>
              <div className="my-5 h-px" style={{ background: "var(--line)" }} />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--ink-3)" }}>
                  Où le voir&nbsp;:
                </span>
                {hero.platforms.slice(0, 3).map((platform) => (
                  <span key={platform} className="rounded-full px-3 py-1 text-[12.5px] font-semibold" style={{ background: "var(--paper-2)", border: "1px solid var(--line)", color: "var(--ink)" }}>
                    {platform}
                  </span>
                ))}
              </div>
            </>
          )}

          <Link
            href={href}
            className="mt-6 block rounded-full px-5 py-[11px] text-center text-[14px] font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--terra)" }}
          >
            Voir la fiche complète
          </Link>
        </aside>
      </div>
    </section>
  )
}

/** Shared helper so every board heading gets the same italic-accent treatment. */
export function BoardHeading({
  title,
  em,
  as = "h2",
  tone = "terra",
}: {
  title: string
  em: string | null
  as?: "h2" | "h3"
  tone?: "terra" | "pine" | "gold"
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
      ? "text-[clamp(30px,4.4vw,52px)] font-bold leading-[1.04] max-w-[16ch]"
      : "text-[clamp(22px,2.6vw,30px)] font-bold leading-[1.06]"

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
      <Em tone={tone}>{title.slice(index, index + em.length)}</Em>
      {title.slice(index + em.length)}
    </Tag>
  )
}
