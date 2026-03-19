"use client"

import { useState, useCallback } from "react"
import { Search, Film, Tv, Gamepad2, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import Image from "next/image"

interface QuickImportModalProps {
  open: boolean
  onClose: () => void
  defaultType?: "MOVIE" | "TV" | "GAME" | null
  onImportComplete?: () => void
}

interface SearchResult {
  id: number
  title: string
  originalTitle?: string
  posterUrl?: string
  releaseDate?: string
  overview?: string
}

export function QuickImportModal({
  open,
  onClose,
  defaultType,
  onImportComplete,
}: QuickImportModalProps) {
  const [mediaType, setMediaType] = useState<"MOVIE" | "TV" | "GAME">(
    defaultType || "MOVIE"
  )
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [importingId, setImportingId] = useState<number | null>(null)
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return

    setIsSearching(true)
    setError(null)

    try {
      const endpoint =
        mediaType === "MOVIE"
          ? "/api/tmdb/search"
          : mediaType === "TV"
          ? "/api/tmdb/search/tv"
          : "/api/igdb/search"

      const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`)
      const data = await res.json()

      if (data.results) {
        setResults(data.results)
      } else if (data.error) {
        setError(data.error)
        setResults([])
      }
    } catch {
      setError("Erreur lors de la recherche")
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [query, mediaType])

  const handleImport = async (item: SearchResult) => {
    setImportingId(item.id)
    setError(null)

    try {
      const endpoint =
        mediaType === "MOVIE"
          ? "/api/tmdb/import"
          : mediaType === "TV"
          ? "/api/tmdb/import/tv"
          : "/api/igdb/import"

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      })

      const data = await res.json()

      if (data.success || data.movie || data.series || data.game) {
        setImportedIds((prev) => new Set(prev).add(item.id))
        onImportComplete?.()
      } else {
        setError(data.error || "Erreur lors de l'import")
      }
    } catch {
      setError("Erreur lors de l'import")
    } finally {
      setImportingId(null)
    }
  }

  const handleClose = () => {
    setQuery("")
    setResults([])
    setImportedIds(new Set())
    setError(null)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Rechercher & Importer du contenu</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type selector & Search */}
          <div className="flex gap-2">
            <Select
              value={mediaType}
              onValueChange={(v) => {
                setMediaType(v as "MOVIE" | "TV" | "GAME")
                setResults([])
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MOVIE">
                  <div className="flex items-center gap-2">
                    <Film className="h-4 w-4" />
                    Film
                  </div>
                </SelectItem>
                <SelectItem value="TV">
                  <div className="flex items-center gap-2">
                    <Tv className="h-4 w-4" />
                    Série
                  </div>
                </SelectItem>
                <SelectItem value="GAME">
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4" />
                    Jeu
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Titre du contenu..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button onClick={handleSearch} disabled={isSearching || !query.trim()}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Results */}
          <div className="overflow-y-auto max-h-[50vh] space-y-2">
            {results.length === 0 && !isSearching && query && (
              <p className="text-center text-gray-500 py-8">
                Aucun résultat trouvé
              </p>
            )}

            {results.map((item) => {
              const isImported = importedIds.has(item.id)
              const isImporting = importingId === item.id

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50"
                >
                  {item.posterUrl ? (
                    <Image
                      src={item.posterUrl}
                      alt={item.title}
                      width={50}
                      height={75}
                      className="rounded object-cover"
                    />
                  ) : (
                    <div className="w-[50px] h-[75px] bg-gray-200 rounded flex items-center justify-center">
                      {mediaType === "MOVIE" && <Film className="h-6 w-6 text-gray-400" />}
                      {mediaType === "TV" && <Tv className="h-6 w-6 text-gray-400" />}
                      {mediaType === "GAME" && <Gamepad2 className="h-6 w-6 text-gray-400" />}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.title}</p>
                    {item.originalTitle && item.originalTitle !== item.title && (
                      <p className="text-sm text-gray-500 truncate">
                        {item.originalTitle}
                      </p>
                    )}
                    {item.releaseDate && (
                      <p className="text-sm text-gray-400">
                        {new Date(item.releaseDate).getFullYear()}
                      </p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant={isImported ? "outline" : "default"}
                    disabled={isImporting || isImported}
                    onClick={() => handleImport(item)}
                    className={isImported ? "text-green-600 border-green-600" : ""}
                  >
                    {isImporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isImported ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Importé
                      </>
                    ) : (
                      "Importer"
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
