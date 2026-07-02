"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { MediaScreenshots } from "./MediaScreenshots"

interface Screenshot {
  id: string
  url: string
  width?: number | null
  height?: number | null
  order: number
}

interface AdminScreenshotsWrapperProps {
  screenshots: Screenshot[]
  title: string
}

export function AdminScreenshotsWrapper({
  screenshots: initial,
  title,
}: AdminScreenshotsWrapperProps) {
  const [screenshots, setScreenshots] = useState(initial)
  // Admin status is resolved client-side so the fiche page can stay
  // statically rendered (a server-side auth() read would opt the whole
  // route out of ISR).
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"

  const handleDelete = async (id: string) => {
    const prev = screenshots
    // Optimistic removal
    setScreenshots((s) => s.filter((sc) => sc.id !== id))

    try {
      const res = await fetch(`/api/admin/screenshots/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        setScreenshots(prev)
        alert("Erreur lors de la suppression")
      }
    } catch {
      setScreenshots(prev)
      alert("Erreur lors de la suppression")
    }
  }

  if (screenshots.length === 0) return null

  return (
    <MediaScreenshots
      screenshots={screenshots}
      title={title}
      isAdmin={isAdmin}
      onDeleteScreenshot={isAdmin ? handleDelete : undefined}
    />
  )
}
