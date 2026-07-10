"use client"

import Link from "next/link"
import { Check, Clock, X, UserPlus } from "lucide-react"
import { useFamilyFitData } from "@/components/media/FicheDataContext"
import {
  FamilyFitQuickSetup,
  FamilyFitSignIn,
} from "@/components/media/FamilyFitConversionFlow"
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
const CARD = { background: "var(--f-card)", border: "1px solid var(--f-border)" } as const

const BAND: Record<
  FamilyFitBand,
  { text: string; bg: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }
> = {
  veryAdapted: { text: "var(--f-green-deep)", bg: "var(--f-green-soft)", Icon: Check },
  goodChoice: { text: "var(--f-green-deep)", bg: "var(--f-green-soft)", Icon: Check },
  check: { text: "var(--f-gold-deep)", bg: "var(--f-inset)", Icon: Clock },
  notYet: { text: "var(--f-accent)", bg: "var(--f-accent-soft)", Icon: X },
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div id="pour-ma-famille" className="scroll-mt-24 rounded-2xl p-4 sm:p-[18px]" style={CARD}>
      <div className={`${LABEL} mb-3`} style={{ color: "var(--f-faint)" }}>
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
      style={{ borderColor: "var(--f-gold)", background: "var(--f-gold-soft)", color: "var(--f-gold-deep)" }}
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
            <span key={i} className="h-6 w-20 animate-pulse rounded-full" style={{ background: "var(--f-page)" }} />
          ))}
        </div>
        <div className="mt-3 h-3 w-3/4 animate-pulse rounded" style={{ background: "var(--f-page)" }} />
      </Shell>
    )
  }

  if (data?.status === "not_logged_in") {
    return (
      <Shell>
        <p className="text-[12.5px] leading-[1.55]" style={{ color: "var(--f-body)" }}>
          L’âge ne suffit pas toujours. Obtenez un repère adapté aux sensibilités de votre foyer.
        </p>
        <div className="mt-3">
          <FamilyFitSignIn variant="dashboard" compact />
        </div>
      </Shell>
    )
  }

  if (data?.status === "no_family") {
    return (
      <Shell>
        <p className="text-[12.5px] leading-[1.55]" style={{ color: "var(--f-body)" }}>
          Ajoutez un premier profil pour obtenir votre réponse personnalisée sans quitter cette fiche.
        </p>
        <div className="mt-3">
          <FamilyFitQuickSetup mediaId={mediaId} variant="dashboard" compact />
        </div>
      </Shell>
    )
  }

  if (!data || (data.status !== "ok" && data.status !== "family_warning")) {
    return (
      <Shell>
        <p className="text-[12.5px]" style={{ color: "var(--f-muted)" }}>
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
                style={{ background: "var(--f-card)", border: "1px solid var(--f-border)", color: "var(--f-ink)" }}
              >
                <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                  <Icon className="h-3.5 w-3.5" style={{ color: cfg.text }} />
                  {m.name}
                  {m.age != null && (
                    <span className="font-normal" style={{ color: "var(--f-muted)" }}>
                      · {m.age} ans
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] font-semibold" style={{ color: cfg.text }}>
                  {FAMILY_FIT_LABELS[band]}
                </div>
                <p className="mt-1 text-[11.5px] leading-[1.45]" style={{ color: "var(--f-body)" }}>
                  {m.reason}
                </p>
                {m.hasPreferences === false && (
                  <p className="mt-1.5 text-[10.5px] italic" style={{ color: "var(--f-muted)" }}>
                    Quiz non rempli — indice limité.
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-[12.5px] leading-[1.55]" style={{ color: "var(--f-body)" }}>
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
