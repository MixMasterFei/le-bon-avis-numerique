"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, X, Users } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { TopProgressBar } from "@/components/ui/TopProgressBar"
import { getMemberAge } from "@/lib/age-utils"
import { APERCU_PALETTE } from "./apercuTheme"

/**
 * Warm-palette filter sidebar for /apercufilmslist. Mirrors the live
 * FilterSidebar feature set (search, sort, family member multi-select,
 * age range, platforms, topics) but in the canonical apercu chrome:
 * cream cards, terracotta active states, sage trust signals.
 *
 * URL is the source of truth — every change calls router.replace with
 * the new params, which triggers a fresh server render of the page
 * (force-dynamic) and a fresh fetchMovies call. No client-side data
 * fetching for the grid.
 */

interface FamilyMember {
  id: string
  name: string
  birthYear: number | null
  birthMonth: number | null
  avatarEmoji: string | null
  avatarStyle: string | null
  avatarSeed: string | null
  avatarOptions: Record<string, unknown> | null
}

export type ApercuFilterMediaType = "MOVIE" | "TV" | "GAME" | "MANGA"

interface ApercuFilterSidebarProps {
  serifClass: string
  familyMembers: FamilyMember[]
  initialFilters: {
    search: string
    sort: string
    minAge: number
    maxAge: number
    platforms: string[]
    topics: string[]
    familyMemberIds: string[]
  }
  /** Route to push filter changes to. Defaults to "/films". */
  route?: string
  /** Drives placeholder copy + which platform/topic lists are shown.
      Without this the games page was showing streaming platforms and
      movie-only topics like "Super-héros" / "Aviation" — wrong context. */
  mediaType?: ApercuFilterMediaType
}

const SORT_OPTIONS = [
  { key: "releaseDate", label: "Récents" },
  { key: "quality", label: "Mieux notés" },
  { key: "title", label: "A → Z" },
] as const

// Streaming platforms — apply to films + TV.
const MOVIE_TV_PLATFORMS = [
  "Netflix France",
  "Disney+",
  "Prime Video",
  "Canal+",
  "France TV",
  "Apple TV+",
]

// Gaming platforms — apply to GAME. Matches the legacy FilterSidebar set.
const GAME_PLATFORMS = [
  "Switch",
  "PS5",
  "PS4",
  "Xbox Series",
  "Xbox One",
  "PC",
  "Mac",
]

const MOVIE_TV_TOPICS = [
  "Animation",
  "Aventure",
  "Comédie",
  "Fantastique",
  "Science-Fiction",
  "Famille",
  "Éducatif",
  "Animaux",
  "Super-héros",
  "Espace",
  "Magie",
  "Nature",
  "Sport",
  "Musique",
  "Histoire",
  "Amitié",
]

const GAME_TOPICS = [
  "Aventure",
  "Action",
  "RPG",
  "Plateforme",
  "Puzzle",
  "Sport",
  "Course",
  "Simulation",
  "Éducatif",
  "Famille",
  "Multijoueur",
  "Coopératif",
]

const MANGA_TOPICS = [
  "Shōnen",
  "Shōjo",
  "Seinen",
  "Aventure",
  "Action",
  "Comédie",
  "Famille",
  "Fantastique",
  "Science-Fiction",
  "Sport",
  "Slice of life",
]

function platformsFor(mediaType: ApercuFilterMediaType): string[] {
  if (mediaType === "GAME") return GAME_PLATFORMS
  if (mediaType === "MANGA") return [] // no platform concept
  return MOVIE_TV_PLATFORMS
}

function topicsFor(mediaType: ApercuFilterMediaType): string[] {
  if (mediaType === "GAME") return GAME_TOPICS
  if (mediaType === "MANGA") return MANGA_TOPICS
  return MOVIE_TV_TOPICS
}

function searchPlaceholderFor(mediaType: ApercuFilterMediaType): string {
  if (mediaType === "GAME") return "Titre du jeu..."
  if (mediaType === "TV") return "Titre de la série..."
  if (mediaType === "MANGA") return "Titre du manga..."
  return "Titre du film..."
}

const DEFAULT_MIN_AGE = 2
const DEFAULT_MAX_AGE = 18

export function ApercuFilterSidebar({
  serifClass,
  familyMembers,
  initialFilters,
  route = "/films",
  mediaType = "MOVIE",
}: ApercuFilterSidebarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const p = APERCU_PALETTE
  // isPending stays true while Next.js does the server roundtrip after
  // router.replace — drives the TopProgressBar so the user sees that
  // their filter click is doing something. Without this, the cream
  // background gave zero visual signal during the navigation.
  const [isPending, startTransition] = useTransition()
  const PLATFORMS = useMemo(() => platformsFor(mediaType), [mediaType])
  const TOPICS = useMemo(() => topicsFor(mediaType), [mediaType])

  const [search, setSearch] = useState(initialFilters.search)
  const [sort, setSort] = useState(initialFilters.sort)
  const [minAge, setMinAge] = useState(initialFilters.minAge)
  const [maxAge, setMaxAge] = useState(initialFilters.maxAge)
  const [platforms, setPlatforms] = useState<string[]>(initialFilters.platforms)
  const [topics, setTopics] = useState<string[]>(initialFilters.topics)
  const [memberIds, setMemberIds] = useState<string[]>(
    initialFilters.familyMemberIds,
  )

  // Selected members with ages (sorted youngest first)
  const selectedMembers = useMemo(() => {
    return memberIds
      .map((id) => familyMembers.find((m) => m.id === id))
      .filter((m): m is FamilyMember => !!m)
      .map((m) => ({ ...m, age: getMemberAge(m.birthYear, m.birthMonth) }))
      .sort((a, b) => {
        if (a.age === null && b.age === null) return 0
        if (a.age === null) return 1
        if (b.age === null) return -1
        return a.age - b.age
      })
  }, [memberIds, familyMembers])

  const filterSummary = useMemo(() => {
    if (selectedMembers.length === 0) return null
    if (selectedMembers.length === 1) {
      const m = selectedMembers[0]
      return m.age !== null
        ? `Adapté pour ${m.name} (${m.age} ans)`
        : `Filtré pour ${m.name}`
    }
    const youngest = selectedMembers[0]
    return youngest.age !== null
      ? `Adapté pour ${youngest.name} (${youngest.age} ans) et ${selectedMembers.length - 1} autre${selectedMembers.length > 2 ? "s" : ""}`
      : `Filtré pour ${selectedMembers.length} membres`
  }, [selectedMembers])

  // Push state to URL whenever filters change (debounced for search input)
  const pushUrl = useMemo(
    () =>
      (next: {
        search?: string
        sort?: string
        minAge?: number
        maxAge?: number
        platforms?: string[]
        topics?: string[]
        memberIds?: string[]
      }) => {
        const sp = new URLSearchParams()
        const font = searchParams.get("font")
        if (font) sp.set("font", font)
        const finalSearch = next.search ?? search
        const finalSort = next.sort ?? sort
        const finalMinAge = next.minAge ?? minAge
        const finalMaxAge = next.maxAge ?? maxAge
        const finalPlatforms = next.platforms ?? platforms
        const finalTopics = next.topics ?? topics
        const finalMembers = next.memberIds ?? memberIds

        if (finalSearch) sp.set("q", finalSearch)
        if (finalSort && finalSort !== "releaseDate") sp.set("sort", finalSort)
        if (finalMinAge > DEFAULT_MIN_AGE) sp.set("minAge", String(finalMinAge))
        if (finalMaxAge < DEFAULT_MAX_AGE) sp.set("maxAge", String(finalMaxAge))
        if (finalPlatforms.length > 0)
          sp.set("platforms", finalPlatforms.join(","))
        if (finalTopics.length > 0) sp.set("topics", finalTopics.join(","))
        if (finalMembers.length > 0) sp.set("members", finalMembers.join(","))

        const qs = sp.toString()
        startTransition(() => {
          router.replace(qs ? `${route}?${qs}` : route, {
            scroll: false,
          })
        })
      },
    [
      router,
      searchParams,
      search,
      sort,
      minAge,
      maxAge,
      platforms,
      topics,
      memberIds,
      route,
    ],
  )

  // Debounce search updates so the URL doesn't churn on every keystroke
  useEffect(() => {
    if (search === initialFilters.search) return
    const t = setTimeout(() => pushUrl({ search }), 350)
    return () => clearTimeout(t)
  }, [search, initialFilters.search, pushUrl])

  const togglePlatform = (item: string) => {
    const next = platforms.includes(item)
      ? platforms.filter((x) => x !== item)
      : [...platforms, item]
    setPlatforms(next)
    pushUrl({ platforms: next })
  }

  const toggleTopic = (item: string) => {
    const next = topics.includes(item)
      ? topics.filter((x) => x !== item)
      : [...topics, item]
    setTopics(next)
    pushUrl({ topics: next })
  }

  const toggleMember = (id: string) => {
    const next = memberIds.includes(id)
      ? memberIds.filter((x) => x !== id)
      : [...memberIds, id]
    setMemberIds(next)

    // Center an age band around the youngest selected member (±3 years)
    // so the grid shows content that actually fits them — not everything
    // from 2+ upwards.
    if (next.length > 0) {
      const ages = next
        .map((mid) => familyMembers.find((m) => m.id === mid))
        .filter((m): m is FamilyMember => !!m)
        .map((m) => getMemberAge(m.birthYear, m.birthMonth))
        .filter((a): a is number => a !== null)
      if (ages.length > 0) {
        const youngest = Math.min(...ages)
        // Cap at the member's own age (no 11+ content for a 10-year-old).
        // Floor at age - 3 so some younger-rated picks still surface.
        const cap = Math.min(DEFAULT_MAX_AGE, youngest)
        const floor = Math.max(DEFAULT_MIN_AGE, youngest - 3)
        setMaxAge(cap)
        setMinAge(floor)
        pushUrl({ memberIds: next, minAge: floor, maxAge: cap })
        return
      }
    }
    pushUrl({ memberIds: next })
  }

  const handleAgeChange = (value: number[]) => {
    setMinAge(value[0])
    setMaxAge(value[1])
    pushUrl({ minAge: value[0], maxAge: value[1] })
  }

  const handleSortChange = (next: string) => {
    setSort(next)
    pushUrl({ sort: next })
  }

  const clearAll = () => {
    setSearch("")
    setSort("releaseDate")
    setMinAge(DEFAULT_MIN_AGE)
    setMaxAge(DEFAULT_MAX_AGE)
    setPlatforms([])
    setTopics([])
    setMemberIds([])
    const sp = new URLSearchParams()
    const font = searchParams.get("font")
    if (font) sp.set("font", font)
    const qs = sp.toString()
    startTransition(() => {
      router.replace(qs ? `${route}?${qs}` : route, {
        scroll: false,
      })
    })
  }

  const hasActiveFilters =
    search !== "" ||
    sort !== "releaseDate" ||
    minAge !== DEFAULT_MIN_AGE ||
    maxAge !== DEFAULT_MAX_AGE ||
    platforms.length > 0 ||
    topics.length > 0 ||
    memberIds.length > 0

  return (
    <aside
      className="lg:sticky lg:top-24 space-y-5 rounded-2xl p-5"
      style={{
        background: p.card,
        border: `1px solid ${p.line}`,
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: p.accent }}
          >
            Filtres
          </div>
          <div
            className={`${serifClass} text-lg font-medium`}
            style={{ letterSpacing: "-0.01em", color: p.ink }}
          >
            Affiner
          </div>
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="text-[11px] font-medium flex items-center gap-1 hover:opacity-70 transition-opacity"
            style={{ color: p.ink2 }}
          >
            <X className="h-3 w-3" />
            Effacer
          </button>
        )}
      </div>

      {/* Search */}
      <div>
        <SectionLabel>Recherche</SectionLabel>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-full text-sm"
          style={{
            background: p.bg2,
            border: `1px solid ${p.line}`,
          }}
        >
          <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: p.ink2 }} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholderFor(mediaType)}
            className="flex-1 bg-transparent outline-none placeholder:text-current/60"
            style={{ color: p.ink }}
          />
        </div>
      </div>

      {/* Sort */}
      <div>
        <SectionLabel>Trier</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {SORT_OPTIONS.map((s) => {
            const active = sort === s.key
            return (
              <button
                key={s.key}
                onClick={() => handleSortChange(s.key)}
                className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                style={{
                  background: active ? p.accent : p.bg2,
                  color: active ? "#fff" : p.ink,
                  border: `1px solid ${active ? p.accent : p.line}`,
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Family members — vertical list of full-width rows. */}
      {familyMembers.length > 0 && (
        <div>
          <SectionLabel>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              Adapter à
            </span>
          </SectionLabel>
          <div className="space-y-1.5">
            {familyMembers.map((m) => {
              const active = memberIds.includes(m.id)
              const age = getMemberAge(m.birthYear, m.birthMonth)
              return (
                <button
                  key={m.id}
                  onClick={() => toggleMember(m.id)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors text-left"
                  style={{
                    background: active ? p.bg2 : "transparent",
                    border: `1px solid ${active ? p.line2 : "transparent"}`,
                  }}
                >
                  <MemberAvatar
                    avatarStyle={m.avatarStyle}
                    avatarSeed={m.avatarSeed}
                    avatarOptions={m.avatarOptions}
                    avatarEmoji={m.avatarEmoji}
                    name={m.name}
                    size={28}
                    ring={active ? "green" : null}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-sm font-semibold truncate"
                      style={{ color: p.ink }}
                    >
                      {m.name}
                    </div>
                    {age !== null && (
                      <div className="text-[11px]" style={{ color: p.ink2 }}>
                        {age} ans
                      </div>
                    )}
                  </div>
                  {active && (
                    <span
                      className="text-[11px] font-semibold flex-shrink-0"
                      style={{ color: p.accent2 }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {filterSummary && (
            <div
              className="mt-2 px-3 py-2 rounded-lg text-[11px] leading-snug"
              style={{
                background: "rgba(92,138,92,0.10)",
                color: "#3E6040",
              }}
            >
              {filterSummary}
            </div>
          )}
        </div>
      )}

      {/* Age range */}
      <div>
        <SectionLabel>Tranche d&apos;âge</SectionLabel>
        <div className="px-1">
          <Slider
            value={[minAge, maxAge]}
            onValueChange={handleAgeChange}
            max={DEFAULT_MAX_AGE}
            min={DEFAULT_MIN_AGE}
            step={1}
            minStepsBetweenThumbs={1}
          />
          <div className="flex justify-between mt-2 text-xs" style={{ color: p.ink2 }}>
            <span
              className={`${serifClass} font-medium`}
              style={{ color: p.ink }}
            >
              {minAge} ans
            </span>
            <span
              className={`${serifClass} font-medium`}
              style={{ color: p.ink }}
            >
              {maxAge} ans
            </span>
          </div>
        </div>
      </div>

      {/* Platforms — hidden for media types where the concept doesn't apply
          (e.g. mangas). For games this switches to console list, for
          films/TV it stays at streaming services. */}
      {PLATFORMS.length > 0 && (
        <div>
          <SectionLabel>
            {mediaType === "GAME" ? "Consoles" : "Plateformes"}
          </SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((item) => {
              const active = platforms.includes(item)
              return (
                <button
                  key={item}
                  onClick={() => togglePlatform(item)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
                  style={{
                    background: active ? p.ink : p.bg2,
                    color: active ? p.bg : p.ink2,
                    border: `1px solid ${active ? p.ink : p.line}`,
                  }}
                >
                  {item}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Topics */}
      <div>
        <SectionLabel>Thèmes</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {TOPICS.map((item) => {
            const active = topics.includes(item)
            return (
              <button
                key={item}
                onClick={() => toggleTopic(item)}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
                style={{
                  background: active ? p.accent2 : p.bg2,
                  color: active ? "#fff" : p.ink2,
                  border: `1px solid ${active ? p.accent2 : p.line}`,
                }}
              >
                {item}
              </button>
            )
          })}
        </div>
      </div>

      {/* Loading bar at the very top of the viewport while a filter
          change is being applied (Next.js useTransition pending state).
          The cream sidebar has zero visual signal otherwise so users
          thought their click did nothing. */}
      <TopProgressBar loading={isPending} />
    </aside>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const p = APERCU_PALETTE
  return (
    <div
      className="text-[11px] font-semibold uppercase tracking-wide mb-2"
      style={{ color: p.ink2 }}
    >
      {children}
    </div>
  )
}
