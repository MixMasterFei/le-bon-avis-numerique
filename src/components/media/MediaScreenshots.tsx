"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Camera, X, ChevronLeft, ChevronRight } from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

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

export function MediaScreenshots({
  screenshots,
  title,
  className,
  isAdmin,
  onDeleteScreenshot,
}: MediaScreenshotsProps) {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  if (!screenshots || screenshots.length === 0) {
    return null
  }

  const seen = new Set<string>()
  const uniqueScreenshots = screenshots.filter((s) => {
    if (seen.has(s.url)) return false
    seen.add(s.url)
    return true
  })

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
    setCurrentIndex((prev) =>
      prev === 0 ? sortedScreenshots.length - 1 : prev - 1
    )
  }

  const goToNext = () => {
    setCurrentIndex((prev) =>
      prev === sortedScreenshots.length - 1 ? 0 : prev + 1
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") closeLightbox()
    if (e.key === "ArrowLeft") goToPrevious()
    if (e.key === "ArrowRight") goToNext()
  }

  return (
    <>
      <div
        className={cn("rounded-2xl", className)}
        style={{ background: p.card, border: `1px solid ${p.line}` }}
      >
        <div className="p-5 pb-3">
          <h3
            className={`${serifClass} text-lg font-medium flex items-center gap-2`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            <Camera className="h-5 w-5" style={{ color: p.accent }} />
            Captures d&apos;écran
          </h3>
        </div>
        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {sortedScreenshots.map((screenshot, index) => (
              <div key={screenshot.id} className="relative group">
                <button
                  onClick={() => openLightbox(index)}
                  className="relative w-full aspect-video overflow-hidden rounded-lg transition-all focus:outline-none"
                  style={{ background: p.placeholder }}
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
                    className="absolute top-1 right-1 z-10 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    style={{ background: p.accent, color: "#fff" }}
                    aria-label="Supprimer cette capture"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(10, 8, 6, 0.94)" }}
          onClick={closeLightbox}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="dialog"
          aria-modal="true"
          aria-label="Image gallery"
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Fermer"
          >
            <X className="h-6 w-6" />
          </button>

          {sortedScreenshots.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                goToPrevious()
              }}
              className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Image précédente"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}

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

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-sm">
            {currentIndex + 1} / {sortedScreenshots.length}
          </div>
        </div>
      )}
    </>
  )
}
