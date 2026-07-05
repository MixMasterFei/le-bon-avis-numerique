"use client"

import Link from "next/link"
import { Check, Clock, X, UserPlus, LogIn } from "lucide-react"
import { useFamilyFitData } from "@/components/media/FicheDataContext"
import { FAMILY_FIT_LABELS, familyFitBandFromLevel, type FamilyFitBand } from "@/lib/family-fit-display"

/**
 * Compact "Pour ma famille" panel for the V3 dashboard: one chip per member
 * (green = adapté, ambre = un peu tôt, terracotta = pas encore) + a one-line
 * summary, in a fixed-footprint box. Per-member detail (band + reason) lives in
 * a hover/focus popover so the box stays small even with many members.
 *
 * Same data source as FamilyFitHero (useFamilyFitData) so it works standalone
 * or under FicheDataProvider's shared fetch.
 */

const LABEL = "text-[10px] font-bold uppercase tracking-[.13em]"
const CARD = { background: "#FFFFFF", border: "1px solid #E4DAC8" } as const

const BAND: Record<
  FamilyFitBand,
  { text: string; bg: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }
> = {
  veryAdapted: { text: "#2E6B47", bg: "#DCEBDD", Icon: Check },
  goodChoice: { text: "#2E6B47", bg: "#DCEBDD", Icon: Check },
  check: { text: "#A8752A", bg: "#F6E9CE", Icon: Clock },
  notYet: { text: "#C0512E", bg: "#F3DECE", Icon: X },
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4 sm:p-[18px]" style={CARD}>
      <div className={`${LABEL} mb-3`} style={{ color: "#A89A82" }}>
        Pour ma famille
      </div>
      {children}
    </div>
  )
}

function AddMemberButton({ label }: { label: string }) {
  return (
    <Link
      href="/profil"
      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-[11.5px] font-semibold transition-colors hover:brightness-95"
      style={{ borderColor: "#D2A85A", background: "#FBF4E4", color: "#A8752A" }}
    >
      <UserPlus className="h-3.5 w-3.5" />
      {label}
    </Link>
  )
}

export function DashboardFamilyPanel({
  mediaId,
  recommendedAge,
}: {
  mediaId: string
  recommendedAge: number | null
}) {
  const { data, loading } = useFamilyFitData(mediaId)

  if (loading) {
    return (
      <Shell>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-6 w-20 animate-pulse rounded-full" style={{ background: "#EDE4D5" }} />
          ))}
        </div>
        <div className="mt-3 h-3 w-3/4 animate-pulse rounded" style={{ background: "#EDE4D5" }} />
      </Shell>
    )
  }

  if (data?.status === "not_logged_in") {
    return (
      <Shell>
        <p className="text-[12.5px] leading-[1.55]" style={{ color: "#4A433A" }}>
          Créez un profil famille pour voir, membre par membre, si ce titre convient.
        </p>
        <div className="mt-3 flex gap-2">
          <Link
            href="/inscription"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11.5px] font-semibold text-white"
            style={{ background: "#2A251F" }}
          >
            <UserPlus className="h-3.5 w-3.5" /> Créer mon profil
          </Link>
          <Link
            href="/connexion"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11.5px] font-semibold"
            style={{ border: "1px solid #E4DAC8", color: "#2A251F" }}
          >
            <LogIn className="h-3.5 w-3.5" /> Se connecter
          </Link>
        </div>
      </Shell>
    )
  }

  if (data?.status === "no_family") {
    return (
      <Shell>
        <p className="text-[12.5px] leading-[1.55]" style={{ color: "#4A433A" }}>
          Ajoutez les membres de votre foyer pour voir si ce titre leur convient.
        </p>
        <AddMemberButton label="+ Ajouter un membre" />
      </Shell>
    )
  }

  if (!data || (data.status !== "ok" && data.status !== "family_warning")) {
    return (
      <Shell>
        <p className="text-[12.5px]" style={{ color: "#8A8072" }}>
          Indisponible pour le moment.
        </p>
      </Shell>
    )
  }

  const { members } = data
  const banded = members.map((m) => ({ m, band: familyFitBandFromLevel(m.level) }))
  const adapted = banded.filter((b) => b.band === "veryAdapted" || b.band === "goodChoice").length
  const total = members.length
  const tooYoung = banded
    .filter(
      (b) =>
        b.band !== "veryAdapted" &&
        b.band !== "goodChoice" &&
        b.m.age != null &&
        recommendedAge != null &&
        b.m.age < recommendedAge,
    )
    .map((b) => b.m.name)

  return (
    <Shell>
      <div className="flex flex-wrap gap-2">
        {banded.map(({ m, band }) => {
          const cfg = BAND[band]
          const Icon = cfg.Icon
          return (
            <div key={m.id} className="group relative">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                style={{ color: cfg.text, background: cfg.bg }}
              >
                <Icon className="h-3.5 w-3.5" />
                {m.name}
              </button>
              {/* Hover / focus popover — keeps per-member detail out of the box flow */}
              <div
                className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-56 rounded-xl p-3 text-left opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                style={{ background: "#FFFFFF", border: "1px solid #E4DAC8", color: "#2A251F" }}
              >
                <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                  <Icon className="h-3.5 w-3.5" style={{ color: cfg.text }} />
                  {m.name}
                  {m.age != null && (
                    <span className="font-normal" style={{ color: "#8A8072" }}>
                      · {m.age} ans
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] font-semibold" style={{ color: cfg.text }}>
                  {FAMILY_FIT_LABELS[band]}
                </div>
                <p className="mt-1 text-[11.5px] leading-[1.45]" style={{ color: "#4A433A" }}>
                  {m.reason}
                </p>
                {m.hasPreferences === false && (
                  <p className="mt-1.5 text-[10.5px] italic" style={{ color: "#8A8072" }}>
                    Quiz non rempli — indice limité.
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-[12.5px] leading-[1.55]" style={{ color: "#4A433A" }}>
        Convient à{" "}
        <b>
          {adapted} de vos {total} membre{total > 1 ? "s" : ""}
        </b>
        {recommendedAge != null ? ` — recommandé dès ${recommendedAge} ans` : ""}
        {tooYoung.length > 0 ? `, encore un peu tôt pour ${tooYoung.join(", ")}` : ""}.
      </p>

      <AddMemberButton label="+ Ajouter un membre" />
    </Shell>
  )
}
