"use client"

import { useState, type ReactNode } from "react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

interface MediaDetailTabsProps {
  reviewsCount: number
  reviewsContent: ReactNode
  detailsContent: ReactNode
}

type TabKey = "reviews" | "details"

export function MediaDetailTabs({
  reviewsCount,
  reviewsContent,
  detailsContent,
}: MediaDetailTabsProps) {
  const p = APERCU_PALETTE
  const [active, setActive] = useState<TabKey>("reviews")

  const tabs: { key: TabKey; label: string }[] = [
    { key: "reviews", label: `Avis (${reviewsCount})` },
    { key: "details", label: "Détails" },
  ]

  return (
    <div>
      <div className="flex gap-2 mb-5 flex-wrap">
        {tabs.map((t) => {
          const isActive = active === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className="px-4 py-2 rounded-full text-sm font-semibold transition-colors"
              style={{
                background: isActive ? p.ink : p.card,
                color: isActive ? p.bg : p.ink,
                border: `1px solid ${isActive ? p.ink : p.line}`,
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <div>{active === "reviews" ? reviewsContent : detailsContent}</div>
    </div>
  )
}
