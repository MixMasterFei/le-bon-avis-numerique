"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { RefreshCw, ArrowRight } from "lucide-react"
import { ApercuPreviewBanner } from "./ApercuPreviewBanner"
import { ApercuNav } from "./ApercuNav"
import { ApercuNewsHeroCard } from "./ApercuNewsHeroCard"
import { ApercuNewsCard, type ApercuNewsCardData } from "./ApercuNewsCard"
import { DecouverteHeader } from "./DecouverteHeader"
import { DecouverteRecentReleases } from "./DecouverteRecentReleases"
import { DecouverteCommunityLoved } from "./DecouverteCommunityLoved"
import { DecouverteFactOfWeek } from "./DecouverteFactOfWeek"
import { DecouverteWeekStats } from "./DecouverteWeekStats"
import { APERCU_PALETTE } from "./apercuTheme"
import type { DiscoverDigest } from "@/lib/discover-digest"
import type { FamilyFact } from "@/lib/family-facts"

interface DecouverteDigestProps {
  digest: DiscoverDigest
  fact: FamilyFact
  serifClass: string
  canRefresh: boolean
}

export function DecouverteDigest({
  digest,
  fact,
  serifClass,
  canRefresh,
}: DecouverteDigestProps) {
  const p = APERCU_PALETTE
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [refreshing, setRefreshing] = useState(false)

  async function onRefresh() {
    if (refreshing) return
    setRefreshing(true)
    try {
      await fetch("/api/admin/news-discover/refresh", { method: "POST" })
    } catch (err) {
      console.error(err)
    } finally {
      startTransition(() => router.refresh())
      setRefreshing(false)
    }
  }

  const refreshButton = canRefresh ? (
    <button
      type="button"
      onClick={onRefresh}
      disabled={refreshing}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-60"
      style={{ background: p.ink, color: p.bg }}
    >
      <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
      {refreshing ? "Synthèse en cours…" : "Rafraîchir"}
    </button>
  ) : null

  const hasAnyNews = digest.heroStory !== null || digest.recentStories.length > 0

  return (
    <div
      className="flex flex-col min-h-screen overflow-x-hidden"
      style={{ background: p.bg, color: p.ink }}
    >
      <ApercuPreviewBanner />
      <ApercuNav />

      <div className="container mx-auto px-4 md:px-8 py-8 md:py-10 flex flex-col gap-10">
        <DecouverteHeader
          serifClass={serifClass}
          lastSynthesisAt={digest.lastSynthesisAt}
          refreshSlot={refreshButton}
        />

        {digest.heroStory && (
          <section>
            <ApercuNewsHeroCard story={digest.heroStory} serifClass={serifClass} />
          </section>
        )}

        {digest.recentStories.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
              <h2
                className={`${serifClass} text-2xl md:text-3xl font-medium`}
                style={{ color: p.ink, letterSpacing: "-0.02em" }}
              >
                Actu de la{" "}
                <em className="italic" style={{ color: p.accent }}>
                  semaine
                </em>
              </h2>
              <Link
                href="/apercudecouverte/actualites"
                className="inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-70"
                style={{ color: p.ink }}
              >
                Toutes les actualités
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <NewsGrid stories={digest.recentStories} serifClass={serifClass} />
          </section>
        )}

        <DecouverteRecentReleases
          serifClass={serifClass}
          releases={digest.recentReleases}
        />

        <DecouverteCommunityLoved
          serifClass={serifClass}
          loved={digest.topLoved}
        />

        <DecouverteFactOfWeek fact={fact} serifClass={serifClass} />

        <DecouverteWeekStats stats={digest.weekStats} />

        {!hasAnyNews && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: p.card, border: `1px solid ${p.line}`, color: p.ink2 }}
          >
            La synthèse du jour est en cours. Revenez dans quelques heures.
          </div>
        )}
      </div>
    </div>
  )
}

function NewsGrid({ stories, serifClass }: { stories: ApercuNewsCardData[]; serifClass: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
      {stories.map((s) => (
        <ApercuNewsCard key={s.slug} story={s} serifClass={serifClass} />
      ))}
    </div>
  )
}
