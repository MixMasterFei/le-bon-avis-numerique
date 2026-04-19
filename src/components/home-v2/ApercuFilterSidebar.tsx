"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, X, Users } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
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
}

const SORT_OPTIONS = [
  { key: "releaseDate", label: "Récents" },
  { key: "quality", label: "Mieux notés" },
  { key: "title", label: "A → Z" },
] as const

const PLATFORMS = [
  "Netflix France",
  "Disney+",
  "Prime Video",
  "Canal+",
  "France TV",
  "Apple TV+",
]

const TOPICS = [
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

const DEFAULT_MIN_AGE = 2
const DEFAULT_MAX_AGE = 18

export function ApercuFilterSidebar({
  serifClass,
  familyMembers,
  initialFilters,
}: ApercuFilterSidebarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const p = APERCU_PALETTE

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
        router.replace(qs ? `/apercufilmslist?${qs}` : "/apercufilmslist", {
          scroll: false,
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

    // Auto-adjust max age to the youngest selected member + 3 so the
    // grid actually narrows to age-appropriate content.
    if (next.length > 0) {
      const ages = next
        .map((mid) => familyMembers.find((m) => m.id === mid))
        .filter((m): m is FamilyMember => !!m)
        .map((m) => getMemberAge(m.birthYear, m.birthMonth))
        .filter((a): a is number => a !== null)
      if (ages.length > 0) {
        const cap = Math.min(DEFAULT_MAX_AGE, Math.min(...ages) + 3)
        setMaxAge(cap)
        pushUrl({ memberIds: next, maxAge: cap })
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
    router.replace(qs ? `/apercufilmslist?${qs}` : "/apercufilmslist", {
      scroll: false,
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
            placeholder="Titre du film..."
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

      {/* Family members — compact horizontal pills, wrap to fit even with
         5-6 members in a 280px sidebar. */}
      {familyMembers.length > 0 && (
        <div>
          <SectionLabel>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              Adapter à
            </span>
          </SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {familyMembers.map((m) => {
              const active = memberIds.includes(m.id)
              const age = getMemberAge(m.birthYear, m.birthMonth)
              return (
                <button
                  key={m.id}
                  onClick={() => toggleMember(m.id)}
                  title={age !== null ? `${m.name} · ${age} ans` : m.name}
                  className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full transition-colors"
                  style={{
                    background: active ? p.bg2 : "transparent",
                    border: `1px solid ${active ? p.accent2 : p.line2}`,
                  }}
                >
                  <MemberAvatar
                    avatarStyle={m.avatarStyle}
                    avatarSeed={m.avatarSeed}
                    avatarOptions={m.avatarOptions}
                    avatarEmoji={m.avatarEmoji}
                    name={m.name}
                    size={22}
                    ring={active ? "green" : null}
                  />
                  <span
                    className="text-[12px] font-semibold leading-none"
                    style={{ color: p.ink }}
                  >
                    {m.name}
                  </span>
                  {age !== null && (
                    <span
                      className="text-[10px] leading-none"
                      style={{ color: p.ink2 }}
                    >
                      {age}
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

      {/* Platforms */}
      <div>
        <SectionLabel>Plateformes</SectionLabel>
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
