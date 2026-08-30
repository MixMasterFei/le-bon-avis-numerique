"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition, type ReactNode } from "react"
import { Loader2, Search, Sparkles } from "lucide-react"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { MemberMonogram } from "@/components/home-redesign/MemberMonogram"
import { memberColor } from "@/components/home-redesign/family"
import { v2FontVars } from "@/components/home-redesign/fonts"
import { Em } from "@/components/home-redesign/parts"
import { CARE_BANNER } from "@/lib/nl-search/care"
import { NL_SEARCH_SUGGESTIONS } from "@/lib/nl-search/suggestions"
import { AVOID_RULES } from "@/lib/nl-search/vocab"
import type { AssembledCard } from "@/lib/nl-search/assemble"
import { computeStripes, type ResolvedBoard } from "@/lib/nl-search/resolve-blocks"
import type { NlIntent } from "@/lib/nl-search/types"
import { ChipsInterpretation } from "./ChipsInterpretation"
import { ShareSaveBar } from "./ShareSaveBar"
import { HeroMatch } from "./blocks/HeroMatch"
import { EditorialBlock, GridBlock, RailBlock, toRedesignCard } from "./blocks/BoardSections"
import { BlogBlock, NewsBlock, UpcomingBlock } from "./blocks/EditorialSources"

const TYPE_NOUN: Record<NlIntent["mediaType"], string> = {
  MOVIE: "Films",
  TV: "Séries",
  GAME: "Jeux",
}

/** Below this score a title is a poor fit for the selected child, not a ranking. */
const MEMBER_FIT_FLOOR = 50

/**
 * Headline restating the request. Built from the interpretation's own labels
 * when it produced them, else from the structured filters — so the sentence is
 * always a description of the FILTERS ACTUALLY APPLIED, never a claim about the
 * results ("les meilleurs films pour…") that the catalogue might not support.
 */
function buildHeadline(intent: NlIntent): string {
  if (intent.libelles.length > 0) return intent.libelles.join(" · ")

  const parts: string[] = []
  parts.push(intent.themes.length > 0 ? `${TYPE_NOUN[intent.mediaType]} · ${intent.themes.join(", ")}` : TYPE_NOUN[intent.mediaType])
  if (intent.maxAge !== null) parts.push(`jusqu'à ${intent.maxAge} ans`)
  for (const key of intent.eviter) {
    const label = AVOID_RULES[key]?.label
    if (label) parts.push(label)
  }
  if (intent.platforms.length > 0) parts.push(intent.platforms.join(", "))
  return parts.join(" · ")
}

function SearchBar({
  initial,
  isPending,
  onSearch,
}: {
  initial: string
  isPending: boolean
  onSearch: (term: string) => void
}) {
  const [value, setValue] = useState(initial)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const term = value.trim()
        if (term) onSearch(term)
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
    >
      <label
        className="flex w-full min-w-0 items-center gap-2.5 rounded-full px-[18px] py-[13px] sm:flex-1"
        style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}
      >
        <Search className="h-[17px] w-[17px] shrink-0" style={{ color: "var(--ink-3)" }} />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Décrivez ce que vous cherchez…"
          aria-label="Décrivez ce que vous cherchez"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          style={{ color: "var(--ink)" }}
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 py-[13px] text-center text-[14.5px] font-bold text-white transition-opacity disabled:opacity-70 sm:w-auto"
        style={{ background: "var(--terra)" }}
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {isPending ? "Je vous compose ça…" : "Chercher"}
      </button>
    </form>
  )
}

/**
 * "Pour qui ?" — switching child re-sorts the SAME board client-side from the
 * per-member scores already attached to each card. No request, no new
 * interpretation: asking "and for my other son?" is instant and free.
 */
function MemberFilter({
  members,
  selectedId,
  onSelect,
}: {
  members: { id: string; name: string }[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  if (members.length < 2) return null
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <span className="text-[13px] font-semibold" style={{ color: "var(--ink-3)" }}>
        Classer pour&nbsp;:
      </span>
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={selectedId === null}
        className="rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors"
        style={{
          background: selectedId === null ? "var(--pine)" : "var(--paper-2)",
          color: selectedId === null ? "#fff" : "var(--ink)",
          border: `1.5px solid ${selectedId === null ? "var(--pine)" : "var(--line)"}`,
        }}
      >
        Toute la famille
      </button>
      {members.map((m, idx) => {
        const on = selectedId === m.id
        const color = memberColor(idx)
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(on ? null : m.id)}
            aria-pressed={on}
            className="inline-flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-[13px] font-semibold transition-colors"
            style={{
              background: on ? `${color}1A` : "var(--paper-2)",
              border: `1.5px solid ${on ? color : "var(--line)"}`,
              color: "var(--ink)",
            }}
          >
            <MemberMonogram name={m.name} color={color} size={22} />
            <span className="whitespace-nowrap">{m.name}</span>
          </button>
        )
      })}
    </div>
  )
}

function Suggestions() {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {NL_SEARCH_SUGGESTIONS.map((s) => (
        <Link
          key={s}
          href={`/decouverte?q=${encodeURIComponent(s)}`}
          className="rounded-full px-4 py-2 text-[13.5px] font-semibold transition-opacity hover:opacity-75"
          style={{ background: "var(--paper-2)", border: "1px solid var(--line)", color: "var(--ink)" }}
        >
          {s}
        </Link>
      ))}
    </div>
  )
}

export function DecouverteView({
  query,
  intent,
  board,
  degraded,
  isLoggedIn,
  isIdle,
  showCareBanner = false,
  slots,
}: {
  query: string
  intent: NlIntent
  board: ResolvedBoard
  degraded: boolean
  isLoggedIn: boolean
  /** True when the visitor has not asked anything yet — a bare /decouverte. */
  isIdle: boolean
  /** Self-harm expressions in the query: show the helplines with the results. */
  showCareBanner?: boolean
  /** Streamed sections, keyed by their position in the plan. */
  slots?: Record<number, ReactNode>
}) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const router = useRouter()
  // The transition owns the pending flag. An ad-hoc boolean cannot work here:
  // this component survives the same-route navigation, so anything we latch on
  // submit stays latched — which left the whole board dimmed permanently.
  const [isNavigating, startNavigation] = useTransition()

  // Without a transition the navigation is invisible: React keeps the rendered
  // board while the new payload streams and the route-level Suspense fallback
  // never re-appears, so the page just sits there for the length of the call.
  const search = (term: string) => {
    startNavigation(() => router.push(`/decouverte?q=${encodeURIComponent(term)}`))
  }

  // Re-rank in place for the selected child: their own score decides the order,
  // and anything the engine flagged as a poor fit for them drops out. Pure
  // client-side arithmetic over data already on the page.
  const rank = useMemo(() => {
    return (items: AssembledCard[]): AssembledCard[] => {
      if (!selectedMemberId) return items
      return items
        .map((item) => ({ item, score: item.memberScores?.find((s) => s.memberId === selectedMemberId)?.score }))
        .filter((entry) => entry.score === undefined || entry.score >= MEMBER_FIT_FLOOR)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .map((entry) => entry.item)
    }
  }, [selectedMemberId])

  const stripes = useMemo(() => computeStripes(board.blocks), [board.blocks])

  const selectedMemberName = board.members.find((m) => m.id === selectedMemberId)?.name ?? null
  const headline = buildHeadline(intent)
  const isSearchable = intent.mode !== "hors_sujet" && !isIdle
  const hasBoard = board.blocks.length > 0 && board.mainCount > 0

  return (
    <FamilyFitProvider>
      {/* data-home="v2" is REQUIRED: every --paper/--ink/--terra token and the
          .v2-row grid classes are declared only inside that selector. Without it
          the page renders with no palette at all. */}
      <div
        data-home="v2"
        className={`${v2FontVars} min-h-screen`}
        style={{ background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-hanken), system-ui, sans-serif" }}
      >
        <div className="mx-auto max-w-[1240px] px-5 pt-12 pb-4 sm:px-7">
          <Link href="/" className="text-[13.5px] font-bold" style={{ color: "var(--terra)" }}>
            ← Retour à l&apos;accueil
          </Link>

          <div className="mt-5 flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: "var(--pine-2)" }} />
            <span className="text-[12.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--terra)" }}>
              Recherche magique
            </span>
          </div>

          <h1
            className="mt-3 max-w-[24ch] text-[clamp(28px,4vw,46px)] font-bold leading-[1.06]"
            style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em", color: "var(--ink)" }}
          >
            {isIdle ? (
              <>Que cherchez-<Em tone="terra">vous</Em>&nbsp;?</>
            ) : intent.mode === "hors_sujet" ? (
              <>Nous n&apos;avons pas <Em tone="terra">compris</Em> cette recherche</>
            ) : headline ? (
              headline
            ) : query ? (
              <>Résultats pour <Em tone="terra">« {query} »</Em></>
            ) : (
              <>Que cherchez-<Em tone="terra">vous</Em>&nbsp;?</>
            )}
          </h1>

          {isIdle ? (
            <p className="mt-3 max-w-[60ch] text-[15px]" style={{ color: "var(--ink-2)" }}>
              Décrivez ce que vous cherchez pour votre famille&nbsp;: un âge, une envie, ce que
              vous préférez éviter. Totem Avisé compose la sélection.
            </p>
          ) : query && intent.mode !== "hors_sujet" ? (
            <p className="mt-3 max-w-[60ch] text-[15px]" style={{ color: "var(--ink-2)" }}>
              Votre demande&nbsp;: « {query} »
            </p>
          ) : null}

          <div className="mt-6 max-w-[720px]">
            <SearchBar initial={query} isPending={isNavigating} onSearch={search} />
          </div>

          {showCareBanner && (
            <div
              className="mt-5 max-w-[640px] rounded-[14px] px-5 py-4"
              style={{ background: "var(--pine)", color: "#FBF5EA" }}
              role="note"
            >
              <p className="text-[14.5px] font-bold">{CARE_BANNER.title}</p>
              <p className="mt-1 text-[13.5px]" style={{ color: "rgba(251,245,234,.88)" }}>
                {CARE_BANNER.body}
              </p>
            </div>
          )}

          {degraded && (
            <p
              className="mt-4 inline-block rounded-[10px] px-3.5 py-2 text-[13px]"
              style={{ background: "var(--paper-2)", border: "1px solid var(--line)", color: "var(--ink-2)" }}
            >
              Interprétation momentanément indisponible — voici les résultats par mots-clés.
            </p>
          )}

          {isSearchable && <ChipsInterpretation intent={intent} query={query} />}

          {board.personalized && (
            <MemberFilter members={board.members} selectedId={selectedMemberId} onSelect={setSelectedMemberId} />
          )}

          {/* Sign-up nudge — shown only where it is TRUE that an account adds
              something: results exist but carry no per-child scoring. */}
          {!board.personalized && hasBoard && (
            <p className="mt-5 text-[13.5px]" style={{ color: "var(--ink-2)" }}>
              {isLoggedIn ? (
                <>
                  <Link href="/profil" className="font-bold underline" style={{ color: "var(--terra)" }}>
                    Ajoutez vos enfants
                  </Link>{" "}
                  pour un score personnalisé selon les sensibilités de chacun.
                </>
              ) : (
                <>
                  <Link href="/inscription" className="font-bold underline" style={{ color: "var(--terra)" }}>
                    Créez un compte famille (gratuit)
                  </Link>{" "}
                  pour un score personnalisé selon les sensibilités de chaque enfant.
                </>
              )}
            </p>
          )}

          {hasBoard && <ShareSaveBar query={query} isLoggedIn={isLoggedIn} />}

          {isIdle ? (
            <div className="mt-8 pb-12">
              <p className="text-[13px] font-semibold" style={{ color: "var(--ink-3)" }}>
                Idées rapides&nbsp;:
              </p>
              <Suggestions />
            </div>
          ) : intent.mode === "hors_sujet" ? (
            <div className="mt-10 pb-12">
              <p className="text-[15px]" style={{ color: "var(--ink-2)" }}>
                Décrivez plutôt ce que vous cherchez pour votre famille — un âge, une envie, ce
                que vous préférez éviter.
              </p>
              <Suggestions />
            </div>
          ) : !hasBoard ? (
            <div className="mt-10 pb-12">
              <p className="text-[15px]" style={{ color: "var(--ink-2)" }}>
                Aucun titre ne correspond à ces critères. Essayez d&apos;élargir l&apos;âge ou de
                retirer un filtre.
              </p>
              <Suggestions />
            </div>
          ) : null}
        </div>

        {hasBoard && intent.mode !== "hors_sujet" && !isIdle && (
          <div style={{ opacity: isNavigating ? 0.55 : 1, transition: "opacity 150ms ease" }}>
              {board.blocks.map((block, index) => {
                const key = `${block.key}-${index}`
                const reveal = {
                  className: "board-block-reveal",
                  style: { animationDelay: `${Math.min(index, 6) * 90}ms` },
                } as const
                if (block.kind === "hero") {
                  return <div key={key} {...reveal}><HeroMatch meta={block.meta} hero={block.hero} /></div>
                }
                if (block.kind === "deferred") {
                  return <div key={key} {...reveal}>{slots?.[block.index] ?? null}</div>
                }
                if (block.kind === "editorial") {
                  return <div key={key} {...reveal}><EditorialBlock variant={block.key} meta={block.meta} /></div>
                }
                if (block.kind === "upcoming") {
                  return <div key={key} {...reveal}><UpcomingBlock meta={block.meta} items={block.items} alt={stripes[index]} /></div>
                }
                if (block.kind === "news") {
                  return <div key={key} {...reveal}><NewsBlock meta={block.meta} items={block.items} alt={stripes[index]} /></div>
                }
                if (block.kind === "blog") {
                  return <div key={key} {...reveal}><BlogBlock meta={block.meta} items={block.items} alt={stripes[index]} /></div>
                }

                const ranked = rank(block.items)
                if (ranked.length === 0) return null

                if (block.kind === "grid") {
                  return (
                    <div key={key} {...reveal}>
                      <GridBlock
                        meta={block.meta}
                        items={ranked.map(toRedesignCard)}
                        alt={stripes[index]}
                        sectionImage={block.sectionImage}
                      />
                    </div>
                  )
                }
                return (
                  <div key={key} {...reveal}>
                    <RailBlock
                      blockKey={block.key}
                      meta={block.meta}
                      items={ranked.map(toRedesignCard)}
                      alt={stripes[index]}
                      sectionImage={block.sectionImage}
                    />
                  </div>
                )
              })}

              <div className="mx-auto max-w-[1240px] px-5 pb-10 sm:px-7">
                {selectedMemberName && (
                  <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
                    Classé selon le profil de {selectedMemberName}.
                  </p>
                )}
                <p className="mt-2 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
                  Page assemblée automatiquement d&apos;après votre demande. Les âges conseillés et
                  les analyses proviennent de la base Totem Avisé&nbsp;: ils ne sont jamais générés
                  à la volée.
                </p>
              </div>
          </div>
        )}
      </div>
    </FamilyFitProvider>
  )
}
