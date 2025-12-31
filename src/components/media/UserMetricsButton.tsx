"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { BarChart3, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserMetricsModal } from "./UserMetricsModal"
import Link from "next/link"

interface UserMetricsButtonProps {
  mediaId: string
  mediaTitle: string
  onSubmit?: () => void
}

export function UserMetricsButton({ mediaId, mediaTitle, onSubmit }: UserMetricsButtonProps) {
  const { data: session, status } = useSession()
  const [showModal, setShowModal] = useState(false)

  if (status === "loading") {
    return null
  }

  if (!session) {
    return (
      <Link href="/auth/signin">
        <Button variant="outline" size="sm" className="text-blue-600 border-blue-300">
          <LogIn className="h-4 w-4 mr-2" />
          Connectez-vous pour evaluer
        </Button>
      </Link>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowModal(true)}
        className="text-blue-600 border-blue-300 hover:bg-blue-50"
      >
        <BarChart3 className="h-4 w-4 mr-2" />
        Evaluer le contenu
      </Button>

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
