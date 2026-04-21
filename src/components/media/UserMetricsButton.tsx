"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { BarChart3, LogIn } from "lucide-react"
import { UserMetricsModal } from "./UserMetricsModal"
import Link from "next/link"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

interface UserMetricsButtonProps {
  mediaId: string
  mediaTitle: string
  onSubmit?: () => void
}

export function UserMetricsButton({ mediaId, mediaTitle, onSubmit }: UserMetricsButtonProps) {
  const { data: session, status } = useSession()
  const [showModal, setShowModal] = useState(false)
  const p = APERCU_PALETTE

  if (status === "loading") {
    return null
  }

  // Warm pill: ink outline + ink text, bg2 hover. Replaces the old
  // blue shadcn outline so the button tracks the theme tokens.
  const pillClass =
    "inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition-colors"
  const pillStyle = {
    background: "transparent",
    border: `1px solid ${p.line2}`,
    color: p.ink,
  } as const

  if (!session) {
    return (
      <Link href="/auth/signin" className={pillClass} style={pillStyle}>
        <LogIn className="h-4 w-4" />
        Connectez-vous pour évaluer
      </Link>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className={pillClass}
        style={pillStyle}
      >
        <BarChart3 className="h-4 w-4" />
        Évaluer le contenu
      </button>

      <UserMetricsModal
        open={showModal}
        onClose={() => setShowModal(false)}
        mediaId={mediaId}
        mediaTitle={mediaTitle}
        onSubmit={onSubmit}
      />
    </>
  )
}
