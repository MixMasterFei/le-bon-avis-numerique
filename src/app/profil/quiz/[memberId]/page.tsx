"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import { PreferenceQuiz } from "@/components/profile/PreferenceQuiz"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

interface MemberInfo {
  id: string
  name: string
  avatarEmoji: string
  birthYear: number | null
  birthMonth: number | null
}

export default function QuizPage() {
  const { memberId } = useParams<{ memberId: string }>()
  const { status } = useSession()
  const router = useRouter()
  const [member, setMember] = useState<MemberInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const p = APERCU_PALETTE

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
          birthYear: data.familyMember.birthYear ?? null,
          birthMonth: data.familyMember.birthMonth ?? null,
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
      <div
        className="container mx-auto px-4 py-16 flex justify-center"
        style={{ background: p.bg }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: p.accent }} />
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="container mx-auto px-4 py-16 text-center"
        style={{ background: p.bg }}
      >
        <p className="mb-4" style={{ color: p.ink2 }}>
          {error}
        </p>
        <Link
          href="/profil"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
          style={{
            background: "transparent",
            color: p.ink,
            border: `1px solid ${p.line2}`,
          }}
        >
          Retour au profil
        </Link>
      </div>
    )
  }

  if (!member) return null

  return (
    <div style={{ background: p.bg }}>
      <div className="container mx-auto px-4 pt-8">
        <Link
          href={`/profil/membres/${member.id}`}
          className="inline-flex items-center gap-1 text-sm hover:opacity-70"
          style={{ color: p.ink2 }}
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à {member.name}
        </Link>
      </div>
      <div className="container mx-auto px-4 py-6">
        <PreferenceQuiz
          memberId={member.id}
          memberName={member.name}
          memberEmoji={member.avatarEmoji}
          birthYear={member.birthYear}
          birthMonth={member.birthMonth}
        />
      </div>
    </div>
  )
}
