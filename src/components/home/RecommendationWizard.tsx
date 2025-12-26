"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Users, Film, Tv, Gamepad2, BookOpen, Smartphone } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MediaCard } from "@/components/media/MediaCard"
import { type MockMediaItem } from "@/lib/mock-data"

type WizardType = "ALL" | "MOVIE" | "TV" | "GAME" | "BOOK" | "APP"

const typeConfig: Array<{ value: WizardType; label: string; icon: any }> = [
  { value: "ALL", label: "Tout", icon: Users },
  { value: "MOVIE", label: "Films", icon: Film },
  { value: "TV", label: "Séries", icon: Tv },
  { value: "GAME", label: "Jeux", icon: Gamepad2 },
  { value: "BOOK", label: "Livres", icon: BookOpen },
  { value: "APP", label: "Apps", icon: Smartphone },
]

const questionChips = [
  { key: "violence", label: "Peu de violence", max: 2 },
  { key: "language", label: "Peu de langage grossier", max: 2 },
  { key: "sexNudity", label: "Peu de nudité", max: 1 },
  { key: "substanceUse", label: "Pas d'alcool/drogues", max: 1 },
] as const

type ChipKey = (typeof questionChips)[number]["key"]

interface DbMedia {
  id: string
  title: string
  originalTitle?: string
  synopsisFr?: string
  posterUrl: string
  releaseDate?: string
  type: string
  expertAgeRec?: number | null
  communityAgeRec?: number | null
  genres?: string[]
  platforms?: string[]
  topics?: string[]
  contentMetrics?: any
}

function mapDbToMockFormat(media: DbMedia): MockMediaItem {
  return {
    id: media.id,
    title: media.title,
    originalTitle: media.originalTitle,
    type: media.type as MockMediaItem["type"],
    releaseDate: media.releaseDate ?? null,
    posterUrl: media.posterUrl || "/placeholder-poster.jpg",
    synopsisFr: media.synopsisFr ?? null,
    officialRating: null,
    expertAgeRec: media.expertAgeRec ?? null,
    communityAgeRec: media.communityAgeRec ?? null,
    genres: media.genres || [],
    platforms: media.platforms || [],
    topics: media.topics || [],
    contentMetrics: media.contentMetrics || {
      violence: 0,
      sexNudity: 0,
      language: 0,
      consumerism: 0,
      substanceUse: 0,
      positiveMessages: 0,
      roleModels: 0,
      whatParentsNeedToKnow: [],
    },
    reviews: [],
  }
}

export function RecommendationWizard() {
  const [age, setAge] = useState(8)
  const [selectedType, setSelectedType] = useState<WizardType>("ALL")
  const [activeChips, setActiveChips] = useState<Set<ChipKey>>(new Set())
  const [allMedia, setAllMedia] = useState<MockMediaItem[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch all media from database
  useEffect(() => {
    async function fetchMedia() {
      try {
        const res = await fetch("/api/db/media?limit=100")
        if (!res.ok) throw new Error("DB error")
        const data = await res.json()
        if (Array.isArray(data?.media)) {
          setAllMedia(data.media.map(mapDbToMockFormat))
        }
      } catch (error) {
        console.error("Failed to fetch media for recommendations:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchMedia()
  }, [])

  const recommendations = useMemo(() => {
    let items = allMedia

    if (selectedType !== "ALL") {
      items = items.filter((m) => m.type === selectedType)
    }

    items = items.filter((m) => (m.expertAgeRec ?? 99) <= age)

    for (const chip of questionChips) {
      if (activeChips.has(chip.key)) {
        items = items.filter((m) => (m.contentMetrics?.[chip.key] ?? 99) <= chip.max)
      }
    }

    // Prefer higher positive messaging / role models
    items = [...items].sort((a, b) => {
      const aScore = (a.contentMetrics?.positiveMessages ?? 0) + (a.contentMetrics?.roleModels ?? 0)
      const bScore = (b.contentMetrics?.positiveMessages ?? 0) + (b.contentMetrics?.roleModels ?? 0)
      return bScore - aScore
    })

    return items
  }, [allMedia, activeChips, age, selectedType])

  const preview = recommendations.slice(0, 8)

  const toggleChip = (key: ChipKey) => {
    setActiveChips((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const href = `/recommandations?age=${age}&type=${selectedType.toLowerCase()}&chips=${encodeURIComponent(
    Array.from(activeChips).join(",")
  )}`

  if (loading) {
    return (
      <Card className="border-0 shadow-xl">
        <CardContent className="p-6 md:p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-8"></div>
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-[2/3] bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (allMedia.length === 0) {
    return null // Don't show wizard if no media in database
  }

  return (
    <Card className="border-0 shadow-xl">
      <CardContent className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Pour votre enfant</h2>
            <p className="text-gray-600 mt-1">
              Ajustez l&apos;âge et quelques critères pour voir des recommandations personnalisées.
            </p>
          </div>
          <Button asChild>
            <Link href={href}>Voir toutes les recommandations</Link>
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="lg:col-span-1 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Âge de l&apos;enfant</span>
                <Badge className="bg-primary">{age} ans</Badge>
              </div>
              <div className="px-2">
                <Slider value={[age]} onValueChange={(v) => setAge(v[0])} min={2} max={18} step={1} />
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>2</span>
                  <span>18</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-sm font-medium text-gray-700">Catégorie</span>
              <Tabs value={selectedType} onValueChange={(v) => setSelectedType(v as WizardType)}>
                <TabsList className="w-full flex flex-wrap justify-start h-auto">
                  {typeConfig.map((t) => (
                    <TabsTrigger key={t.value} value={t.value} className="gap-2">
                      <t.icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{t.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-3">
              <span className="text-sm font-medium text-gray-700">Préférences rapides</span>
              <div className="flex flex-wrap gap-2">
                {questionChips.map((chip) => (
                  <Badge
                    key={chip.key}
                    variant={activeChips.has(chip.key) ? "default" : "outline"}
                    className="cursor-pointer select-none"
                    onClick={() => toggleChip(chip.key)}
                  >
                    {chip.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-600">
                {recommendations.length} recommandation{recommendations.length !== 1 ? "s" : ""}
              </p>
              <Button variant="outline" asChild>
                <Link href={href}>Tout voir</Link>
              </Button>
            </div>

            {preview.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="grid grid-flow-col auto-cols-[minmax(160px,180px)] sm:auto-cols-[minmax(180px,200px)] gap-4">
                  {preview.map((m) => (
                    <MediaCard key={`${m.type}:${m.id}`} media={m} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Aucune recommandation</p>
                <p className="text-sm">Essayez de retirer un critère ou d&apos;augmenter l&apos;âge.</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
