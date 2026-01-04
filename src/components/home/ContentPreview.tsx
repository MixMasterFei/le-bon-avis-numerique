"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Film, Tv, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface MediaItem {
  id: string
  title: string
  type: "MOVIE" | "TV"
  posterUrl: string | null
  expertAgeRec: number | null
  genres: string[]
}

export function ContentPreview() {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchContent() {
      try {
        // Fetch a mix of featured content
        const res = await fetch("/api/media/featured?limit=8&mixed=true")
        if (res.ok) {
          const data = await res.json()
          setItems(data.items || [])
        }
      } catch (error) {
        console.error("Failed to fetch content:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchContent()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Decouvrez notre selection</h2>
            <p className="text-sm text-gray-600">Films et series evalues par nos experts</p>
          </div>
        </div>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Decouvrez notre selection</h2>
          <p className="text-sm text-gray-600">Films et series evalues par nos experts</p>
        </div>
        <Button variant="ghost" size="sm" asChild className="text-primary">
          <Link href="/films">
            Voir tout <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/media/${item.type === "MOVIE" ? "film" : "serie"}-${item.id}`}
            className="group"
          >
            <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-100 shadow-sm group-hover:shadow-md transition-all">
              {item.posterUrl ? (
                <Image
                  src={item.posterUrl}
                  alt={item.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 25vw, (max-width: 768px) 16vw, 12.5vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {item.type === "MOVIE" ? (
                    <Film className="h-8 w-8 text-gray-300" />
                  ) : (
                    <Tv className="h-8 w-8 text-gray-300" />
                  )}
                </div>
              )}

              {/* Age Badge */}
              {item.expertAgeRec !== null && (
                <div className="absolute top-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                  {item.expertAgeRec}+
                </div>
              )}

              {/* Type Badge */}
              <div className="absolute bottom-1.5 left-1.5">
                <Badge
                  variant="secondary"
                  className={`text-[9px] px-1.5 py-0 ${
                    item.type === "MOVIE"
                      ? "bg-red-500/80 text-white"
                      : "bg-blue-500/80 text-white"
                  }`}
                >
                  {item.type === "MOVIE" ? "Film" : "Serie"}
                </Badge>
              </div>
            </div>
            <h3 className="mt-1.5 text-xs font-medium text-gray-700 line-clamp-1 group-hover:text-primary transition-colors">
              {item.title}
            </h3>
          </Link>
        ))}
      </div>
    </div>
  )
}
