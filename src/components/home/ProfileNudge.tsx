"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Target, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { useSession } from "next-auth/react"

interface FamilyMember {
  id: string
  name: string
  avatarEmoji: string
  useCustomSettings: boolean
  favoriteGenres: string[]
}

export function ProfileNudge() {
  const { data: session } = useSession()
  const [incompleteMembers, setIncompleteMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user) {
      setLoading(false)
      return
    }

    async function fetchMembers() {
      try {
        const res = await fetch("/api/user/family")
        if (res.ok) {
          const data = await res.json()
          const members: FamilyMember[] = Array.isArray(data?.members) ? data.members : data
          const incomplete = members.filter(
            (m) => !m.useCustomSettings || m.favoriteGenres.length === 0
          )
          setIncompleteMembers(incomplete)
        }
      } catch {
        // Silently ignore
      } finally {
        setLoading(false)
      }
    }

    fetchMembers()
  }, [session?.user])

  if (loading || incompleteMembers.length === 0) return null

  const firstIncomplete = incompleteMembers[0]

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-100">
      <div className="flex items-start gap-4">
        <div className="p-2.5 bg-amber-100 rounded-xl shrink-0">
          <Target className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 mb-1">
            Complétez le profil de votre foyer
          </h3>
          <div className="flex items-center gap-2 mb-2">
            <MemberAvatar
              avatarStyle={(firstIncomplete as any).avatarStyle ?? null}
              avatarSeed={(firstIncomplete as any).avatarSeed ?? null}
              avatarOptions={((firstIncomplete as any).avatarOptions as Record<string, unknown>) ?? null}
              avatarEmoji={firstIncomplete.avatarEmoji ?? null}
              name={firstIncomplete.name}
              size={24}
            />
            <span className="text-sm text-gray-700">
              {firstIncomplete.name} n&apos;a pas encore de préférences renseignées
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Les recommandations personnalisées apparaîtront sous chaque film, série et jeu.
            Vous pourrez modifier ces informations à tout moment.
          </p>
          <Link href={`/profil/quiz/${firstIncomplete.id}`}>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
              Compléter le quiz de {firstIncomplete.name}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
          {incompleteMembers.length > 1 && (
            <p className="text-xs text-gray-400 mt-2">
              + {incompleteMembers.length - 1} autre{incompleteMembers.length > 2 ? "s" : ""} membre{incompleteMembers.length > 2 ? "s" : ""} sans quiz
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
