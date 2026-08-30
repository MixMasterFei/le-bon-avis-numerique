"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { Search, Sparkles } from "lucide-react"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { RedesignCard, type RedesignCardMedia } from "@/components/home-redesign/RedesignCard"
import { MemberMonogram } from "@/components/home-redesign/MemberMonogram"
import { memberColor } from "@/components/home-redesign/family"
import { v2FontVars } from "@/components/home-redesign/fonts"
import { Em } from "@/components/home-redesign/parts"
import { NL_SEARCH_SUGGESTIONS } from "@/lib/nl-search/suggestions"
import { AVOID_RULES } from "@/lib/nl-search/vocab"
import type { AssembledCard, AssembledResults } from "@/lib/nl-search/assemble"
import type { NlIntent } from "@/lib/nl-search/types"
import { ChipsInterpretation } from "./ChipsInterpretation"

const TYPE_NOUN: Record<NlIntent["mediaType"], string> = {
  MOVIE: "Films",
  TV: "Séries",
  GAME: "Jeux",
}

function toCard(card: AssembledCard): RedesignCardMedia {
  return {
    id: card.id,
    type: card.type,
    title: card.title,
    posterUrl: card.posterUrl,
    expertAgeRec: card.expertAgeRec,
    genres: card.genres,
    contentMetrics: card.contentMetrics as RedesignCardMedia["contentMetrics"],
  }
}

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

function SearchBar({ initial }: { initial: string }) {
  const router = useRouter()
  const [value, setValue] = useState(initial)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const term = value.trim()
        if (term) router.push(`/decouverte?q=${encodeURIComponent(term)}`)
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
        className="w-full shrink-0 whitespace-nowrap rounded-full px-5 py-[13px] text-center text-[14.5px] font-bold text-white sm:w-auto"
        style={{ background: "var(--terra)" }}
      >
        Chercher
      </button>
    </form>
  )
}

/**
 * "Pour qui ?" — switching child re-sorts the SAME results client-side from the
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

function CardGrid({ items }: { items: RedesignCardMedia[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map((m) => (
        <RedesignCard key={m.id} media={m} totem="compact" showType />
      ))}
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
  results,
  degraded,
  isLoggedIn,
}: {
  query: string
  intent: NlIntent
  results: AssembledResults
  degraded: boolean
  isLoggedIn: boolean
}) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  // Re-rank in place for the selected child: their own score decides the order,
  // and anything the engine flagged as a poor fit for them drops out. Pure
  // client-side arithmetic over data already on the page.
  const orderedItems = useMemo(() => {
    if (!selectedMemberId) return results.items
    return results.items
      .map((item) => ({ item, score: item.memberScores?.find((s) => s.memberId === selectedMemberId)?.score }))
      .filter((entry) => entry.score === undefined || entry.score >= 50)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .map((entry) => entry.item)
  }, [results.items, selectedMemberId])

  const selectedMemberName = results.members.find((m) => m.id === selectedMemberId)?.name ?? null
  const headline = buildHeadline(intent)
  const isSearchable = intent.mode !== "hors_sujet"

  return (
    <FamilyFitProvider>
      <div
        className={`${v2FontVars} min-h-screen`}
        style={{ background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-hanken), system-ui, sans-serif" }}
      >
        <div className="mx-auto max-w-[1240px] px-5 py-12 sm:px-7">
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
            {intent.mode === "hors_sujet" ? (
              <>Nous n&apos;avons pas <Em tone="terra">compris</Em> cette recherche</>
            ) : headline ? (
              headline
            ) : query ? (
              <>Résultats pour <Em tone="terra">« {query} »</Em></>
            ) : (
              <>Que cherchez-<Em tone="terra">vous</Em>&nbsp;?</>
            )}
          </h1>

          {query && intent.mode !== "hors_sujet" && (
            <p className="mt-3 max-w-[60ch] text-[15px]" style={{ color: "var(--ink-2)" }}>
              Votre demande&nbsp;: « {query} »
            </p>
          )}

          <div className="mt-6 max-w-[720px]">
            <SearchBar initial={query} />
          </div>

          {degraded && (
            <p
              className="mt-4 inline-block rounded-[10px] px-3.5 py-2 text-[13px]"
              style={{ background: "var(--paper-2)", border: "1px solid var(--line)", color: "var(--ink-2)" }}
            >
              Interprétation momentanément indisponible — voici les résultats par mots-clés.
            </p>
          )}

          {isSearchable && <ChipsInterpretation intent={intent} query={query} />}

          {results.personalized && (
            <MemberFilter
              members={results.members}
              selectedId={selectedMemberId}
              onSelect={setSelectedMemberId}
            />
          )}

          {/* Sign-up nudge — shown only where it is TRUE that an account adds
              something: results exist but carry no per-child scoring. */}
          {!results.personalized && orderedItems.length > 0 && (
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

          <div className="mt-10">
            {intent.mode === "hors_sujet" ? (
              <div>
                <p className="text-[15px]" style={{ color: "var(--ink-2)" }}>
                  Décrivez plutôt ce que vous cherchez pour votre famille — un âge, une envie, ce
                  que vous préférez éviter.
                </p>
                <Suggestions />
              </div>
            ) : orderedItems.length === 0 ? (
              <div>
                <p className="text-[15px]" style={{ color: "var(--ink-2)" }}>
                  {selectedMemberName
                    ? `Aucun titre de cette sélection ne convient à ${selectedMemberName}. Essayez « Toute la famille » ou élargissez les critères.`
                    : "Aucun titre ne correspond à ces critères. Essayez d'élargir l'âge ou de retirer un filtre."}
                </p>
                {!selectedMemberName && <Suggestions />}
              </div>
            ) : (
              <>
                <CardGrid items={orderedItems.map(toCard)} />
                {selectedMemberName && (
                  <p className="mt-4 text-[13px]" style={{ color: "var(--ink-3)" }}>
                    Classé selon le profil de {selectedMemberName}.
                  </p>
                )}
              </>
            )}
          </div>

          {results.secondary && results.secondary.items.length > 0 && (
            <div className="mt-14 border-t pt-10" style={{ borderColor: "var(--line)" }}>
              <h2
                className="text-[clamp(20px,2.4vw,28px)] font-bold"
                style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em", color: "var(--ink)" }}
              >
                {results.secondary.title}
              </h2>
              <div className="mt-6">
                <CardGrid items={results.secondary.items.map(toCard)} />
              </div>
            </div>
          )}
        </div>
      </div>
    </FamilyFitProvider>
  )
}
