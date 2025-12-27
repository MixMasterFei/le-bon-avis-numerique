"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MediaCard } from "@/components/media/MediaCard"
import { type MockMediaItem } from "@/lib/mock-data"

type WizardType = "all" | "movie" | "tv" | "game" | "book" | "app"

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

function RecosInner() {
  const sp = useSearchParams()
  const router = useRouter()

  const initialAge = Number(sp.get("age") || 8)
  const initialType = (sp.get("type") || "all").toLowerCase() as WizardType
  const initialChips = new Set<ChipKey>(
    (sp.get("chips") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as ChipKey[]
  )

  const [age, setAge] = useState(Number.isFinite(initialAge) ? Math.min(Math.max(initialAge, 2), 18) : 8)
  const [type, setType] = useState<WizardType>(initialType)
  const [chips, setChips] = useState<Set<ChipKey>>(initialChips)
  const [allMedia, setAllMedia] = useState<MockMediaItem[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch all media from database
  useEffect(() => {
    async function fetchMedia() {
      try {
        const res = await fetch("/api/db/media?limit=200")
        if (!res.ok) throw new Error("DB error")
        const data = await res.json()
        if (Array.isArray(data?.media)) {
          setAllMedia(data.media.map(mapDbToMockFormat))
        }
      } catch (error) {
        console.error("Failed to fetch media:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchMedia()
  }, [])

  // keep URL in sync (shareable)
  useEffect(() => {
    const qs = new URLSearchParams()
    qs.set("age", String(age))
    qs.set("type", type)
    if (chips.size > 0) qs.set("chips", Array.from(chips).join(","))
    router.replace(`/recommandations?${qs.toString()}`)
  }, [age, chips, router, type])

  const filtered = useMemo(() => {
    let items = allMedia

    if (type !== "all") {
      const t = type.toUpperCase()
      items = items.filter((m) => m.type === t)
    }

    items = items.filter((m) => (m.expertAgeRec ?? 99) <= age)

    for (const chip of questionChips) {
      if (chips.has(chip.key)) {
        items = items.filter((m) => (m.contentMetrics?.[chip.key] ?? 99) <= chip.max)
      }
    }

    return items
  }, [allMedia, age, chips, type])

  const toggleChip = (key: ChipKey) => {
    setChips((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Recommandations</h1>
          <p className="text-gray-600 mt-1">Chargement...</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="aspect-[2/3] bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Recommandations</h1>
        <p className="text-gray-600 mt-1">
          Sélection personnalisée basée sur l&apos;âge et vos critères.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-24">
            <CardContent className="p-6 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Âge</span>
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
                <Tabs value={type} onValueChange={(v) => setType(v as WizardType)}>
                  <TabsList className="w-full flex flex-wrap justify-start h-auto">
                    <TabsTrigger value="all">Tout</TabsTrigger>
                    <TabsTrigger value="movie">Films</TabsTrigger>
                    <TabsTrigger value="tv">Séries</TabsTrigger>
                    <TabsTrigger value="game">Jeux</TabsTrigger>
                    <TabsTrigger value="book">Livres</TabsTrigger>
                    <TabsTrigger value="app">Apps</TabsTrigger>
                  </TabsList>
                  <TabsContent value={type} />
                </Tabs>
              </div>

              <div className="space-y-3">
                <span className="text-sm font-medium text-gray-700">Préférences</span>
                <div className="flex flex-wrap gap-2">
                  {questionChips.map((chip) => (
                    <Badge
                      key={chip.key}
                      variant={chips.has(chip.key) ? "default" : "outline"}
                      className="cursor-pointer select-none"
                      onClick={() => toggleChip(chip.key)}
                    >
                      {chip.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button variant="outline" onClick={() => setChips(new Set())}>
                Réinitialiser
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600">
              {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>

          {filtered.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {filtered.map((m) => (
                <MediaCard key={`${m.type}:${m.id}`} media={m} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Aucun résultat</p>
              <p className="text-sm">Essayez d&apos;augmenter l&apos;âge ou de retirer un critère.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RecommandationsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8" />}>
      <RecosInner />
    </Suspense>
  )
}


