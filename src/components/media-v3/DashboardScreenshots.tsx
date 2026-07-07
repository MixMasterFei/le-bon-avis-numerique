"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { X } from "lucide-react"
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
 * ~31% exact-duplicate rows) and restores the admin delete control the classic
 * fiche had (AdminScreenshotsWrapper) — the V3 dashboard's static grid had
 * dropped it. Optimistic removal via DELETE /api/admin/screenshots/[id].
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

  const seen = new Set<string>()
  const unique = shots
    .filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)))
    .slice(0, 4)

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

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {unique.map((s) => (
        <div
          key={s.id}
          className="group relative aspect-video overflow-hidden rounded-lg"
          style={{ background: C.page }}
        >
          <SafeImage
            src={s.url}
            alt={title}
            fill
            sizes="(max-width:640px) 50vw, 25vw"
            className="object-cover"
          />
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Supprimer cette capture ?")) handleDelete(s.id)
              }}
              className="absolute right-1 top-1 z-10 rounded-full p-1 opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
              style={{ background: C.accent, color: "#fff" }}
              aria-label="Supprimer cette capture"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
