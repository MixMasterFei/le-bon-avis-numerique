"use client"

import { useMemo, useState } from "react"
import { Minus, Plus } from "lucide-react"
import { SafeImage } from "@/components/ui/SafeImage"
import { tmdbPosterAtSize } from "@/lib/tmdb-image"
import { Em } from "@/components/home-redesign/parts"
import type { BallotTally } from "@/lib/nl-search/board-votes"

export interface BallotItem {
  id: string
  title: string
  posterUrl: string | null
  expertAgeRec: number | null
}

interface BallotResponse {
  tallies: BallotTally[]
  myVotes: Record<string, number>
  myName: string | null
  voterCount: number
  error?: string
}

/**
 * The ballot: the shared board's last section, where the household and its
 * guests settle the question. Every voter spends up to `budget` badges across
 * the titles; the tally is live and the leader is crowned. No account needed —
 * a first name is the identity guests actually have in a family group chat.
 */
export function BoardBallot({
  boardId,
  items,
  budget,
  initialTallies,
  initialMyVotes,
  initialMyName,
  initialVoterCount,
}: {
  boardId: string
  items: BallotItem[]
  budget: number
  initialTallies: BallotTally[]
  initialMyVotes: Record<string, number>
  initialMyName: string | null
  initialVoterCount: number
}) {
  const [tallies, setTallies] = useState<BallotTally[]>(initialTallies)
  const [myVotes, setMyVotes] = useState<Record<string, number>>(initialMyVotes)
  const [name, setName] = useState(initialMyName ?? "")
  const [nameConfirmed, setNameConfirmed] = useState(!!initialMyName)
  const [voterCount, setVoterCount] = useState(initialVoterCount)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const spent = useMemo(() => Object.values(myVotes).reduce((sum, n) => sum + n, 0), [myVotes])
  const remaining = Math.max(0, budget - spent)
  const tallyOf = useMemo(() => new Map(tallies.map((t) => [t.mediaId, t])), [tallies])
  const leaderId = tallies.length > 0 && tallies[0].badges > 0 ? tallies[0].mediaId : null
  const leaderTitle = leaderId ? items.find((i) => i.id === leaderId)?.title ?? null : null

  async function vote(mediaId: string, delta: 1 | -1) {
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setError("Indiquez un prénom (2 lettres minimum) pour voter.")
      return
    }
    setBusyId(mediaId)
    setError(null)
    try {
      const response = await fetch("/api/decouverte/board/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId, mediaId, delta, name: trimmed }),
      })
      const data = (await response.json()) as BallotResponse
      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "Vote impossible.")
        return
      }
      setTallies(data.tallies)
      setMyVotes(data.myVotes)
      setVoterCount(data.voterCount)
      if (data.myName) setNameConfirmed(true)
    } catch {
      setError("Vote impossible pour le moment.")
    } finally {
      setBusyId(null)
    }
  }

  // The ballot lists the board's titles, but ranks the voted ones first so the
  // race stays visible without scrolling.
  const ordered = useMemo(() => {
    return [...items].sort((a, b) => (tallyOf.get(b.id)?.badges ?? 0) - (tallyOf.get(a.id)?.badges ?? 0))
  }, [items, tallyOf])

  return (
    <section
      className="mt-16 rounded-[22px] p-7 sm:p-10"
      style={{ background: "var(--card)", border: "1px solid var(--line)", boxShadow: "0 18px 40px -28px rgba(40,28,12,.55)" }}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--terra)" }} />
          <span className="text-[12.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--terra)" }}>
            Le vote
          </span>
        </div>
        <h2
          className="text-[clamp(24px,3.2vw,36px)] font-bold leading-[1.06]"
          style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em", color: "var(--ink)" }}
        >
          Alors, on regarde <Em tone="terra">quoi</Em>&nbsp;?
        </h2>
        <p className="max-w-[58ch] text-[14.5px]" style={{ color: "var(--ink-2)" }}>
          Chacun place jusqu&apos;à {budget} badges sur ses envies, tous sur un titre ou répartis.
          {voterCount > 0 && (
            <> {voterCount === 1 ? "1 personne a déjà voté." : `${voterCount} personnes ont déjà voté.`}</>
          )}
        </p>
      </div>

      {leaderTitle && (
        <div
          className="mt-5 inline-flex items-center gap-2.5 rounded-full px-4 py-2"
          style={{ background: "var(--pine)", color: "#FBF5EA" }}
        >
          <span className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--gold)" }}>
            En tête
          </span>
          <span className="text-[14.5px] font-bold">{leaderTitle}</span>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {!nameConfirmed && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Votre prénom pour voter"
            aria-label="Votre prénom pour voter"
            maxLength={24}
            className="min-w-0 rounded-full px-4 py-2 text-[13.5px] outline-none sm:w-[240px]"
            style={{ background: "var(--paper-2)", border: "1px solid var(--line)", color: "var(--ink)" }}
          />
        )}
        {nameConfirmed && (
          <span className="text-[13.5px] font-semibold" style={{ color: "var(--ink-2)" }}>
            Vous votez comme «&nbsp;{name}&nbsp;»
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold" style={{ color: "var(--ink-2)" }}>
          {Array.from({ length: budget }).map((_, i) => (
            <span
              key={i}
              className="inline-block h-3 w-3 rounded-full"
              style={{
                background: i < remaining ? "var(--terra)" : "var(--line)",
                transition: "background 150ms ease",
              }}
            />
          ))}
          {remaining > 0
            ? `${remaining} badge${remaining > 1 ? "s" : ""} à placer`
            : "Tous vos badges sont placés"}
        </span>
      </div>

      {error && (
        <p className="mt-3 text-[13px] font-semibold" style={{ color: "var(--terra)" }}>
          {error}
        </p>
      )}

      <ul className="mt-6 grid gap-x-10 gap-y-1 lg:grid-cols-2">
        {ordered.map((item) => {
          const tally = tallyOf.get(item.id)
          const mine = myVotes[item.id] ?? 0
          const isLeader = item.id === leaderId
          return (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-[12px] px-2 py-2"
              style={isLeader ? { background: "var(--pine-soft)" } : undefined}
            >
              <div
                className="relative aspect-[2/3] w-[38px] shrink-0 overflow-hidden rounded-[7px]"
                style={{ background: "var(--placeholder, #E6DFCE)", border: "1px solid var(--line)" }}
              >
                {item.posterUrl && (
                  <SafeImage
                    src={tmdbPosterAtSize(item.posterUrl, "w342")}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-cover"
                    fallbackClassName="h-full w-full"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold" style={{ fontFamily: "var(--font-bricolage)", color: "var(--ink)" }}>
                  {item.title}
                </p>
                <p className="truncate text-[12px]" style={{ color: "var(--ink-3)" }}>
                  {item.expertAgeRec !== null ? `Dès ${item.expertAgeRec} ans` : "Âge à confirmer"}
                  {tally && tally.voters.length > 0 ? ` · ${tally.voters.slice(0, 4).join(", ")}${tally.voters.length > 4 ? "…" : ""}` : ""}
                </p>
              </div>
              <span
                className="w-[2ch] text-right text-[18px] font-bold tabular-nums"
                style={{ fontFamily: "var(--font-bricolage)", color: tally?.badges ? "var(--pine)" : "var(--ink-3)" }}
              >
                {tally?.badges ?? 0}
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => vote(item.id, -1)}
                  disabled={busyId === item.id || mine === 0}
                  aria-label={`Retirer un badge de ${item.title}`}
                  className="grid h-8 w-8 place-items-center rounded-full transition-opacity hover:opacity-75 disabled:opacity-30"
                  style={{ background: "var(--paper-2)", border: "1px solid var(--line)", color: "var(--ink)" }}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => vote(item.id, 1)}
                  disabled={busyId === item.id || remaining === 0 || mine >= 3}
                  aria-label={`Ajouter un badge sur ${item.title}`}
                  className="grid h-8 w-8 place-items-center rounded-full transition-opacity hover:opacity-90 disabled:opacity-30"
                  style={{ background: mine > 0 ? "var(--terra)" : "var(--paper-2)", border: "1px solid var(--line)", color: mine > 0 ? "#fff" : "var(--ink)" }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
