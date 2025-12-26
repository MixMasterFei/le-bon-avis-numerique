"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Users, Film, Tv, Gamepad2, BookOpen, Smartphone } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MediaCard } from "@/components/media/MediaCard"
import { mockMediaItems } from "@/lib/mock-data"

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

export function RecommendationWizard() {
  const [age, setAge] = useState(8)
  const [selectedType, setSelectedType] = useState<WizardType>("ALL")
  const [activeChips, setActiveChips] = useState<Set<ChipKey>>(new Set())

  const recommendations = useMemo(() => {
    let items = mockMediaItems

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
  }, [activeChips, age, selectedType])

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

  return (
    <Card className="border-0 shadow-xl">
      <CardContent className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Pour votre enfant</h2>
            <p className="text-gray-600 mt-1">
              Ajustez l&apos;âge et quelques critères pour voir des recommandations en temps réel (mode démo).
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
                {recommendations.length} recommandation{recommendations.length !== 1 ? "s" : ""} (démo)
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



