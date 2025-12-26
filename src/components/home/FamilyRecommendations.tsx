"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import Image from "next/image"
import Link from "next/link"
import { Users, Sparkles, ChevronRight, Loader2, Film, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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

export function FamilyRecommendations() {
  const { data: session, status } = useSession()
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
          // Auto-select first member with reactions
          const memberWithReactions = data.familyMembers?.find(
            (m: FamilyMember) => (m._count?.reactions || 0) > 0
          )
          if (memberWithReactions) {
            setSelectedMember(memberWithReactions.id)
          }
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

  // Not logged in
  if (status === "unauthenticated") {
    return null
  }

  // Still loading session
  if (status === "loading" || loading) {
    return null
  }

  // No family members yet
  if (members.length === 0) {
    return (
      <section className="py-12 bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-xl mx-auto">
            <div className="inline-flex p-3 bg-indigo-100 rounded-full mb-4">
              <Users className="h-6 w-6 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Recommandations personnalisées
            </h2>
            <p className="text-gray-600 mb-6">
              Ajoutez les membres de votre famille et enregistrez leurs réactions aux films
              pour obtenir des recommandations personnalisées.
            </p>
            <Button asChild>
              <Link href="/profil">
                <Plus className="h-4 w-4 mr-2" />
                Ajouter ma famille
              </Link>
            </Button>
          </div>
        </div>
      </section>
    )
  }

  // Check if any member has reactions
  const membersWithReactions = members.filter((m) => (m._count?.reactions || 0) > 0)

  if (membersWithReactions.length === 0) {
    return (
      <section className="py-12 bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-xl mx-auto">
            <div className="inline-flex p-3 bg-indigo-100 rounded-full mb-4">
              <Sparkles className="h-6 w-6 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Recommandations personnalisées
            </h2>
            <p className="text-gray-600 mb-6">
              Regardez des films et notez les réactions de vos enfants pour débloquer
              des recommandations personnalisées !
            </p>
            <Button asChild variant="outline">
              <Link href="/films">
                <Film className="h-4 w-4 mr-2" />
                Découvrir des films
              </Link>
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-12 bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-indigo-500" />
              Recommandations pour votre famille
            </h2>
            <p className="text-gray-600 mt-1">
              Basées sur les réactions de vos enfants
            </p>
          </div>

          {/* Family Member Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {membersWithReactions.map((member) => (
              <button
                key={member.id}
                onClick={() => setSelectedMember(member.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                  selectedMember === member.id
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-white text-gray-700 hover:bg-gray-50 shadow-sm"
                }`}
              >
                <span className="text-lg">{member.avatarEmoji}</span>
                <span className="font-medium">{member.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        {loadingRecs ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : recommendations?.recommendations && recommendations.recommendations.length > 0 ? (
          <>
            {/* Based on info */}
            {recommendations.basedOn && (
              <div className="mb-6 flex flex-wrap gap-2 items-center text-sm text-gray-600">
                <span>Basé sur {recommendations.basedOn.lovedCount + recommendations.basedOn.likedCount} films aimés :</span>
                {recommendations.basedOn.genres.slice(0, 3).map((genre) => (
                  <Badge key={genre} variant="secondary" className="bg-white">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}

            {/* Media Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {recommendations.recommendations.map((media) => (
                <Link
                  key={media.id}
                  href={`/media/${media.id}`}
                  className="group"
                >
                  <Card className="overflow-hidden hover:shadow-lg transition-all">
                    <div className="relative aspect-[2/3]">
                      {media.posterUrl ? (
                        <Image
                          src={media.posterUrl}
                          alt={media.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <Film className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                      {media.expertAgeRec !== null && (
                        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                          {media.expertAgeRec}+
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-medium text-sm line-clamp-2 group-hover:text-indigo-600 transition-colors">
                        {media.title}
                      </h3>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* See more */}
            <div className="text-center mt-8">
              <Button asChild variant="outline">
                <Link href="/recommandations">
                  Voir toutes les recommandations
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>{recommendations?.message || "Aucune recommandation disponible"}</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/films">Découvrir des films</Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
