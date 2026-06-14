"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getMemberAge } from "@/lib/age-utils"
import { FILTERABLE_PLATFORMS } from "@/lib/streaming-providers"
import { GAME_GENRE_TOPICS } from "@/lib/igdb-genres"
import { preserveStickyParams } from "./stickyParams"

/**
 * Headless catalogue-filter state machine, extracted from ApercuFilterSidebar
 * so the classic and the V2 sidebars can't drift on behavior. URL is the
 * single source of truth: every change calls router.replace with the new
 * params, which re-renders the (force-dynamic) page server-side.
 *
 * Parameterized by `defaultSort` + age defaults so `clearAll` resets to the
 * route's *real* default (films/séries: releaseDate, jeux: popularity, mangas:
 * newest) instead of always releaseDate, and so manga's 0–99 age range works.
 * Sticky params (`font`, `v`) are carried through every push so an admin on the
 * V2 variant is never bounced back to classic by a filter change.
 */

export type CatalogueMediaType = "MOVIE" | "TV" | "GAME" | "MANGA"

export interface FamilyMember {
  id: string
  name: string
  birthYear: number | null
  birthMonth: number | null
  avatarEmoji: string | null
  avatarStyle: string | null
  avatarSeed: string | null
  avatarOptions: Record<string, unknown> | null
}

export interface CatalogueFilterState {
  search: string
  sort: string
  minAge: number
  maxAge: number
  platforms: string[]
  topics: string[]
  familyMemberIds: string[]
}

interface UseCatalogueFiltersArgs {
  route: string
  mediaType: CatalogueMediaType
  familyMembers: FamilyMember[]
  initial: CatalogueFilterState
  defaultSort: string
  defaultMinAge?: number
  defaultMaxAge?: number
}

export const SORT_OPTIONS = [
  { key: "releaseDate", label: "Récents" },
  { key: "quality", label: "Mieux notés" },
  { key: "title", label: "A → Z" },
] as const

// Streaming platforms — films + TV. Single canonical list so values match
// MediaItem.platforms[] exactly. Gaming consoles for GAME.
const MOVIE_TV_PLATFORMS = [...FILTERABLE_PLATFORMS]
const GAME_PLATFORMS = ["Switch", "PS5", "PS4", "Xbox Series", "Xbox One", "PC", "Mac"]

const MOVIE_TV_TOPICS = [
  "Animation", "Aventure", "Comédie", "Fantastique", "Science-Fiction", "Famille",
  "Éducatif", "Animaux", "Super-héros", "Espace", "Magie", "Nature", "Sport",
  "Musique", "Histoire", "Amitié",
]
const GAME_TOPICS = GAME_GENRE_TOPICS
const MANGA_TOPICS = [
  "Shōnen", "Shōjo", "Seinen", "Aventure", "Action", "Comédie", "Famille",
  "Fantastique", "Science-Fiction", "Sport", "Slice of life",
]

export function platformsFor(mediaType: CatalogueMediaType): string[] {
  if (mediaType === "GAME") return GAME_PLATFORMS
  if (mediaType === "MANGA") return []
  return MOVIE_TV_PLATFORMS
}

export function topicsFor(mediaType: CatalogueMediaType): string[] {
  if (mediaType === "GAME") return GAME_TOPICS
  if (mediaType === "MANGA") return MANGA_TOPICS
  return MOVIE_TV_TOPICS
}

export function searchPlaceholderFor(mediaType: CatalogueMediaType): string {
  if (mediaType === "GAME") return "Titre du jeu…"
  if (mediaType === "TV") return "Titre de la série…"
  if (mediaType === "MANGA") return "Titre du manga…"
  return "Titre du film…"
}

export function useCatalogueFilters({
  route,
  mediaType,
  familyMembers,
  initial,
  defaultSort,
  defaultMinAge = 2,
  defaultMaxAge = 18,
}: UseCatalogueFiltersArgs) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const PLATFORMS = useMemo(() => platformsFor(mediaType), [mediaType])
  const TOPICS = useMemo(() => topicsFor(mediaType), [mediaType])

  const [search, setSearch] = useState(initial.search)
  const [sort, setSort] = useState(initial.sort)
  const [minAge, setMinAge] = useState(initial.minAge)
  const [maxAge, setMaxAge] = useState(initial.maxAge)
  const [platforms, setPlatforms] = useState<string[]>(initial.platforms)
  const [topics, setTopics] = useState<string[]>(initial.topics)
  const [memberIds, setMemberIds] = useState<string[]>(initial.familyMemberIds)

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
        ? `Tranche d'âge pour ${m.name} (${m.age} ans)`
        : `Filtré pour ${m.name}`
    }
    const youngest = selectedMembers[0]
    return youngest.age !== null
      ? `Tranche d'âge pour ${youngest.name} (${youngest.age} ans) et ${selectedMembers.length - 1} autre${selectedMembers.length > 2 ? "s" : ""}`
      : `Filtré pour ${selectedMembers.length} membres`
  }, [selectedMembers])

  const pushUrl = useMemo(
    () =>
      (next: Partial<{
        search: string
        sort: string
        minAge: number
        maxAge: number
        platforms: string[]
        topics: string[]
        memberIds: string[]
      }>) => {
        const sp = new URLSearchParams()
        const finalSearch = next.search ?? search
        const finalSort = next.sort ?? sort
        const finalMinAge = next.minAge ?? minAge
        const finalMaxAge = next.maxAge ?? maxAge
        const finalPlatforms = next.platforms ?? platforms
        const finalTopics = next.topics ?? topics
        const finalMembers = next.memberIds ?? memberIds

        if (finalSearch) sp.set("q", finalSearch)
        if (finalSort && finalSort !== defaultSort) sp.set("sort", finalSort)
        if (finalMinAge > defaultMinAge) sp.set("minAge", String(finalMinAge))
        if (finalMaxAge < defaultMaxAge) sp.set("maxAge", String(finalMaxAge))
        if (finalPlatforms.length > 0) sp.set("platforms", finalPlatforms.join(","))
        if (finalTopics.length > 0) sp.set("topics", finalTopics.join(","))
        if (finalMembers.length > 0) sp.set("members", finalMembers.join(","))

        preserveStickyParams(sp, searchParams)
        const qs = sp.toString()
        startTransition(() => {
          router.replace(qs ? `${route}?${qs}` : route, { scroll: false })
        })
      },
    [
      router, searchParams, search, sort, minAge, maxAge, platforms, topics,
      memberIds, route, defaultSort, defaultMinAge, defaultMaxAge,
    ],
  )

  // Debounce search so the URL doesn't churn on every keystroke.
  useEffect(() => {
    if (search === initial.search) return
    const t = setTimeout(() => pushUrl({ search }), 350)
    return () => clearTimeout(t)
  }, [search, initial.search, pushUrl])

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

    // Center an age band on the youngest selected member so the grid shows
    // content that actually fits them (cap at their age, floor at age-3).
    if (next.length > 0) {
      const ages = next
        .map((mid) => familyMembers.find((m) => m.id === mid))
        .filter((m): m is FamilyMember => !!m)
        .map((m) => getMemberAge(m.birthYear, m.birthMonth))
        .filter((a): a is number => a !== null)
      if (ages.length > 0) {
        const youngest = Math.min(...ages)
        const cap = Math.min(defaultMaxAge, youngest)
        const floor = Math.max(defaultMinAge, youngest - 3)
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
    setSort(defaultSort)
    setMinAge(defaultMinAge)
    setMaxAge(defaultMaxAge)
    setPlatforms([])
    setTopics([])
    setMemberIds([])
    const sp = new URLSearchParams()
    preserveStickyParams(sp, searchParams)
    const qs = sp.toString()
    startTransition(() => {
      router.replace(qs ? `${route}?${qs}` : route, { scroll: false })
    })
  }

  const hasActiveFilters =
    search !== "" ||
    sort !== defaultSort ||
    minAge !== defaultMinAge ||
    maxAge !== defaultMaxAge ||
    platforms.length > 0 ||
    topics.length > 0 ||
    memberIds.length > 0

  return {
    // state
    search, sort, minAge, maxAge, platforms, topics, memberIds,
    // derived
    selectedMembers, filterSummary, hasActiveFilters, isPending,
    PLATFORMS, TOPICS,
    // setters / handlers
    setSearch, togglePlatform, toggleTopic, toggleMember,
    handleAgeChange, handleSortChange, clearAll,
  }
}
