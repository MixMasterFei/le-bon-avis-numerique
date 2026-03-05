"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowLeft,
  Trash2,
  Loader2,
  Film,
  Tv,
  Gamepad2,
  Book,
  AlertTriangle,
  CheckCircle,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface LowQualityItem {
  id: string
  title: string
  type: string
  posterUrl: string | null
  synopsisFr: string | null
  releaseDate: string | null
  genres: string[]
  expertAgeRec: number | null
  dataQualityScore: number | null
  tmdbId: number | null
  igdbId: number | null
  createdAt: string
}

interface ApiResponse {
  items: LowQualityItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  byType: Record<string, number>
}

const typeIcons: Record<string, React.ReactNode> = {
  MOVIE: <Film className="h-4 w-4" />,
  TV: <Tv className="h-4 w-4" />,
  GAME: <Gamepad2 className="h-4 w-4" />,
  BOOK: <Book className="h-4 w-4" />,
}

const typeLabels: Record<string, string> = {
  MOVIE: "Films",
  TV: "Series",
  GAME: "Jeux",
  BOOK: "Livres",
}

export default function QualityManagementPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [maxScore, setMaxScore] = useState(30)
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")

  const fetchItems = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
        maxScore: maxScore.toString(),
      })
      if (typeFilter) params.set("type", typeFilter)

      const res = await fetch(`/api/admin/quality/low?${params}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error("Failed to fetch items:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, typeFilter, maxScore])

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const selectAll = () => {
    if (!data) return
    if (selectedIds.size === data.items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(data.items.map((item) => item.id)))
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return

    if (!confirm(`Supprimer ${selectedIds.size} element(s) selectionne(s) ?`)) {
      return
    }

    setDeleting(true)
    try {
      const res = await fetch("/api/admin/quality/low", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })

      if (res.ok) {
        const result = await res.json()
        alert(`${result.deleted} element(s) supprime(s)`)
        setSelectedIds(new Set())
        fetchItems()
      } else {
        alert("Erreur lors de la suppression")
      }
    } catch (err) {
      console.error("Delete error:", err)
      alert("Erreur de connexion")
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteAll = async () => {
    if (deleteConfirmText !== "SUPPRIMER") {
      alert("Veuillez taper SUPPRIMER pour confirmer")
      return
    }

    setDeleting(true)
    try {
      const res = await fetch("/api/admin/quality/low", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deleteAll: true,
          maxScore,
          type: typeFilter,
        }),
      })

      if (res.ok) {
        const result = await res.json()
        alert(`${result.deleted} element(s) supprime(s)`)
        setShowDeleteAllConfirm(false)
        setDeleteConfirmText("")
        fetchItems()
      } else {
        alert("Erreur lors de la suppression")
      }
    } catch (err) {
      console.error("Delete all error:", err)
      alert("Erreur de connexion")
    } finally {
      setDeleting(false)
    }
  }

  const getScoreColor = (score: number | null) => {
    if (score === null) return "bg-gray-200 text-gray-600"
    if (score < 20) return "bg-red-100 text-red-700"
    if (score < 30) return "bg-orange-100 text-orange-700"
    return "bg-yellow-100 text-yellow-700"
  }

  const getMissingFields = (item: LowQualityItem) => {
    const missing: string[] = []
    if (!item.posterUrl) missing.push("poster")
    if (!item.synopsisFr || item.synopsisFr.length < 50) missing.push("synopsis")
    if (!item.releaseDate) missing.push("date")
    if (!item.genres || item.genres.length === 0) missing.push("genres")
    if (item.expertAgeRec === null) missing.push("age")
    return missing
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Retour admin
        </Link>
        <h1 className="text-3xl font-bold mb-2">Gestion qualite</h1>
        <p className="text-gray-600">
          Visualiser et supprimer les fiches de faible qualite
        </p>
      </div>

      {/* Stats by type */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card
            className={`cursor-pointer transition-all ${
              typeFilter === null ? "ring-2 ring-blue-500" : ""
            }`}
            onClick={() => {
              setTypeFilter(null)
              setPage(1)
            }}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span className="text-2xl font-bold">{data.pagination.total}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Tous types</p>
            </CardContent>
          </Card>

          {Object.entries(data.byType).map(([type, count]) => (
            <Card
              key={type}
              className={`cursor-pointer transition-all ${
                typeFilter === type ? "ring-2 ring-blue-500" : ""
              }`}
              onClick={() => {
                setTypeFilter(type)
                setPage(1)
              }}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  {typeIcons[type]}
                  <span className="text-2xl font-bold">{count}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{typeLabels[type] || type}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Score max:</label>
              <select
                value={maxScore}
                onChange={(e) => {
                  setMaxScore(parseInt(e.target.value))
                  setPage(1)
                }}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="20">{"< 20 (tres faible)"}</option>
                <option value="30">{"< 30 (faible)"}</option>
                <option value="40">{"< 40"}</option>
                <option value="50">{"< 50"}</option>
              </select>
            </div>

            <div className="flex-1" />

            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={!data || data.items.length === 0}
            >
              {selectedIds.size === data?.items.length
                ? "Deselectionner tout"
                : "Selectionner page"}
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0 || deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Supprimer ({selectedIds.size})
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteAllConfirm(true)}
              disabled={!data || data.pagination.total === 0 || deleting}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Supprimer tout ({data?.pagination.total || 0})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete All Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Confirmer la suppression
              </CardTitle>
              <CardDescription>
                Cette action est irreversible. Vous allez supprimer{" "}
                <strong>{data?.pagination.total}</strong> elements
                {typeFilter && ` de type ${typeLabels[typeFilter] || typeFilter}`}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">
                Tapez <strong>SUPPRIMER</strong> pour confirmer:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full border rounded px-3 py-2 mb-4"
                placeholder="SUPPRIMER"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteAllConfirm(false)
                    setDeleteConfirmText("")
                  }}
                >
                  Annuler
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAll}
                  disabled={deleteConfirmText !== "SUPPRIMER" || deleting}
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Supprimer definitivement
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Items list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-gray-600">Aucun element de faible qualite trouve!</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3">
            {data.items.map((item) => {
              const missing = getMissingFields(item)
              return (
                <Card
                  key={item.id}
                  className={`transition-all ${
                    selectedIds.has(item.id) ? "ring-2 ring-blue-500 bg-blue-50" : ""
                  }`}
                >
                  <CardContent className="py-3">
                    <div className="flex items-center gap-4">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="h-5 w-5 rounded"
                      />

                      {/* Poster */}
                      <div className="w-12 h-16 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                        {item.posterUrl ? (
                          <Image
                            src={item.posterUrl}
                            alt={item.title}
                            width={48}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <X className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {typeIcons[item.type]}
                          <h3 className="font-medium truncate">{item.title}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${getScoreColor(
                              item.dataQualityScore
                            )}`}
                          >
                            Score: {item.dataQualityScore ?? 0}
                          </span>
                          {missing.map((field) => (
                            <span
                              key={field}
                              className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600"
                            >
                              {field}
                            </span>
                          ))}
                        </div>
                        {item.synopsisFr && (
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {item.synopsisFr.substring(0, 100)}...
                          </p>
                        )}
                      </div>

                      {/* External link */}
                      <div className="text-xs text-gray-400">
                        {item.tmdbId && <span>TMDB: {item.tmdbId}</span>}
                        {item.igdbId && <span>IGDB: {item.igdbId}</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} / {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
