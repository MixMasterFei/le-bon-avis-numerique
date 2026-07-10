"use client"

import { useEffect, useMemo, useState } from "react"
import { RefreshCw, Users } from "lucide-react"
import { RedesignCard, type RedesignCardMedia } from "./RedesignCard"
import { CoinFamilleHeroPick } from "./CoinFamilleHeroPick"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { APERCU_PALETTE, genreLabelFr } from "@/components/home-v2/apercuTheme"
import { totemVoiceLine } from "@/lib/totem-voice"
import type { HomepageState } from "@/lib/homepage-time-context"

interface RawItem {
  id: string
  type?: string
  title: string
  posterUrl: string | null
  expertAgeRec?: number | null
  genres?: string[] | null
  cornerLabel?: string | null
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
}

function toCardType(t: unknown): RedesignCardMedia["type"] {
  return t === "MOVIE" || t === "TV" || t === "GAME" ? t : "MOVIE"
}

function toCards(items: RawItem[]): RedesignCardMedia[] {
  return items.map((item) => ({
    id: item.id,
    type: toCardType(item.type),
    title: item.title,
    posterUrl: item.posterUrl,
    expertAgeRec: item.expertAgeRec ?? null,
    genres: item.genres ?? [],
    contentMetrics: null,
    cornerLabel: item.cornerLabel ?? null,
  }))
}

function visibleWindow(items: RedesignCardMedia[], offset: number, count = 4): RedesignCardMedia[] {
  if (items.length <= count) return items
  return Array.from({ length: count }, (_, index) => items[(offset + 1 + index) % items.length])
}

/**
 * The personalized heart of Le Coin Famille: one network request, one focused
 * rail, then family/member tabs. The server returns twelve daily-rotated picks
 * per audience; "D'autres idées" changes the window without another DB pass.
 */
export function CoinFamillePicksRail({ serifClass }: { serifClass: string }) {
  const p = APERCU_PALETTE
  const [response, setResponse] = useState<PicksResponse | null>(null)
  const [activeTab, setActiveTab] = useState("family")
  const [offset, setOffset] = useState(0)
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

  const familyCards = useMemo(
    () => toCards(response?.familyItems ?? []),
    [response?.familyItems],
  )
  const memberTabs = useMemo(
    () =>
      (response?.memberSections ?? []).map((section) => ({
        ...section,
        cards: toCards(section.items),
      })),
    [response?.memberSections],
  )
  const activeMember = memberTabs.find((member) => member.id === activeTab)
  const activeItems = activeMember?.cards ?? familyCards
  const hero = activeItems.length > 0 ? activeItems[offset % activeItems.length] : null
  const shown = visibleWindow(activeItems, offset)

  const changeTab = (id: string) => {
    setActiveTab(id)
    setOffset(0)
  }

  const rotate = () => {
    // Advance past the hero + the 4 visible cards so "D'autres idées" swaps the
    // WHOLE selection — a +1 shift kept 3 of 4 cards identical, which read as
    // a broken button in the audit.
    setOffset((current) => (activeItems.length ? (current + 5) % activeItems.length : 0))
  }

  return (
    <section
      className="overflow-hidden rounded-3xl p-4 sm:p-6"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      {/* Distinct from the page H1 (which already carries the time-aware
          "Pour les vacances en famille" heading) — repeating it here read as
          a copy/paste bug in the Playwright audit. */}
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
            : "Un coup de cœur et une courte sélection, adaptés aux âges et aux goûts de chacun."}
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
        {memberTabs.map((member) => (
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

      {!loading && hero && (
        <CoinFamilleHeroPick
          media={hero}
          serifClass={serifClass}
          badge={activeMember ? `Notre coup de cœur pour ${activeMember.name}` : "Notre coup de cœur du jour"}
          voiceLine={totemVoiceLine({
            memberName: activeMember?.name,
            title: hero.title,
            genres: (hero.genres ?? []).map(genreLabelFr),
          })}
        />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-[14px]" style={{ background: p.placeholder }} />
            ))
          : shown.map((media) => (
              // cornerLabel stripped: the fit-reason ribbon truncated ("Bon
              // choix pour tout le foy…") and hid the artwork on small cards —
              // the hero shows the reason as text instead. Default meter
              // variant = the V2 per-member fit display (not the old hearts).
              <RedesignCard key={`${activeTab}-${media.id}`} media={{ ...media, cornerLabel: null }} totem="compact" showType />
            ))}
      </div>

      {!loading && shown.length === 0 && !hero && (
        <div className="mt-4 rounded-2xl px-4 py-5 text-center" style={{ background: p.bg2, color: p.ink2 }}>
          <p className="text-sm font-semibold" style={{ color: p.ink }}>
            On affine encore cette sélection
          </p>
          <p className="mt-1 text-xs">
            Ajoutez quelques goûts ou réactions au profil pour débloquer davantage d’idées adaptées.
          </p>
        </div>
      )}

      {!loading && activeItems.length > 1 && (
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
    </section>
  )
}
