"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react"
import { SafeImage } from "@/components/ui/SafeImage"

interface Screenshot {
  id: string
  url: string
  width?: number | null
  height?: number | null
  order: number
}

const C = { page: "var(--f-page)", accent: "var(--f-accent)" }

/**
 * Dashboard screenshots grid. Dedupes by URL (the MediaScreenshot table stores
 * ~31% exact-duplicate rows), opens a full-size lightbox on click (keyboard +
 * backdrop close), and keeps the admin delete control (DELETE
 * /api/admin/screenshots/[id], optimistic removal).
 */
export function DashboardScreenshots({
  screenshots: initial,
  title,
}: {
  screenshots: Screenshot[]
  title: string
}) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"
  const [shots, setShots] = useState(initial)
  const [lightbox, setLightbox] = useState<number | null>(null)

  const seen = new Set<string>()
  const unique = shots
    .filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)))
    .slice(0, 4)

  const close = useCallback(() => setLightbox(null), [])
  const step = useCallback(
    (dir: number) =>
      setLightbox((i) => (i === null ? i : (i + dir + unique.length) % unique.length)),
    [unique.length],
  )

  // Esc closes, arrows navigate — only while the lightbox is open.
  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
      else if (e.key === "ArrowLeft") step(-1)
      else if (e.key === "ArrowRight") step(1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [lightbox, close, step])

  if (unique.length === 0) return null

  const handleDelete = async (id: string) => {
    const prev = shots
    setShots((s) => s.filter((x) => x.id !== id)) // optimistic
    try {
      const res = await fetch(`/api/admin/screenshots/${id}`, { method: "DELETE" })
      if (!res.ok) {
        setShots(prev)
        alert("Erreur lors de la suppression")
      }
    } catch {
      setShots(prev)
      alert("Erreur lors de la suppression")
    }
  }

  const active = lightbox !== null && lightbox < unique.length ? unique[lightbox] : null

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {unique.map((s, index) => (
          <div
            key={s.id}
            className="group relative aspect-video cursor-zoom-in overflow-hidden rounded-lg"
            style={{ background: C.page }}
          >
            <SafeImage
              src={s.url}
              alt={title}
              fill
              sizes="(max-width:640px) 50vw, 25vw"
              className="object-cover"
            />
            {/* Full-cover button = the click target that opens the lightbox. */}
            <button
              type="button"
              onClick={() => setLightbox(index)}
              className="absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
              style={{ background: "rgba(0,0,0,.25)" }}
              aria-label={`Agrandir la capture ${index + 1}`}
            >
              <span className="rounded-full bg-black/55 p-2">
                <ZoomIn className="h-4 w-4 text-white" />
              </span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm("Supprimer cette capture ?")) handleDelete(s.id)
                }}
                className="absolute right-1 top-1 z-20 rounded-full p-1 opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                style={{ background: C.accent, color: "#fff" }}
                aria-label="Supprimer cette capture"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Capture agrandie"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>

          {unique.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  step(-1)
                }}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 sm:left-4"
                aria-label="Capture précédente"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  step(1)
                }}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 sm:right-4"
                aria-label="Capture suivante"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Stop propagation so clicking the image itself doesn't close. */}
          <div
            className="relative aspect-video w-full max-w-5xl"
            style={{ maxHeight: "85vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <SafeImage
              src={active.url}
              alt={title}
              fill
              sizes="100vw"
              className="object-contain"
              unoptimized
            />
          </div>

          {unique.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white">
              {lightbox! + 1} / {unique.length}
            </div>
          )}
        </div>
      )}
    </>
  )
}
