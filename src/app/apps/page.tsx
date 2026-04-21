"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Smartphone } from "lucide-react"
import { ApercuMediaCard, type ApercuCardMedia } from "@/components/home-v2/ApercuMediaCard"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { mockMediaItems } from "@/lib/mock-data"

export default function AppsPage() {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const [maxAge, setMaxAge] = useState(18)

  const apps = useMemo(() => {
    const items = mockMediaItems
      .filter((m) => m.type === "APP")
      .filter((m) => maxAge >= 18 || (m.expertAgeRec ?? 99) <= maxAge)
    return items.map<ApercuCardMedia>((m) => ({
      id: m.id,
      type: "MOVIE",
      title: m.title,
      posterUrl: m.posterUrl || null,
      expertAgeRec: m.expertAgeRec,
      genres: m.genres || [],
      contentMetrics: null,
    }))
  }, [maxAge])

  const ageButtons = [
    { label: "Tous", value: 18 },
    { label: "≤ 5 ans", value: 5 },
    { label: "≤ 8 ans", value: 8 },
    { label: "≤ 12 ans", value: 12 },
    { label: "≤ 15 ans", value: 15 },
  ]

  return (
    <FamilyFitProvider>
      <div
        className="flex flex-col flex-1"
        style={{ background: p.bg, color: p.ink }}
      >
        <section
          className="py-10 md:py-14"
          style={{ background: p.bg, borderBottom: `1px solid ${p.line}` }}
        >
          <div className="container mx-auto px-4 md:px-8">
            <div
              className="text-[11px] font-semibold mb-2 uppercase tracking-wide"
              style={{ color: p.accent }}
            >
              Catalogue
            </div>
            <h1
              className={`${serifClass} text-3xl md:text-5xl font-medium m-0 leading-[1.05]`}
              style={{ color: p.ink, letterSpacing: "-0.02em" }}
            >
              Toutes les{" "}
              <em className="italic" style={{ color: p.accent }}>
                applications
              </em>
            </h1>
            <p className="mt-3 text-sm md:text-base max-w-2xl" style={{ color: p.ink2 }}>
              Les meilleures applications éducatives et de divertissement pour
              vos enfants.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {ageButtons.map((b) => {
                const active = maxAge === b.value
                return (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => setMaxAge(b.value)}
                    className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold transition-colors"
                    style={{
                      background: active ? p.ink : p.card,
                      color: active ? p.bg : p.ink,
                      border: `1px solid ${active ? p.ink : p.line}`,
                    }}
                  >
                    {b.label}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section className="flex-1 py-10 md:py-14" style={{ background: p.bg2 }}>
          <div className="container mx-auto px-4 md:px-8">
            <p className="text-sm mb-6" style={{ color: p.ink2 }}>
              {apps.length} application{apps.length !== 1 ? "s" : ""} trouvée
              {apps.length !== 1 ? "s" : ""}
            </p>

            {apps.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
                {apps.map((app) => (
                  <ApercuMediaCard
                    key={app.id}
                    media={app}
                    size="sm"
                    serifClass={serifClass}
                  />
                ))}
              </div>
            ) : (
              <div
                className="text-center py-16 rounded-2xl"
                style={{ background: p.card, border: `1px solid ${p.line}` }}
              >
                <Smartphone
                  className="h-12 w-12 mx-auto mb-4"
                  style={{ color: p.ink2, opacity: 0.4 }}
                />
                <h2
                  className={`${serifClass} text-2xl font-medium mb-2`}
                  style={{ color: p.ink, letterSpacing: "-0.02em" }}
                >
                  Aucune application trouvée
                </h2>
                <p className="text-sm mb-6" style={{ color: p.ink2 }}>
                  Essayez d&apos;élargir la tranche d&apos;âge.
                </p>
                <Link
                  href="/films"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
                  style={{ background: p.ink, color: p.bg }}
                >
                  Voir les films
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </FamilyFitProvider>
  )
}
