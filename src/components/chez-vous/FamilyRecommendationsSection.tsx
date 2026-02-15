"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import Image from "next/image"
import Link from "next/link"
import { Users, Sparkles, ChevronRight, Loader2, Film, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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
  }, [session])

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
  // (must be before conditional returns to respect Rules of Hooks)
  useEffect(() => {
    if (members.length > 0 && !selectedMember) {
      const memberWithReactions = members.find((m) => (m._count?.reactions || 0) > 0)
      setSelectedMember(memberWithReactions?.id || members[0].id)
    }
  }, [members, selectedMember])

  // Derived state (after all hooks, before conditional returns)
  const hasAnyReactions = members.some((m) => (m._count?.reactions || 0) > 0)

  // Still loading
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            Recommandations personnalisées
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // No family members yet
  if (members.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            Recommandations personnalisées
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="inline-flex p-3 bg-indigo-100 rounded-full mb-4">
              <Users className="h-6 w-6 text-indigo-600" />
            </div>
            <p className="text-gray-600 mb-4">
              Ajoutez les membres de votre famille pour obtenir des recommandations personnalisées.
            </p>
            <Button asChild>
              <Link href="/profil/famille">
                <Plus className="h-4 w-4 mr-2" />
                Ajouter ma famille
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-500" />
          Recommandations personnalisées
        </CardTitle>
        {hasAnyReactions && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/recommandations">
              Voir tout <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {/* Family Member Tabs - show ALL members */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-4 border-b">
          {members.map((member) => {
            const reactionCount = member._count?.reactions || 0
            return (
              <button
                key={member.id}
                onClick={() => setSelectedMember(member.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                  selectedMember === member.id
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span className="text-lg">{member.avatarEmoji}</span>
                <span className="font-medium">{member.name}</span>
                {reactionCount > 0 && (
                  <span className="text-xs opacity-70">
                    ({reactionCount})
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Recommendations */}
        {loadingRecs ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : recommendations?.recommendations && recommendations.recommendations.length > 0 ? (
          <>
            {/* Based on info */}
            {recommendations.basedOn && (
              <div className="mb-4 flex flex-wrap gap-2 items-center text-sm text-gray-600">
                <span>Basé sur {recommendations.basedOn.lovedCount + recommendations.basedOn.likedCount} avis :</span>
                {recommendations.basedOn.genres.slice(0, 3).map((genre) => (
                  <Badge key={genre} variant="secondary">
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
                  <div className="overflow-hidden rounded-lg hover:shadow-md transition-all">
                    <div className="relative aspect-[2/3]">
                      {media.posterUrl ? (
                        <Image
                          src={media.posterUrl}
                          alt={media.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="120px"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <Film className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                      {media.expertAgeRec !== null && (
                        <div className="absolute top-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                          {media.expertAgeRec}+
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 className="mt-1 text-xs line-clamp-1 text-gray-700 group-hover:text-indigo-600 transition-colors">
                    {media.title}
                  </h3>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>{recommendations?.message || "Aucune recommandation disponible"}</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/films">Découvrir des films</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
