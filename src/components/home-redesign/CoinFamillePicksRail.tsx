"use client"

import { useEffect, useMemo, useState } from "react"
import { RefreshCw, Users } from "lucide-react"
import { type RedesignCardMedia } from "./RedesignCard"
import { CoinFamilleHeroPick } from "./CoinFamilleHeroPick"
import { CoinFamilleClassicCard } from "./CoinFamilleClassicCard"
import { CoinFamillePickCard, type PickMedia } from "./CoinFamillePickCard"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { totemVoiceLine, type FitReason } from "@/lib/totem-voice"
import type { HomepageState } from "@/lib/homepage-time-context"

interface RawItem {
  id: string
  type?: string
  title: string
  posterUrl: string | null
  expertAgeRec?: number | null
  genres?: string[] | null
  // Truthful fit reason from the API; phrased into a sentence for the cards.
  reason?: FitReason
}

interface MemberSection {
  id: string
  name: string
  avatarEmoji?: string | null
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  items: RawItem[]
}

interface PicksResponse {
  state: HomepageState
  day: string
  subtitle: string
  familyItems: RawItem[]
  memberSections: MemberSection[]
  classic?: RawItem | null
}

const GRID_COUNT = 10

function toCardType(t: unknown): RedesignCardMedia["type"] {
  return t === "MOVIE" || t === "TV" || t === "GAME" ? t : "MOVIE"
}

function toHeroCard(item: RawItem): RedesignCardMedia {
  return {
    id: item.id,
    type: toCardType(item.type),
    title: item.title,
    posterUrl: item.posterUrl,
    expertAgeRec: item.expertAgeRec ?? null,
    genres: item.genres ?? [],
    contentMetrics: null,
    cornerLabel: null,
  }
}

function toPickMedia(item: RawItem): PickMedia {
  return {
    id: item.id,
    type: toCardType(item.type),
    title: item.title,
    posterUrl: item.posterUrl,
    expertAgeRec: item.expertAgeRec ?? null,
  }
}

/** The grid, always excluding the hero (shown at index `offset`), up to `count`. */
function gridWindow(items: RawItem[], offset: number, count: number): RawItem[] {
  if (items.length <= 1) return []
  const heroIdx = offset % items.length
  const rest = [...items.slice(heroIdx + 1), ...items.slice(0, heroIdx)]
  return rest.slice(0, count)
}

/**
 * The personalized heart of Le Coin Famille: one network request, family/member
 * tabs, a spotlight + a dense grid of picks. Each card carries an expandable
 * Totem note and quick actions (favori / à voir / déjà vu). "Déjà vu" drops the
 * title from the view (and records it as watched on a member tab), so the grid
 * keeps refreshing; "D'autres idées" swaps the whole window.
 */
export function CoinFamillePicksRail({ serifClass }: { serifClass: string }) {
  const p = APERCU_PALETTE
  const [response, setResponse] = useState<PicksResponse | null>(null)
  const [activeTab, setActiveTab] = useState("family")
  const [offset, setOffset] = useState(0)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/coin-famille/tonight")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        setResponse(data && Array.isArray(data.familyItems) ? data : null)
      })
      .catch(() => {
        if (!cancelled) setResponse(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const memberSections = response?.memberSections ?? []
  const activeMember = memberSections.find((member) => member.id === activeTab) ?? null

  const activeRaw = useMemo<RawItem[]>(() => {
    if (activeTab === "family") return response?.familyItems ?? []
    return response?.memberSections.find((section) => section.id === activeTab)?.items ?? []
  }, [activeTab, response])

  // "Déjà vu" hides a title everywhere in this session (keyed by media id).
  const availableRaw = useMemo(
    () => activeRaw.filter((item) => !dismissed.has(item.id)),
    [activeRaw, dismissed],
  )

  const heroRaw = availableRaw.length > 0 ? availableRaw[offset % availableRaw.length] : null
  const heroCard = heroRaw ? toHeroCard(heroRaw) : null
  const heroReason = heroRaw?.reason
  const gridItems = gridWindow(availableRaw, offset, GRID_COUNT)

  // "Le classique à redécouvrir" — one family-level pick, constant across tabs.
  const classicRaw = response?.classic ?? null
  const classicCard = useMemo(() => (classicRaw ? toHeroCard(classicRaw) : null), [classicRaw])
  const classicReason = classicRaw?.reason ? totemVoiceLine(classicRaw.reason) : undefined

  const changeTab = (id: string) => {
    setActiveTab(id)
    setOffset(0)
  }

  const handleSeen = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  const rotate = () => {
    // Advance past the hero + the whole grid so "D'autres idées" swaps the full
    // selection rather than shuffling one card.
    setOffset((current) => (availableRaw.length ? (current + GRID_COUNT + 1) % availableRaw.length : 0))
  }

  return (
    <section
      className="overflow-hidden rounded-3xl p-4 sm:p-6"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div className="min-w-0">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: p.accent }}>
          {activeMember ? "Rien que pour" : "Choisi pour votre foyer"}
        </div>
        <h2
          className={`${serifClass} m-0 text-2xl font-medium leading-[1.05] md:text-3xl`}
          style={{ color: p.ink, letterSpacing: "-0.025em" }}
        >
          {activeMember ? (
            <>
              La sélection de{" "}
              <em className="italic" style={{ color: p.accent }}>
                {activeMember.name}
              </em>
            </>
          ) : (
            <>
              Les bonnes idées{" "}
              <em className="italic" style={{ color: p.accent }}>
                du jour
              </em>
            </>
          )}
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed" style={{ color: p.ink2 }}>
          {activeMember
            ? `Des idées choisies selon l’âge, les goûts et les sensibilités de ${activeMember.name}.`
            : "Un coup de cœur et une sélection, adaptés aux âges et aux goûts de chacun. Un cœur pour garder, « à voir » pour plus tard, « déjà vu » pour en proposer d’autres."}
        </p>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Sélection par membre">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "family"}
          onClick={() => changeTab("family")}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
          style={
            activeTab === "family"
              ? { background: p.ink, color: p.bg }
              : { background: p.bg2, color: p.ink2, border: `1px solid ${p.line}` }
          }
        >
          <Users className="h-3.5 w-3.5" />
          Toute la famille
        </button>
        {memberSections.map((member) => (
          <button
            key={member.id}
            type="button"
            role="tab"
            aria-selected={activeTab === member.id}
            onClick={() => changeTab(member.id)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs font-semibold transition-colors"
            style={
              activeTab === member.id
                ? { background: p.ink, color: p.bg }
                : { background: p.bg2, color: p.ink2, border: `1px solid ${p.line}` }
            }
          >
            <MemberAvatar
              avatarStyle={member.avatarStyle ?? null}
              avatarSeed={member.avatarSeed ?? null}
              avatarOptions={member.avatarOptions ?? null}
              avatarEmoji={member.avatarEmoji ?? null}
              name={member.name}
              size={22}
            />
            {member.name}
          </button>
        ))}
      </div>

      {!loading && heroCard && (
        <CoinFamilleHeroPick
          media={heroCard}
          serifClass={serifClass}
          badge={activeMember ? `Notre coup de cœur pour ${activeMember.name}` : "Notre coup de cœur du jour"}
          voiceLine={heroReason ? totemVoiceLine(heroReason) : undefined}
        />
      )}

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-5">
        {loading
          ? Array.from({ length: GRID_COUNT }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-xl" style={{ background: p.placeholder }} />
            ))
          : gridItems.map((item) => (
              <CoinFamillePickCard
                key={`${activeTab}-${item.id}`}
                media={toPickMedia(item)}
                comment={item.reason ? totemVoiceLine(item.reason) : undefined}
                memberId={activeMember?.id ?? null}
                onSeen={handleSeen}
              />
            ))}
      </div>

      {!loading && gridItems.length === 0 && !heroCard && (
        <div className="mt-4 rounded-2xl px-4 py-5 text-center" style={{ background: p.bg2, color: p.ink2 }}>
          <p className="text-sm font-semibold" style={{ color: p.ink }}>
            On affine encore cette sélection
          </p>
          <p className="mt-1 text-xs">
            Ajoutez quelques goûts ou réactions au profil pour débloquer davantage d’idées adaptées.
          </p>
        </div>
      )}

      {!loading && availableRaw.length > 1 && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={rotate}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
            style={{ color: p.ink, border: `1px solid ${p.line}` }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            D’autres idées
          </button>
        </div>
      )}

      {!loading && classicCard && (
        <div className="mt-5 border-t pt-4" style={{ borderColor: p.line }}>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: p.accent }}>
            Le classique à redécouvrir
          </div>
          <CoinFamilleClassicCard media={classicCard} reason={classicReason} serifClass={serifClass} />
        </div>
      )}
    </section>
  )
}
