"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import {
  ActionItemsSection,
  QuickActionsBar,
  ImportPresetsBar,
  StatsCollapsible,
  CronLogsSection,
  SystemHealthOverview,
  OperationsCenter,
  ActivityFeed,
  UserAnalytics,
} from "@/components/admin"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

interface DashboardData {
  stats: {
    movies: number
    tv: number
    games: number
    books: number
    apps: number
    averageQualityScore: number
  }
  actionItems: {
    pendingCorrections: number
    pendingContentRequests: number
    lowQualityItems: number
    pendingReports: number
  }
  recentActivity: Array<{
    id: string
    action: string
    entityType: string
    entityId: string | null
    details: string | null
    createdAt: string
    user: {
      id: string
      name: string | null
      email: string | null
      image: string | null
    }
  }>
  topContributors: Array<{
    user: {
      id: string
      name: string | null
      email: string | null
      image: string | null
    }
    reviewCount: number
  }>
  recentReviews: Array<{
    id: string
    rating: number
    comment: string | null
    createdAt: string
    user: {
      id: string
      name: string | null
      email: string | null
    } | null
    media: {
      id: string
      title: string
      type: string
    }
  }>
  languageDistribution: Array<{ language: string | null; count: number }>
}

export default function AdminOperationsPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const p = APERCU_PALETTE

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard")
      if (res.ok) setData(await res.json())
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="min-h-screen" style={{ background: p.bg, color: p.ink }}>
      <div className="container mx-auto px-4 md:px-8 py-8 md:py-10 flex flex-col gap-6">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm mb-4 hover:opacity-70"
            style={{ color: p.ink2 }}
          >
            <ArrowLeft className="w-4 h-4" />
            Tableau de bord
          </Link>
          <div
            className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
            style={{ color: p.accent }}
          >
            Opérations
          </div>
          <h1
            className="text-3xl md:text-4xl font-medium leading-tight"
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Maintenance & actions en masse
          </h1>
          <p className="text-sm mt-2 max-w-2xl" style={{ color: p.ink2 }}>
            Tous les outils de gestion de contenu et de maintenance du catalogue.
            Les chiffres clés restent sur le tableau de bord.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: p.ink2 }} />
          </div>
        ) : data ? (
          <>
            <ActionItemsSection
              pendingCorrections={data.actionItems.pendingCorrections}
              pendingContentRequests={data.actionItems.pendingContentRequests}
              lowQualityItems={data.actionItems.lowQualityItems}
              pendingReports={data.actionItems.pendingReports}
            />

            <QuickActionsBar onImportComplete={fetchData} />
            <ImportPresetsBar onImportComplete={fetchData} />

            <StatsCollapsible
              stats={data.stats}
              languageDistribution={data.languageDistribution}
            />

            <CronLogsSection />

            <SystemHealthOverview />

            <OperationsCenter onComplete={fetchData} />

            <div className="grid lg:grid-cols-2 gap-6">
              <ActivityFeed activities={data.recentActivity} />
              <UserAnalytics
                topContributors={data.topContributors}
                recentReviews={data.recentReviews}
              />
            </div>
          </>
        ) : (
          <div className="text-center py-20" style={{ color: p.ink2 }}>
            Impossible de charger les données.
          </div>
        )}
      </div>
    </div>
  )
}
