"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Plus, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RequestContentModal } from "./RequestContentModal"
import Link from "next/link"

interface RequestContentButtonProps {
  defaultTitle?: string
  defaultType?: "MOVIE" | "TV" | "GAME" | "BOOK" | "APP" | "MANGA"
  externalId?: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg"
}

export function RequestContentButton({
  defaultTitle,
  defaultType = "MOVIE",
  externalId,
  variant = "outline",
  size = "sm",
}: RequestContentButtonProps) {
  const { data: session, status } = useSession()
  const [showModal, setShowModal] = useState(false)
  const pathname = usePathname()

  if (status === "loading") {
    return null
  }

  if (!session) {
    return (
      <Link href={`/connexion?callbackUrl=${encodeURIComponent(pathname)}`}>
        <Button variant={variant} size={size}>
          <LogIn className="h-4 w-4 mr-2" />
          Connectez-vous pour demander
        </Button>
      </Link>
    )
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setShowModal(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Demander ce contenu
      </Button>

      <RequestContentModal
        open={showModal}
        onClose={() => setShowModal(false)}
        defaultTitle={defaultTitle}
        defaultType={defaultType}
        externalId={externalId}
      />
    </>
  )
}
