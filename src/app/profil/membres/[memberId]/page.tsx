"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { ArrowLeft, Loader2 } from "lucide-react"
import { MemberCorner } from "@/components/profile/MemberCorner"
import Link from "next/link"

export default function MemberCornerPage() {
  const { memberId } = useParams<{ memberId: string }>()
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/connexion?callbackUrl=/profil/membres/${memberId}`)
    }
  }, [status, router, memberId])

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (status === "unauthenticated") return null

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/profil"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au profil
        </Link>
      </div>

      <MemberCorner memberId={memberId} />
    </div>
  )
}
