"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PreferenceQuiz } from "@/components/profile/PreferenceQuiz"
import Link from "next/link"

interface MemberInfo {
  id: string
  name: string
  avatarEmoji: string
}

export default function QuizPage() {
  const { memberId } = useParams<{ memberId: string }>()
  const { status } = useSession()
  const router = useRouter()
  const [member, setMember] = useState<MemberInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/connexion?callbackUrl=/profil/quiz/${memberId}`)
      return
    }

    if (status !== "authenticated") return

    async function loadMember() {
      try {
        const res = await fetch(`/api/user/family/${memberId}`)
        if (!res.ok) {
          if (res.status === 404) {
            setError("Membre non trouvé")
          } else {
            setError("Erreur lors du chargement")
          }
          return
        }
        const data = await res.json()
        setMember({
          id: data.familyMember.id,
          name: data.familyMember.name,
          avatarEmoji: data.familyMember.avatarEmoji,
        })
      } catch {
        setError("Erreur de connexion")
      } finally {
        setLoading(false)
      }
    }

    loadMember()
  }, [memberId, status, router])

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 mb-4">{error}</p>
        <Button asChild variant="outline">
          <Link href="/profil">Retour au profil</Link>
        </Button>
      </div>
    )
  }

  if (!member) return null

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/profil"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au profil
        </Link>
      </div>

      <PreferenceQuiz
        memberId={member.id}
        memberName={member.name}
        memberEmoji={member.avatarEmoji}
      />
    </div>
  )
}
