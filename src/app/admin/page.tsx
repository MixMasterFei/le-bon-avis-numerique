"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  Upload,
  Brain,
  Copy,
  Settings,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Tag,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ActionItemsSection,
  QuickActionsBar,
  ImportPresetsBar,
  StatsCollapsible,
  ActivityFeed,
  UserAnalytics,
  CronLogsSection,
  SystemHealthOverview,
  OperationsCenter,
} from "@/components/admin"

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

export default function AdminDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard")
      if (res.ok) {
        const data = await res.json()
        setDashboardData(data)
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const handleRefresh = () => {
    setLoading(true)
    fetchDashboardData()
  }

  const adminSections = [
    {
      title: "Import en masse",
      description: "Importer des films et jeux depuis TMDB/IGDB",
      href: "/admin/import/bulk",
      icon: Upload,
      color: "bg-blue-500",
    },
    {
      title: "Enrichissement IA",
      description: "Evaluer automatiquement les contenus avec OpenAI",
      href: "/admin/enrich",
      icon: Brain,
      color: "bg-purple-500",
    },
    {
      title: "Deduplication",
      description: "Trouver et fusionner les doublons",
      href: "/admin/dedupe",
      icon: Copy,
      color: "bg-orange-500",
    },
    {
      title: "Gestion qualite",
      description: "Voir et supprimer les fiches de faible qualite",
      href: "/admin/quality",
      icon: AlertTriangle,
      color: "bg-red-500",
    },
    {
      title: "Gestion des tags",
      description: "Verifier et nettoyer les tags thematiques",
      href: "/admin/tags",
      icon: Tag,
      color: "bg-teal-500",
    },
  ]

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Administration</h1>
          <p className="text-gray-600">
            Gerez le contenu et suivez l&apos;activite de la plateforme.
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Action Items - Shows pending work */}
      {dashboardData && (
        <ActionItemsSection
          pendingCorrections={dashboardData.actionItems.pendingCorrections}
          pendingContentRequests={dashboardData.actionItems.pendingContentRequests}
          lowQualityItems={dashboardData.actionItems.lowQualityItems}
          pendingReports={dashboardData.actionItems.pendingReports}
        />
      )}

      {/* Quick Actions - Search & Import */}
      <QuickActionsBar onImportComplete={handleRefresh} />

      {/* Import Presets */}
      <ImportPresetsBar onImportComplete={handleRefresh} />

      {/* Stats - Collapsible */}
      {dashboardData && (
        <StatsCollapsible
          stats={dashboardData.stats}
          languageDistribution={dashboardData.languageDistribution}
        />
      )}

      {/* Cron Jobs - Automated task history */}
      <div className="mb-6">
        <CronLogsSection />
      </div>

      {/* Two columns: Activity Feed & User Analytics */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Activity Feed */}
        {dashboardData && (
          <ActivityFeed activities={dashboardData.recentActivity} />
        )}

        {/* User Analytics */}
        {dashboardData && (
          <div className="space-y-4">
            <UserAnalytics
              topContributors={dashboardData.topContributors}
              recentReviews={dashboardData.recentReviews}
            />
          </div>
        )}
      </div>

      {/* Admin Sections */}
      <h2 className="text-lg font-semibold text-gray-700 mb-3">Outils d&apos;administration</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {adminSections.map((section) => {
          const Icon = section.icon
          return (
            <Link key={section.href} href={section.href}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg text-white ${section.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{section.title}</p>
                      <p className="text-xs text-gray-500">{section.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Operations Center - Collapsible */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setShowAdvanced(!showAdvanced)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Centre d&apos;operations
            </CardTitle>
            {showAdvanced ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
          <CardDescription>
            Sante des donnees, maintenance et imports
          </CardDescription>
        </CardHeader>

        {showAdvanced && (
          <CardContent>
            {/* System Health Overview */}
            <SystemHealthOverview />

            {/* Operations Grid */}
            <OperationsCenter onComplete={handleRefresh} />

            {/* Quick Links */}
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm text-gray-500 mb-2">Liens rapides</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/films"
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors"
                >
                  Films
                </Link>
                <Link
                  href="/series"
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors"
                >
                  Series
                </Link>
                <Link
                  href="/jeux"
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors"
                >
                  Jeux
                </Link>
                <Link
                  href="/"
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors"
                >
                  Accueil
                </Link>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
