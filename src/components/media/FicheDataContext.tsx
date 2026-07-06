"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { useSession } from "next-auth/react"
import type { TMDBWatchProviderResult, TMDBVideo } from "@/lib/tmdb"

// ── Family-fit shapes (shared with FamilyFitHero / dashboard bar / quick answer) ──
export interface AffinityInfo {
  hasConnection: boolean
  connectedMedia?: { title: string; reaction: string }
  affinityReason?: string
  genreAffinityScore?: number
}

export interface FamilyFitMember {
  id: string
  name: string
  avatarEmoji: string
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  age: number | null
  score: number
  level: "excellent" | "good" | "moderate" | "poor"
  reason: string
  hasPreferences?: boolean
  profileComplete?: boolean
  affinity?: AffinityInfo
}

export type FamilyFitResponse =
  | { status: "not_logged_in" }
  | { status: "no_family" }
  | { status: "ok"; members: FamilyFitMember[] }
  | { status: "family_warning"; members: FamilyFitMember[] }

export interface ExtrasData {
  watchProviders: TMDBWatchProviderResult | null
  trailer: TMDBVideo | null
  inTheaters: boolean
}

// ── Trigger-vote (community "Ce qui peut marquer" consensus) shapes ──
export interface CategoryConsensus {
  present: number
  absent: number
  total: number
  presentPercent: number | null
  userVote: boolean | null
}

export interface TriggerConsensusResponse {
  categories: Record<string, CategoryConsensus>
  threshold: { minVotes: number; minPercent: number }
}

interface FicheData {
  familyFit: FamilyFitResponse | null
  familyFitLoading: boolean
  extras: ExtrasData | null
  extrasLoading: boolean
  triggerVotes: TriggerConsensusResponse | null
  triggerVotesLoading: boolean
}

const FicheDataContext = createContext<FicheData | undefined>(undefined)

function wantsExtras(mediaId: string | null, mediaType: string): boolean {
  return !!mediaId && (mediaType === "MOVIE" || mediaType === "TV")
}

// Trigger votes only exist for DB-backed, non-game fiches (the warnings card is
// hidden on GAME and off-DB cinema fiches anyway).
function wantsTriggers(mediaId: string | null, mediaType: string): boolean {
  return !!mediaId && mediaType !== "GAME"
}

/**
 * Fiche-scoped provider that fetches family-fit + extras ONCE and shares
 * them with every consumer on the media page (hero family panel, the
 * collapsing dashboard bar, the family-aware quick answer, watch providers)
 * — replacing what used to be up to three family-fit fetches + two extras
 * fetches per page view.
 *
 * Optional by design: the consumer hooks below fall back to their own fetch
 * when no provider wraps them (e.g. the standalone /apercufilm layout), so
 * the components keep working outside this page with no changes.
 *
 * Loading flags start from the synchronous "is there anything to fetch?"
 * answer, and only ever flip to false inside the fetch's `.finally` — never
 * synchronously in an effect body (react-hooks/set-state-in-effect).
 */
export function FicheDataProvider({
  mediaId,
  mediaType,
  children,
}: {
  mediaId: string | null
  mediaType: string
  children: ReactNode
}) {
  const { status: authStatus } = useSession()
  const [familyFit, setFamilyFit] = useState<FamilyFitResponse | null>(null)
  const [familyFitLoading, setFamilyFitLoading] = useState(!!mediaId)
  const [extras, setExtras] = useState<ExtrasData | null>(null)
  const [extrasLoading, setExtrasLoading] = useState(wantsExtras(mediaId, mediaType))
  const [triggerVotes, setTriggerVotes] = useState<TriggerConsensusResponse | null>(null)
  const [triggerVotesLoading, setTriggerVotesLoading] = useState(wantsTriggers(mediaId, mediaType))

  // Family-fit is user-scoped, so skip the round-trip for logged-out visitors
  // (the API only ever returns {status:"not_logged_in"} for them). Only the
  // authenticated branch fetches; the anon/loading answers are DERIVED below
  // (deriving avoids setState-in-effect and the flash of "not_logged_in" at a
  // user whose session is still resolving).
  useEffect(() => {
    if (!mediaId || authStatus !== "authenticated") return
    let cancelled = false
    fetch(`/api/media/${mediaId}/family-fit`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) setFamilyFit(j) })
      .catch(() => { if (!cancelled) setFamilyFit(null) })
      .finally(() => { if (!cancelled) setFamilyFitLoading(false) })
    return () => { cancelled = true }
  }, [mediaId, authStatus])

  // loading → skeleton; unauthenticated → not_logged_in without a fetch;
  // authenticated → the fetched result.
  const effectiveFamilyFit: FamilyFitResponse | null =
    authStatus === "unauthenticated" ? { status: "not_logged_in" } : familyFit
  const effectiveFamilyFitLoading =
    authStatus === "unauthenticated" ? false : authStatus === "loading" ? true : familyFitLoading

  useEffect(() => {
    if (!wantsExtras(mediaId, mediaType)) return
    let cancelled = false
    fetch(`/api/media/${mediaId}/extras`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) setExtras(j) })
      .catch(() => { if (!cancelled) setExtras(null) })
      .finally(() => { if (!cancelled) setExtrasLoading(false) })
    return () => { cancelled = true }
  }, [mediaId, mediaType])

  useEffect(() => {
    if (!wantsTriggers(mediaId, mediaType)) return
    let cancelled = false
    fetch(`/api/media/${mediaId}/trigger-vote`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) setTriggerVotes(j) })
      .catch(() => { if (!cancelled) setTriggerVotes(null) })
      .finally(() => { if (!cancelled) setTriggerVotesLoading(false) })
    return () => { cancelled = true }
  }, [mediaId, mediaType])

  return (
    <FicheDataContext.Provider
      value={{
        familyFit: effectiveFamilyFit,
        familyFitLoading: effectiveFamilyFitLoading,
        extras,
        extrasLoading,
        triggerVotes,
        triggerVotesLoading,
      }}
    >
      {children}
    </FicheDataContext.Provider>
  )
}

/**
 * Family-fit data for a fiche. Reads from the provider when present
 * (single shared fetch); otherwise self-fetches so the component still
 * works standalone.
 */
export function useFamilyFitData(mediaId: string | null): {
  data: FamilyFitResponse | null
  loading: boolean
} {
  const ctx = useContext(FicheDataContext)
  const hasCtx = ctx !== undefined
  const [data, setData] = useState<FamilyFitResponse | null>(null)
  const [loading, setLoading] = useState(!hasCtx && !!mediaId)

  useEffect(() => {
    if (hasCtx || !mediaId) return // provider supplies the data, or nothing to fetch
    let cancelled = false
    fetch(`/api/media/${mediaId}/family-fit`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) setData(j) })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [hasCtx, mediaId])

  if (ctx) return { data: ctx.familyFit, loading: ctx.familyFitLoading }
  return { data, loading }
}

/**
 * Extras (watch providers + trailer + in-theaters) for a fiche. Reads from
 * the provider when present; otherwise self-fetches (MOVIE/TV only).
 */
export function useExtrasData(mediaId: string | null, mediaType: string): {
  data: ExtrasData | null
  loading: boolean
} {
  const ctx = useContext(FicheDataContext)
  const hasCtx = ctx !== undefined
  const enabled = wantsExtras(mediaId, mediaType)
  const [data, setData] = useState<ExtrasData | null>(null)
  const [loading, setLoading] = useState(!hasCtx && enabled)

  useEffect(() => {
    if (hasCtx || !enabled) return // provider supplies the data, or nothing to fetch
    let cancelled = false
    fetch(`/api/media/${mediaId}/extras`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) setData(j) })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [hasCtx, enabled, mediaId])

  if (ctx) return { data: ctx.extras, loading: ctx.extrasLoading }
  return { data, loading }
}

/**
 * Trigger-vote consensus for a fiche. Reads from the provider when present
 * (single shared fetch); otherwise self-fetches so the warnings card still
 * works standalone (e.g. /apercufilm). Mirrors useFamilyFitData.
 */
export function useTriggerVotes(mediaId: string | null): {
  data: TriggerConsensusResponse | null
  loading: boolean
} {
  const ctx = useContext(FicheDataContext)
  const hasCtx = ctx !== undefined
  const [data, setData] = useState<TriggerConsensusResponse | null>(null)
  const [loading, setLoading] = useState(!hasCtx && !!mediaId)

  useEffect(() => {
    if (hasCtx || !mediaId) return // provider supplies the data, or nothing to fetch
    let cancelled = false
    fetch(`/api/media/${mediaId}/trigger-vote`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) setData(j) })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [hasCtx, mediaId])

  if (ctx) return { data: ctx.triggerVotes, loading: ctx.triggerVotesLoading }
  return { data, loading }
}
