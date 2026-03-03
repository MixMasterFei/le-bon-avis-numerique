"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import Image from "next/image"
import Link from "next/link"
import { Users, Sparkles, ChevronRight, Loader2, Film, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MemberAvatar } from "@/components/ui/MemberAvatar"

interface FamilyMember {
  id: string
  name: string
  avatarEmoji: string
  birthYear: number | null
  _count?: {
    reactions: number
  }
}

interface MediaItem {
  id: string
  title: string
  type: string
  posterUrl: string | null
  genres: string[]
  expertAgeRec: number | null
}

interface RecommendationsData {
  familyMember: FamilyMember
  recommendations: MediaItem[]
  basedOn?: {
    genres: string[]
    lovedCount: number
    likedCount: number
  }
  message?: string
}

export function FamilyRecommendationsSection() {
  const { data: session } = useSession()
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingRecs, setLoadingRecs] = useState(false)

  // Fetch family members
  useEffect(() => {
    if (session?.user) {
      fetch("/api/user/family")
        .then((res) => res.json())
        .then((data) => {
          setMembers(data.familyMembers || [])
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [session?.user?.id])

  // Fetch recommendations when member is selected
  useEffect(() => {
    if (selectedMember) {
      setLoadingRecs(true)
      fetch(`/api/recommendations?familyMemberId=${selectedMember}`)
        .then((res) => res.json())
        .then((data) => {
          setRecommendations(data)
        })
        .finally(() => setLoadingRecs(false))
    }
  }, [selectedMember])

  // Auto-select first member if none selected yet
  useEffect(() => {
    if (members.length > 0 && !selectedMember) {
      const memberWithReactions = members.find((m) => (m._count?.reactions || 0) > 0)
      setSelectedMember(memberWithReactions?.id || members[0].id)
    }
  }, [members, selectedMember])

  // Derived state
  const hasAnyReactions = members.some((m) => (m._count?.reactions || 0) > 0)

  // Still loading
  if (loading) {
    return (
      <section className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-50">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Recommandations personnalisées
          </h2>
        </div>
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
        </div>
      </section>
    )
  }

  // No family members yet
  if (members.length === 0) {
    return (
      <section className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-50">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Recommandations personnalisées
          </h2>
        </div>
        <div className="text-center py-12 px-6">
          <div className="inline-flex p-3 bg-violet-50 rounded-2xl mb-4">
            <Users className="h-6 w-6 text-violet-500" />
          </div>
          <p className="text-gray-500 mb-5 max-w-sm mx-auto">
            Ajoutez les membres de votre famille pour obtenir des recommandations personnalisées.
          </p>
          <Button asChild className="rounded-full">
            <Link href="/profil">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter ma famille
            </Link>
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Sparkles className="h-5 w-5 text-violet-500" />
          Recommandations personnalisées
        </h2>
        {hasAnyReactions && (
          <Link
            href="/recommandations"
            className="text-sm font-medium text-violet-600 hover:text-violet-700 flex items-center gap-1 transition-colors"
          >
            Voir tout <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      <div className="p-6">
        {/* Family Member Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-5 scrollbar-thin">
          {members.map((member) => {
            const reactionCount = member._count?.reactions || 0
            const isSelected = selectedMember === member.id
            return (
              <button
                key={member.id}
                onClick={() => setSelectedMember(member.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all text-sm font-medium ${
                  isSelected
                    ? "bg-violet-600 text-white shadow-md shadow-violet-200"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                <MemberAvatar
                  avatarStyle={(member as any).avatarStyle ?? null}
                  avatarSeed={(member as any).avatarSeed ?? null}
                  avatarOptions={((member as any).avatarOptions as Record<string, unknown>) ?? null}
                  avatarEmoji={member.avatarEmoji ?? null}
                  name={member.name}
                  size={20}
                />
                <span>{member.name}</span>
                {reactionCount > 0 && (
                  <span className={`text-xs ${isSelected ? "text-violet-200" : "text-gray-400"}`}>
                    ({reactionCount})
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Recommendations */}
        {loadingRecs ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
          </div>
        ) : recommendations?.recommendations && recommendations.recommendations.length > 0 ? (
          <>
            {/* Based on info */}
            {recommendations.basedOn && (
              <div className="mb-5 flex flex-wrap gap-2 items-center text-sm text-gray-500">
                <span>Basé sur {recommendations.basedOn.lovedCount + recommendations.basedOn.likedCount} avis :</span>
                {recommendations.basedOn.genres.slice(0, 3).map((genre) => (
                  <Badge key={genre} variant="secondary" className="bg-violet-50 text-violet-700 border-0">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}

            {/* Media Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {recommendations.recommendations.slice(0, 8).map((media) => (
                <Link
                  key={media.id}
                  href={`/media/${media.id}`}
                  className="group"
                >
                  <div className="overflow-hidden rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                    <div className="relative aspect-[2/3] bg-gray-100">
                      {media.posterUrl ? (
                        <Image
                          src={media.posterUrl}
                          alt={media.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="120px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="h-6 w-6 text-gray-300" />
                        </div>
                      )}
                      {media.expertAgeRec !== null && (
                        <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {media.expertAgeRec}+
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 className="mt-1.5 text-xs font-medium line-clamp-1 text-gray-700 group-hover:text-violet-600 transition-colors">
                    {media.title}
                  </h3>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Film className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{recommendations?.message || "Aucune recommandation disponible"}</p>
            <Button asChild variant="outline" className="mt-4 rounded-full">
              <Link href="/films">Découvrir des films</Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
