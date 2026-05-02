"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Upload, Wrench, BarChart3, Activity, Sparkles, CalendarClock } from "lucide-react"
import {
  QuickActionsBar,
  ImportPresetsBar,
  StatsCollapsible,
  OperationsCenter,
  ActivityFeed,
  UserAnalytics,
} from "@/components/admin"
import { EnrichmentStockpile } from "@/components/admin/EnrichmentStockpile"
import { CronLogsSection } from "@/components/admin/CronLogsSection"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { fraunces } from "@/components/home-v2/apercuFont"

interface DashboardData {
  stats: {
    movies: number
    tv: number
    games: number
    books: number
    apps: number
    averageQualityScore: number
  }
  unenriched?: {
    total: number
    byType: Array<{ type: string; count: number }>
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
  const serifClass = fraunces.className

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
    <div
      className={`min-h-screen ${fraunces.variable}`}
      style={{ background: p.bg, color: p.ink }}
    >
      <div className="container mx-auto px-4 md:px-8 py-8 md:py-10 flex flex-col gap-10">
        <header>
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
            className={`${serifClass} text-3xl md:text-4xl font-medium leading-tight`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Maintenance & actions en masse
          </h1>
          <p className="text-sm mt-2 max-w-2xl" style={{ color: p.ink2 }}>
            Tous les outils manuels pour gérer le catalogue. Les chiffres et
            l&apos;état de santé système restent sur le{" "}
            <Link href="/admin" className="underline" style={{ color: p.ink }}>
              tableau de bord
            </Link>
            .
          </p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: p.ink2 }} />
          </div>
        ) : data ? (
          <>
            <Section
              icon={Upload}
              title="Importer du contenu"
              subtitle="Ajouter des œuvres au catalogue à la demande."
              serifClass={serifClass}
            >
              <div className="flex flex-col gap-4">
                <QuickActionsBar onImportComplete={fetchData} />
                <ImportPresetsBar onImportComplete={fetchData} />
              </div>
            </Section>

            {data.unenriched && (
              <Section
                icon={Sparkles}
                title="Stock à enrichir"
                subtitle="Œuvres en attente d'enrichissement IA, ventilées par format."
                serifClass={serifClass}
              >
                <EnrichmentStockpile
                  serifClass={serifClass}
                  total={data.unenriched.total}
                  byType={data.unenriched.byType}
                  variant="panel"
                />
              </Section>
            )}

            <Section
              icon={Wrench}
              title="Outils de maintenance"
              subtitle="Recherche par mot-clé + opérations groupées par domaine. Cliquez le titre d'un groupe pour le replier."
              serifClass={serifClass}
            >
              <OperationsCenter onComplete={fetchData} />
            </Section>

            <Section
              icon={CalendarClock}
              title="Jobs automatiques"
              subtitle="Dernières exécutions cron — santé par tâche et historique récent. Indicateur visible aussi sur le tableau de bord."
              serifClass={serifClass}
            >
              <CronLogsSection />
            </Section>

            <Section
              icon={BarChart3}
              title="Répartition du catalogue"
              subtitle="Volume par type et distribution des langues d'origine."
              serifClass={serifClass}
            >
              <StatsCollapsible
                stats={data.stats}
                languageDistribution={data.languageDistribution}
              />
            </Section>

            <Section
              icon={Activity}
              title="Activité récente"
              subtitle="Dernières actions admin et contributions de la communauté."
              serifClass={serifClass}
            >
              <div className="grid lg:grid-cols-2 gap-6">
                <ActivityFeed activities={data.recentActivity} />
                <UserAnalytics
                  topContributors={data.topContributors}
                  recentReviews={data.recentReviews}
                />
              </div>
            </Section>
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

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
  serifClass,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle: string
  children: React.ReactNode
  serifClass: string
}) {
  const p = APERCU_PALETTE
  return (
    <section>
      <div
        className="flex items-start gap-3 pb-4 mb-5"
        style={{ borderBottom: `1px solid ${p.line}` }}
      >
        <div
          className="flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 mt-0.5"
          style={{ background: p.bg2, color: p.accent }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h2
            className={`${serifClass} text-xl md:text-2xl font-medium leading-tight`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            {title}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: p.ink2 }}>
            {subtitle}
          </p>
        </div>
      </div>
      {children}
    </section>
  )
}
