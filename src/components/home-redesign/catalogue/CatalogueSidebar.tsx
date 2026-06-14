"use client"

import { Search, X, Users, Check } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { TopProgressBar } from "@/components/ui/TopProgressBar"
import { getMemberAge } from "@/lib/age-utils"
import { memberColor } from "../family"
import {
  useCatalogueFilters,
  searchPlaceholderFor,
  SORT_OPTIONS,
  type CatalogueMediaType,
  type FamilyMember,
  type CatalogueFilterState,
} from "./useCatalogueFilters"

/**
 * V2-token restyle of the catalogue filter sidebar (the mock's `.filters`
 * card). All behavior comes from useCatalogueFilters (URL-as-truth, member
 * age-band centering, sticky `v`/`font`, per-route default sort) — this file
 * is presentation only.
 */
export function CatalogueSidebar({
  route,
  mediaType,
  familyMembers,
  initialFilters,
  defaultSort,
  defaultMinAge = 2,
  defaultMaxAge = 18,
}: {
  route: string
  mediaType: CatalogueMediaType
  familyMembers: FamilyMember[]
  initialFilters: CatalogueFilterState
  defaultSort: string
  defaultMinAge?: number
  defaultMaxAge?: number
}) {
  const f = useCatalogueFilters({
    route,
    mediaType,
    familyMembers,
    initial: initialFilters,
    defaultSort,
    defaultMinAge,
    defaultMaxAge,
  })

  return (
    <aside
      className="lg:sticky lg:top-[84px] space-y-5 rounded-[var(--r-lg)] p-5"
      style={{ background: "var(--card)", border: "1px solid var(--line)" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--terra)" }}>
            Filtres
          </div>
          <div className="text-lg font-bold" style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.01em", color: "var(--ink)" }}>
            Affiner
          </div>
        </div>
        {f.hasActiveFilters && (
          <button
            onClick={f.clearAll}
            className="flex items-center gap-1 text-[11px] font-semibold transition-opacity hover:opacity-70"
            style={{ color: "var(--ink-2)" }}
          >
            <X className="h-3 w-3" /> Effacer
          </button>
        )}
      </div>

      {/* Search */}
      <div>
        <SectionLabel>Recherche</SectionLabel>
        <div className="flex items-center gap-2 rounded-full px-3 py-2 text-sm" style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}>
          <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--ink-2)" }} />
          <input
            type="search"
            value={f.search}
            onChange={(e) => f.setSearch(e.target.value)}
            placeholder={searchPlaceholderFor(mediaType)}
            className="flex-1 bg-transparent outline-none placeholder:opacity-60"
            style={{ color: "var(--ink)" }}
          />
        </div>
      </div>

      {/* Sort — segmented */}
      <div>
        <SectionLabel>Trier</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {SORT_OPTIONS.map((s) => {
            const active = f.sort === s.key
            return (
              <button
                key={s.key}
                onClick={() => f.handleSortChange(s.key)}
                aria-pressed={active}
                className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
                style={{
                  background: active ? "var(--terra)" : "var(--paper-2)",
                  color: active ? "#fff" : "var(--ink)",
                  border: `1px solid ${active ? "var(--terra)" : "var(--line)"}`,
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Adapter à — family members */}
      {familyMembers.length > 0 && (
        <div>
          <SectionLabel>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Adapter à
            </span>
          </SectionLabel>
          <div className="space-y-1.5">
            {familyMembers.map((m, idx) => {
              const active = f.memberIds.includes(m.id)
              const age = getMemberAge(m.birthYear, m.birthMonth)
              const mc = memberColor(idx)
              return (
                <button
                  key={m.id}
                  onClick={() => f.toggleMember(m.id)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors"
                  style={{
                    background: active ? `${mc}14` : "transparent",
                    border: `1px solid ${active ? mc : "transparent"}`,
                  }}
                >
                  <MemberAvatar
                    avatarStyle={m.avatarStyle}
                    avatarSeed={m.avatarSeed}
                    avatarOptions={m.avatarOptions}
                    avatarEmoji={m.avatarEmoji}
                    name={m.name}
                    size={28}
                    ring={null}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>{m.name}</div>
                    {age !== null && <div className="text-[11px]" style={{ color: "var(--ink-2)" }}>{age} ans</div>}
                  </div>
                  {active && (
                    <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full" style={{ background: mc }}>
                      <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {f.filterSummary && (
            <div className="mt-2 rounded-lg px-3 py-2 text-[11px] leading-snug" style={{ background: "var(--pine-soft)", color: "var(--pine-2)" }}>
              {f.filterSummary}
            </div>
          )}
        </div>
      )}

      {/* Age range */}
      <div>
        <SectionLabel>Tranche d&apos;âge</SectionLabel>
        <div className="px-1">
          <Slider
            value={[f.minAge, f.maxAge]}
            onValueChange={f.handleAgeChange}
            max={defaultMaxAge}
            min={defaultMinAge}
            step={1}
            minStepsBetweenThumbs={1}
          />
          <div className="mt-2 flex justify-between text-xs" style={{ color: "var(--ink-2)" }}>
            <span className="font-semibold" style={{ color: "var(--ink)" }}>{f.minAge} ans</span>
            <span className="font-semibold" style={{ color: "var(--ink)" }}>{f.maxAge} ans</span>
          </div>
        </div>
      </div>

      {/* Platforms / consoles */}
      {f.PLATFORMS.length > 0 && (
        <div>
          <SectionLabel>{mediaType === "GAME" ? "Consoles" : "Plateformes"}</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {f.PLATFORMS.map((item) => {
              const active = f.platforms.includes(item)
              return (
                <button
                  key={item}
                  onClick={() => f.togglePlatform(item)}
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
                  style={{
                    background: active ? "var(--pine)" : "var(--paper-2)",
                    color: active ? "#fff" : "var(--ink-2)",
                    border: `1px solid ${active ? "var(--pine)" : "var(--line)"}`,
                  }}
                >
                  {item}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Themes */}
      {f.TOPICS.length > 0 && (
        <div>
          <SectionLabel>Thèmes</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {f.TOPICS.map((item) => {
              const active = f.topics.includes(item)
              return (
                <button
                  key={item}
                  onClick={() => f.toggleTopic(item)}
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
                  style={{
                    background: active ? "var(--pine)" : "var(--paper-2)",
                    color: active ? "#fff" : "var(--ink-2)",
                    border: `1px solid ${active ? "var(--pine)" : "var(--line)"}`,
                  }}
                >
                  {item}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <TopProgressBar loading={f.isPending} />
    </aside>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--ink-2)" }}>
      {children}
    </div>
  )
}
