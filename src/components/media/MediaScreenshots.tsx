"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Camera, X, ChevronLeft, ChevronRight } from "lucide-react"

interface Screenshot {
  id: string
  url: string
  width?: number | null
  height?: number | null
  order: number
}

interface MediaScreenshotsProps {
  screenshots: Screenshot[]
  title: string
  className?: string
  isAdmin?: boolean
  onDeleteScreenshot?: (id: string) => void
}

export function MediaScreenshots({ screenshots, title, className, isAdmin, onDeleteScreenshot }: MediaScreenshotsProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  if (!screenshots || screenshots.length === 0) {
    return null
  }

  // Deduplicate by URL (catches exact duplicates from double-imports)
  // and remove near-duplicates by extracting the TMDB file path base
  const seen = new Set<string>()
  const uniqueScreenshots = screenshots.filter((s) => {
    if (seen.has(s.url)) return false
    seen.add(s.url)
    return true
  })

  // Sort by order, cap at 6 for display
  const sortedScreenshots = [...uniqueScreenshots]
    .sort((a, b) => a.order - b.order)
    .slice(0, 6)

  const openLightbox = (index: number) => {
    setCurrentIndex(index)
    setLightboxOpen(true)
  }

  const closeLightbox = () => {
    setLightboxOpen(false)
  }

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? sortedScreenshots.length - 1 : prev - 1))
  }

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === sortedScreenshots.length - 1 ? 0 : prev + 1))
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") closeLightbox()
    if (e.key === "ArrowLeft") goToPrevious()
    if (e.key === "ArrowRight") goToNext()
  }

  return (
    <>
      <Card className={cn("", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-500" />
            Captures d'ecran
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {sortedScreenshots.map((screenshot, index) => (
              <div key={screenshot.id} className="relative group">
                <button
                  onClick={() => openLightbox(index)}
                  className="relative w-full aspect-video overflow-hidden rounded-lg bg-gray-100 hover:ring-2 hover:ring-blue-500 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <Image
                    src={screenshot.url}
                    alt={`${title} - Capture ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                </button>
                {isAdmin && onDeleteScreenshot && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm("Supprimer cette capture ?")) {
                        onDeleteScreenshot(screenshot.id)
                      }
                    }}
                    className="absolute top-1 right-1 z-10 p-1 rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    aria-label="Supprimer cette capture"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="dialog"
          aria-modal="true"
          aria-label="Image gallery"
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Fermer"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Previous button */}
          {sortedScreenshots.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                goToPrevious()
              }}
              className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Image precedente"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}

          {/* Main image */}
          <div
            className="relative max-w-5xl max-h-[85vh] w-full h-full mx-16"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={sortedScreenshots[currentIndex].url}
              alt={`${title} - Capture ${currentIndex + 1}`}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
          </div>

          {/* Next button */}
          {sortedScreenshots.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                goToNext()
              }}
              className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Image suivante"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-sm">
            {currentIndex + 1} / {sortedScreenshots.length}
          </div>
        </div>
      )}
    </>
  )
}
