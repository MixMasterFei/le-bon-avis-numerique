"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Tag, Trash2, Check, X, AlertTriangle, Loader2, Sparkles, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import Link from "next/link"
import Image from "next/image"

interface TagInfo {
  tag: string
  count: number
}

interface MediaItem {
  id: string
  title: string
  originalTitle?: string
  posterUrl?: string
  genres: string[]
  topics: string[]
  expertAgeRec?: number
  releaseDate?: string
}

function TagsAdminContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedTag = searchParams.get("tag")
  const mediaType = searchParams.get("type") || "MOVIE"

  const [tags, setTags] = useState<TagInfo[]>([])
  const [items, setItems] = useState<MediaItem[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmAction, setConfirmAction] = useState<"selected" | "all">("selected")
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [aiReviewLoading, setAiReviewLoading] = useState(false)
  const [aiReviewProgress, setAiReviewProgress] = useState<{
    reviewed: number
    removed: number
    kept: number
    totalRemaining: number
  } | null>(null)

  // Load tags or items based on selection
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const url = selectedTag
          ? `/api/admin/tags?tag=${encodeURIComponent(selectedTag)}&type=${mediaType}`
          : `/api/admin/tags?type=${mediaType}`

        const response = await fetch(url)
        const data = await response.json()

        if (data.success) {
          if (selectedTag) {
            setItems(data.items || [])
            setSelectedItems(new Set())
          } else {
            setTags(data.tags || [])
          }
        }
      } catch (error) {
        console.error("Failed to load data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [selectedTag, mediaType])

  const toggleItemSelection = (id: string) => {
    const newSelection = new Set(selectedItems)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    setSelectedItems(newSelection)
  }

  const selectAll = () => {
    setSelectedItems(new Set(items.map((item) => item.id)))
  }

  const deselectAll = () => {
    setSelectedItems(new Set())
  }

  const handleRemoveTag = async (action: "selected" | "all") => {
    if (!selectedTag) return

    setActionLoading(true)
    setMessage(null)

    try {
      const response = await fetch("/api/admin/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: action === "all" ? "remove_from_all" : "remove_from_selected",
          tag: selectedTag,
          mediaIds: action === "selected" ? Array.from(selectedItems) : undefined,
          type: mediaType,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: "success", text: data.message })
        // Reload items
        const reloadResponse = await fetch(
          `/api/admin/tags?tag=${encodeURIComponent(selectedTag)}&type=${mediaType}`
        )
        const reloadData = await reloadResponse.json()
        if (reloadData.success) {
          setItems(reloadData.items || [])
          setSelectedItems(new Set())
        }
      } else {
        setMessage({ type: "error", text: data.error || "Failed to remove tag" })
      }
    } catch {
      setMessage({ type: "error", text: "An error occurred" })
    } finally {
      setActionLoading(false)
      setShowConfirmDialog(false)
    }
  }

  // AI-powered tag review
  const handleAiReview = async (dryRun: boolean = false) => {
    if (!selectedTag) return

    setAiReviewLoading(true)
    setMessage(null)
    setAiReviewProgress(null)

    let totalReviewed = 0
    let totalRemoved = 0
    let totalKept = 0
    let offset = 0
    let hasMore = true

    try {
      while (hasMore) {
        const response = await fetch("/api/admin/tags/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tag: selectedTag,
            type: mediaType,
            limit: 20,
            offset,
            dryRun,
          }),
        })

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || "AI review failed")
        }

        totalReviewed += data.reviewed
        totalRemoved += data.removed
        totalKept += data.kept
        hasMore = data.hasMore
        offset = data.nextOffset

        setAiReviewProgress({
          reviewed: totalReviewed,
          removed: totalRemoved,
          kept: totalKept,
          totalRemaining: data.totalRemaining,
        })

        // Stop after first batch for dry run
        if (dryRun) {
          hasMore = false
        }
      }

      setMessage({
        type: "success",
        text: dryRun
          ? `Aperçu: ${totalRemoved} films à retirer, ${totalKept} à garder`
          : `Nettoyage terminé: ${totalRemoved} films retirés, ${totalKept} gardés`,
      })

      // Reload items if not dry run
      if (!dryRun) {
        const reloadResponse = await fetch(
          `/api/admin/tags?tag=${encodeURIComponent(selectedTag)}&type=${mediaType}`
        )
        const reloadData = await reloadResponse.json()
        if (reloadData.success) {
          setItems(reloadData.items || [])
          setSelectedItems(new Set())
        }
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "AI review failed",
      })
    } finally {
      setAiReviewLoading(false)
    }
  }

  // Problematic tags that might have false positives
  const problematicTags = ["Animaux", "Nature", "animaux", "nature", "Famille"]

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  // Tag list view
  if (!selectedTag) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Gestion des Tags</h1>
        </div>

        {/* Type selector */}
        <div className="flex gap-2 mb-6">
          {["MOVIE", "TV", "GAME"].map((type) => (
            <Button
              key={type}
              variant={mediaType === type ? "default" : "outline"}
              size="sm"
              onClick={() => router.push(`/admin/tags?type=${type}`)}
            >
              {type === "MOVIE" ? "Films" : type === "TV" ? "Séries" : "Jeux"}
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Tags existants ({tags.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tags.map(({ tag, count }) => (
                <Link
                  key={tag}
                  href={`/admin/tags?tag=${encodeURIComponent(tag)}&type=${mediaType}`}
                >
                  <Badge
                    variant={problematicTags.includes(tag) ? "destructive" : "secondary"}
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-sm py-1 px-3"
                  >
                    {tag}
                    <span className="ml-2 bg-black/20 rounded-full px-2 py-0.5 text-xs">
                      {count}
                    </span>
                    {problematicTags.includes(tag) && (
                      <AlertTriangle className="h-3 w-3 ml-1" />
                    )}
                  </Badge>
                </Link>
              ))}
            </div>

            {tags.length === 0 && (
              <p className="text-gray-500 text-center py-8">Aucun tag trouvé</p>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800">Tags à vérifier</h3>
              <p className="text-sm text-amber-700 mt-1">
                Les tags marqués en rouge peuvent contenir des faux positifs (ex: films d&apos;horreur
                tagués &quot;Animaux&quot; ou &quot;Nature&quot;). Cliquez dessus pour vérifier et nettoyer.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Items with selected tag view
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-8">
        <Link href={`/admin/tags?type=${mediaType}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux tags
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">
          Tag: <Badge variant="secondary" className="text-lg ml-2">{selectedTag}</Badge>
        </h1>
        <span className="text-gray-500">({items.length} items)</span>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.type === "success" ? (
            <Check className="h-5 w-5" />
          ) : (
            <X className="h-5 w-5" />
          )}
          {message.text}
        </div>
      )}

      {/* AI Review Section */}
      <Card className="mb-6 border-purple-200 bg-purple-50/50">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <div>
                <h3 className="font-medium text-purple-900">Nettoyage IA (GPT-4o)</h3>
                <p className="text-xs text-purple-700">
                  L&apos;IA analyse chaque film et retire les tags inappropriés
                </p>
              </div>
            </div>

            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAiReview(true)}
                disabled={aiReviewLoading || items.length === 0}
                className="border-purple-300 text-purple-700 hover:bg-purple-100"
              >
                {aiReviewLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Aperçu (20 premiers)
              </Button>

              <Button
                size="sm"
                onClick={() => handleAiReview(false)}
                disabled={aiReviewLoading || items.length === 0}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {aiReviewLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Nettoyer TOUT ({items.length})
              </Button>
            </div>
          </div>

          {aiReviewProgress && (
            <div className="mt-3 p-3 bg-white rounded border border-purple-200">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-600">
                  Analysés: <strong>{aiReviewProgress.reviewed}</strong>
                </span>
                <span className="text-green-600">
                  Gardés: <strong>{aiReviewProgress.kept}</strong>
                </span>
                <span className="text-red-600">
                  Retirés: <strong>{aiReviewProgress.removed}</strong>
                </span>
                <span className="text-gray-500">
                  Restants: <strong>{aiReviewProgress.totalRemaining}</strong>
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Actions bar */}
      <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedItems.size === items.length && items.length > 0}
            onCheckedChange={(checked) => (checked ? selectAll() : deselectAll())}
          />
          <span className="text-sm text-gray-600">
            {selectedItems.size} sélectionné(s)
          </span>
        </div>

        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setConfirmAction("selected")
              setShowConfirmDialog(true)
            }}
            disabled={selectedItems.size === 0 || actionLoading}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Retirer manuellement
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setConfirmAction("all")
              setShowConfirmDialog(true)
            }}
            disabled={items.length === 0 || actionLoading}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Retirer TOUS (manuel)
          </Button>
        </div>
      </div>

      {/* Items grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {items.map((item) => (
          <Card
            key={item.id}
            className={`cursor-pointer transition-all ${
              selectedItems.has(item.id)
                ? "ring-2 ring-primary bg-primary/5"
                : "hover:shadow-md"
            }`}
            onClick={() => toggleItemSelection(item.id)}
          >
            <div className="relative aspect-[2/3] bg-gray-100">
              {item.posterUrl ? (
                <Image
                  src={item.posterUrl}
                  alt={item.title}
                  fill
                  className="object-cover rounded-t-lg"
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  Pas d&apos;image
                </div>
              )}
              <div className="absolute top-2 left-2">
                <Checkbox
                  checked={selectedItems.has(item.id)}
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={() => toggleItemSelection(item.id)}
                />
              </div>
              {item.expertAgeRec && (
                <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {item.expertAgeRec}+
                </div>
              )}
            </div>
            <CardContent className="p-3">
              <h3 className="font-medium text-sm line-clamp-2">{item.title}</h3>
              {item.originalTitle && item.originalTitle !== item.title && (
                <p className="text-xs text-gray-500 line-clamp-1">{item.originalTitle}</p>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                {item.genres.slice(0, 2).map((genre) => (
                  <Badge key={genre} variant="outline" className="text-xs">
                    {genre}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {items.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Aucun item avec ce tag
        </div>
      )}

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression du tag</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "all" ? (
                <>
                  Êtes-vous sûr de vouloir retirer le tag <strong>&quot;{selectedTag}&quot;</strong>{" "}
                  de <strong>tous les {items.length} items</strong> ?
                </>
              ) : (
                <>
                  Êtes-vous sûr de vouloir retirer le tag <strong>&quot;{selectedTag}&quot;</strong>{" "}
                  des <strong>{selectedItems.size} items sélectionnés</strong> ?
                </>
              )}
              <br />
              <br />
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleRemoveTag(confirmAction)}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Loading fallback for Suspense
function TagsLoadingFallback() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </div>
  )
}

// Main page component with Suspense boundary
export default function TagsAdminPage() {
  return (
    <Suspense fallback={<TagsLoadingFallback />}>
      <TagsAdminContent />
    </Suspense>
  )
}
