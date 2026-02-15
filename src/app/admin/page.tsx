"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  Upload,
  Brain,
  Copy,
  Settings,
  ExternalLink,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Globe,
  Play,
  Sparkles,
  Database,
  ChevronDown,
  ChevronUp,
  Tag,
  Camera,
  Shield,
  FileDown,
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

  // Advanced action states
  const [computingQuality, setComputingQuality] = useState(false)
  const [cachingStreaming, setCachingStreaming] = useState(false)
  const [computingSimilarity, setComputingSimilarity] = useState(false)
  const [syncingDb, setSyncingDb] = useState(false)
  const [backfillingLanguage, setBackfillingLanguage] = useState(false)
  const [importingScreenshots, setImportingScreenshots] = useState(false)
  const [screenshotProgress, setScreenshotProgress] = useState<number>(0)
  const [screenshotStats, setScreenshotStats] = useState<{ total: number; withScreenshots: number; totalMedia: number } | null>(null)
  const [fixingTP, setFixingTP] = useState(false)
  const [fixTPStats, setFixTPStats] = useState<{ tousPublics: number; nonClasse: number } | null>(null)
  const [importingCNC, setImportingCNC] = useState(false)

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

  // Advanced actions
  const handleComputeQuality = async () => {
    setComputingQuality(true)
    let totalProcessed = 0
    let offset = 0

    try {
      while (true) {
        const res = await fetch("/api/admin/quality/compute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset, limit: 200 }),
        })
        const data = await res.json()

        if (!res.ok) {
          alert(`Erreur: ${data.error || "Echec du recalcul"}`)
          break
        }

        totalProcessed += data.processed || 0

        if (data.done || !data.nextOffset) {
          alert(`Recalcul termine! Total traite: ${totalProcessed}`)
          handleRefresh()
          break
        }

        offset = data.nextOffset
      }
    } catch (err) {
      console.error("Failed to compute quality:", err)
      alert(`Erreur de connexion\n\nTraites avant erreur: ${totalProcessed}`)
    } finally {
      setComputingQuality(false)
    }
  }

  const handleCacheStreaming = async () => {
    setCachingStreaming(true)
    try {
      const res = await fetch("/api/admin/streaming/cache", { method: "POST" })
      if (res.ok) handleRefresh()
    } catch (err) {
      console.error("Failed to cache streaming:", err)
    } finally {
      setCachingStreaming(false)
    }
  }

  const handleComputeSimilarity = async () => {
    setComputingSimilarity(true)
    try {
      const res = await fetch("/api/admin/similarity/compute", { method: "POST" })
      if (res.ok) handleRefresh()
    } catch (err) {
      console.error("Failed to compute similarity:", err)
    } finally {
      setComputingSimilarity(false)
    }
  }

  const handleSyncDb = async () => {
    setSyncingDb(true)
    try {
      const res = await fetch("/api/admin/db/sync", { method: "POST" })
      const data = await res.json()
      if (data.success) {
        alert("Schema synchronise avec succes!")
        handleRefresh()
      } else {
        alert(`Erreur: ${data.error}`)
      }
    } catch (err) {
      console.error("Failed to sync database:", err)
      alert("Erreur de synchronisation")
    } finally {
      setSyncingDb(false)
    }
  }

  const handleBackfillLanguage = async () => {
    setBackfillingLanguage(true)
    let totalProcessed = 0
    let totalErrors = 0
    let offset = 0

    try {
      while (true) {
        const res = await fetch("/api/admin/db/backfill-language", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 50, offset }),
        })
        const data = await res.json()

        if (!res.ok) {
          alert(`Erreur: ${data.error || "Echec du backfill"}`)
          break
        }

        totalProcessed += data.processed || 0
        totalErrors += data.errors || 0

        if (data.done || !data.nextOffset) {
          alert(`Backfill termine!\n\nTotal traite: ${totalProcessed}\nErreurs: ${totalErrors}`)
          handleRefresh()
          break
        }

        offset = data.nextOffset
      }
    } catch (err) {
      console.error("Failed to backfill language:", err)
      alert(`Erreur de connexion\n\nTraites avant erreur: ${totalProcessed}`)
    } finally {
      setBackfillingLanguage(false)
    }
  }

  const handleImportScreenshots = async () => {
    setImportingScreenshots(true)
    setScreenshotProgress(0)
    let totalImported = 0
    let totalProcessed = 0
    let hasMore = true
    const chunkSize = 10
    let consecutiveErrors = 0

    try {
      while (hasMore) {
        const res = await fetch("/api/admin/screenshots/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaType: "ALL",
            limit: chunkSize,
            screenshotsPerMedia: 6,
            skipExisting: true,
          }),
        })
        const data = await res.json()

        if (!res.ok || !data.success) {
          alert(`Erreur: ${data.error || "Echec de l'import"}`)
          break
        }

        totalImported += data.stats.imported || 0
        totalProcessed += data.stats.total || 0

        // If we processed fewer items than chunk size, we're done
        if (data.stats.total < chunkSize) {
          hasMore = false
        }

        // Detect rate limiting: only count chunks with actual API errors
        // (skipped items = no images available, not rate limiting)
        const chunkErrors = data.stats.errors || 0
        if (chunkErrors > 0 && (data.stats.imported || 0) === 0) {
          consecutiveErrors++
          if (consecutiveErrors >= 2) {
            alert(`Import suspendu: l'API externe semble limiter les requetes.\n\nImportes: ${totalImported}\nErreurs: ${chunkErrors}\nRelancez plus tard pour continuer.`)
            break
          }
        } else {
          consecutiveErrors = 0
        }

        // Update stats and progress after each chunk
        const statsRes = await fetch("/api/admin/screenshots/import")
        if (statsRes.ok) {
          const statsData = await statsRes.json()
          const newWithScreenshots = statsData.mediaWithScreenshots
          const totalMedia = statsData.mediaByType?.reduce((sum: number, t: { _count: { id: number } }) => sum + t._count.id, 0) || 0
          setScreenshotStats({
            total: statsData.totalScreenshots,
            withScreenshots: newWithScreenshots,
            totalMedia,
          })
          if (totalMedia > 0) {
            setScreenshotProgress(Math.round((newWithScreenshots / totalMedia) * 100))
          }
        }

        // Longer delay between chunks to avoid rate limiting
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
      }

      if (consecutiveErrors < 2) {
        alert(`Import termine!\n\nTotal traite: ${totalProcessed}\nScreenshots importes: ${totalImported}`)
      }
    } catch (err) {
      console.error("Failed to import screenshots:", err)
      alert(`Erreur lors de l'import des screenshots\n\nImportes avant erreur: ${totalImported}`)
    } finally {
      setImportingScreenshots(false)
      setScreenshotProgress(0)
    }
  }

  const handleFixTP = async () => {
    setFixingTP(true)
    let totalProcessed = 0
    let totalResetToNull = 0
    let totalUpdatedToReal = 0
    let totalKeptAsTP = 0
    let totalErrors = 0

    try {
      while (true) {
        const res = await fetch("/api/admin/fix-default-tp", { method: "POST" })
        const data = await res.json()

        if (!res.ok || !data.success) {
          alert(`Erreur: ${data.error || "Echec de la correction"}`)
          break
        }

        totalProcessed += data.processed || 0
        totalResetToNull += data.resetToNull || 0
        totalUpdatedToReal += data.updatedToReal || 0
        totalKeptAsTP += data.keptAsTP || 0
        totalErrors += data.errors || 0

        // Update stats live
        if (data.remainingTP !== undefined) {
          setFixTPStats({ tousPublics: data.remainingTP, nonClasse: 0 })
        }

        if (data.done) {
          alert(`Correction terminee!\n\nTraites: ${totalProcessed}\nRemis a null: ${totalResetToNull}\nMis a jour: ${totalUpdatedToReal}\nConfirmes TP: ${totalKeptAsTP}\nErreurs: ${totalErrors}`)
          handleRefresh()
          const statsRes = await fetch("/api/admin/fix-default-tp")
          if (statsRes.ok) {
            const stats = await statsRes.json()
            setFixTPStats({ tousPublics: stats.tousPublics, nonClasse: stats.nonClasse })
          }
          break
        }

        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (err) {
      console.error("Failed to fix TP:", err)
      alert(`Erreur lors de la correction\n\nTraites avant erreur: ${totalProcessed}\nRemis a null: ${totalResetToNull}`)
    } finally {
      setFixingTP(false)
    }
  }

  const handleImportCNC = async () => {
    setImportingCNC(true)
    let totalProcessed = 0
    let totalMatched = 0
    let totalUpdated = 0
    let totalNoMatch = 0
    let totalErrors = 0

    try {
      while (true) {
        const res = await fetch("/api/admin/import-cnc-ratings", { method: "POST" })
        const data = await res.json()

        if (!res.ok || !data.success) {
          alert(`Erreur: ${data.error || "Echec de l'import CNC"}`)
          break
        }

        totalProcessed += data.processed || 0
        totalMatched += data.matched || 0
        totalUpdated += data.updated || 0
        totalNoMatch += data.noMatch || 0
        totalErrors += data.errors || 0

        if (data.done || !data.nextOffset) {
          alert(`Import CNC termine!\n\nTraites: ${totalProcessed}\nCorrespondances: ${totalMatched}\nMis a jour: ${totalUpdated}\nSans correspondance: ${totalNoMatch}\nErreurs: ${totalErrors}`)
          handleRefresh()
          // Refresh TP stats
          const statsRes = await fetch("/api/admin/fix-default-tp")
          if (statsRes.ok) {
            const stats = await statsRes.json()
            setFixTPStats({ tousPublics: stats.tousPublics, nonClasse: stats.nonClasse })
          }
          break
        }

        // Small delay between chunks
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (err) {
      console.error("Failed to import CNC:", err)
      alert(`Erreur lors de l'import CNC\n\nTraites avant erreur: ${totalProcessed}\nMis a jour: ${totalUpdated}`)
    } finally {
      setImportingCNC(false)
    }
  }

  // Fetch screenshot stats on mount
  useEffect(() => {
    const fetchScreenshotStats = async () => {
      try {
        const res = await fetch("/api/admin/screenshots/import")
        if (res.ok) {
          const data = await res.json()
          const totalMedia = data.mediaByType?.reduce((sum: number, t: { _count: { id: number } }) => sum + t._count.id, 0) || 0
          setScreenshotStats({
            total: data.totalScreenshots,
            withScreenshots: data.mediaWithScreenshots,
            totalMedia,
          })
        }
      } catch (err) {
        console.error("Failed to fetch screenshot stats:", err)
      }
    }
    fetchScreenshotStats()

    const fetchTPStats = async () => {
      try {
        const res = await fetch("/api/admin/fix-default-tp")
        if (res.ok) {
          const data = await res.json()
          setFixTPStats({ tousPublics: data.tousPublics, nonClasse: data.nonClasse })
        }
      } catch (err) {
        console.error("Failed to fetch TP stats:", err)
      }
    }
    fetchTPStats()
  }, [])

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
            Gerez le contenu et suivez l'activite de la plateforme.
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
      <h2 className="text-lg font-semibold text-gray-700 mb-3">Outils d'administration</h2>
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

      {/* Advanced Actions - Collapsible */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setShowAdvanced(!showAdvanced)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Actions avancees
            </CardTitle>
            {showAdvanced ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
          <CardDescription>
            Maintenance de la base de donnees et recalculs
          </CardDescription>
        </CardHeader>

        {showAdvanced && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <Button
                onClick={handleSyncDb}
                disabled={syncingDb}
                variant="outline"
                size="sm"
                className="border-green-300 hover:bg-green-50"
              >
                {syncingDb ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                Sync schema DB
              </Button>

              <Button
                onClick={handleBackfillLanguage}
                disabled={backfillingLanguage}
                variant="outline"
                size="sm"
                className="border-blue-300 hover:bg-blue-50"
              >
                {backfillingLanguage ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4 mr-2" />
                )}
                Backfill langues
              </Button>

              <Button
                onClick={handleComputeQuality}
                disabled={computingQuality}
                variant="outline"
                size="sm"
                className="border-yellow-300 hover:bg-yellow-50"
              >
                {computingQuality ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Recalculer qualite
              </Button>

              <Button
                onClick={handleCacheStreaming}
                disabled={cachingStreaming}
                variant="outline"
                size="sm"
                className="border-purple-300 hover:bg-purple-50"
              >
                {cachingStreaming ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                MAJ streaming
              </Button>

              <Button
                onClick={handleComputeSimilarity}
                disabled={computingSimilarity}
                variant="outline"
                size="sm"
                className="border-indigo-300 hover:bg-indigo-50"
              >
                {computingSimilarity ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Similarites
              </Button>

              <Button
                onClick={handleImportScreenshots}
                disabled={importingScreenshots}
                variant="outline"
                size="sm"
                className="border-cyan-300 hover:bg-cyan-50"
              >
                {importingScreenshots ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 mr-2" />
                )}
                {importingScreenshots && screenshotProgress > 0 ? (
                  <span>{screenshotProgress}%</span>
                ) : (
                  <>
                    Screenshots
                    {screenshotStats && (
                      <span className="ml-1 text-xs text-gray-500">
                        ({screenshotStats.withScreenshots}/{screenshotStats.totalMedia})
                      </span>
                    )}
                  </>
                )}
              </Button>

              <Button
                onClick={handleFixTP}
                disabled={fixingTP}
                variant="outline"
                size="sm"
                className="border-amber-300 hover:bg-amber-50"
              >
                {fixingTP ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Fix faux TP
                {fixTPStats && (
                  <span className="ml-1 text-xs text-gray-500">
                    ({fixTPStats.tousPublics} TP)
                  </span>
                )}
              </Button>

              <Button
                onClick={handleImportCNC}
                disabled={importingCNC}
                variant="outline"
                size="sm"
                className="border-emerald-300 hover:bg-emerald-50"
              >
                {importingCNC ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                Import CNC
              </Button>
            </div>

            {/* Quick Links */}
            <div className="mt-4 pt-4 border-t">
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
