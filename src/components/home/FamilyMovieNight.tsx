"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Users, Popcorn, ChevronRight, Check, Sparkles, Film } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toMediaRouteId } from "@/lib/media-route"

interface FamilyMember {
  id: string
  name: string
  avatarEmoji: string
  birthYear: number | null
  hasReactions: boolean
}

interface MediaRecommendation {
  id: string
  title: string
  type: "MOVIE" | "TV"
  posterUrl: string | null
  genres: string[]
  expertAgeRec: number | null
  familyMatchPercentage: number
  memberMatches: Record<string, {
    name: string
    avatarEmoji: string
    matchScore: number
    matchPercentage: number
  }>
}

export function FamilyMovieNight() {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [recommendations, setRecommendations] = useState<MediaRecommendation[]>([])
  const [sharedGenres, setSharedGenres] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showResults, setShowResults] = useState(false)

  // Fetch family members on mount
  useEffect(() => {
    async function loadFamily() {
      try {
        const res = await fetch("/api/user/family")
        if (res.ok) {
          const data = await res.json()
          setFamilyMembers(data.familyMembers || [])
        }
      } catch {
        // User not logged in or no family members
      }
    }
    loadFamily()
  }, [])

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    )
    setShowResults(false)
  }

  const fetchRecommendations = async () => {
    if (selectedMembers.length < 2) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/recommendations/family?memberIds=${selectedMembers.join(",")}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erreur")
      }

      const data = await res.json()
      setRecommendations(data.recommendations || [])
      setSharedGenres(data.sharedGenres || [])
      setShowResults(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du chargement")
    } finally {
      setLoading(false)
    }
  }

  // Don't render if user has no family members
  if (familyMembers.length < 2) {
    return null
  }

  return (
    <Card className="border-2 border-dashed border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-900">
          <Popcorn className="h-5 w-5" />
          Soirée Ciné en Famille
        </CardTitle>
        <p className="text-sm text-purple-700">
          Trouvez le film parfait qui plaira à toute la famille
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Member Selection */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Qui regarde ce soir ?
          </p>
          <div className="flex flex-wrap gap-2">
            {familyMembers.map((member) => {
              const isSelected = selectedMembers.includes(member.id)
              return (
                <button
                  key={member.id}
                  onClick={() => toggleMember(member.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all",
                    isSelected
                      ? "border-purple-500 bg-purple-100 text-purple-900"
                      : "border-gray-200 bg-white hover:border-purple-300"
                  )}
                >
                  <span className="text-xl">{member.avatarEmoji}</span>
                  <span className="font-medium">{member.name}</span>
                  {isSelected && <Check className="h-4 w-4 text-purple-600" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Find Button */}
        {selectedMembers.length >= 2 && !showResults && (
          <Button
            onClick={fetchRecommendations}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {loading ? (
              "Recherche des films parfaits..."
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Trouver des films pour {selectedMembers.length} personnes
              </>
            )}
          </Button>
        )}

        {selectedMembers.length === 1 && (
          <p className="text-sm text-amber-600 text-center">
            Sélectionnez au moins 2 personnes pour les recommandations familiales
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}

        {/* Results */}
        {showResults && recommendations.length > 0 && (
          <div className="space-y-4">
            {/* Shared Genres */}
            {sharedGenres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-600">Goûts communs:</span>
                {sharedGenres.slice(0, 4).map((genre) => (
                  <Badge key={genre} variant="secondary" className="bg-purple-100 text-purple-800">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}

            {/* Recommendation Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recommendations.slice(0, 4).map((media) => (
                <Link
                  key={media.id}
                  href={`/media/${toMediaRouteId(media.type, media.id)}`}
                  className="group"
                >
                  <div className="flex gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all">
                    {/* Poster */}
                    <div className="relative w-16 h-24 rounded overflow-hidden shrink-0">
                      {media.posterUrl ? (
                        <Image
                          src={media.posterUrl}
                          alt={media.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <Film className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-2 group-hover:text-purple-700">
                        {media.title}
                      </h4>

                      {/* Family Match */}
                      <div className="mt-1 flex items-center gap-1">
                        <div
                          className={cn(
                            "text-xs font-bold px-2 py-0.5 rounded-full",
                            media.familyMatchPercentage >= 70
                              ? "bg-green-100 text-green-700"
                              : media.familyMatchPercentage >= 50
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                          )}
                        >
                          {media.familyMatchPercentage}% match
                        </div>
                      </div>

                      {/* Per-member matches */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.values(media.memberMatches).map((match) => (
                          <div
                            key={match.name}
                            className="flex items-center gap-1 text-xs"
                            title={`${match.name}: ${match.matchPercentage}%`}
                          >
                            <span>{match.avatarEmoji}</span>
                            <span
                              className={cn(
                                "font-medium",
                                match.matchPercentage >= 70
                                  ? "text-green-600"
                                  : match.matchPercentage >= 50
                                  ? "text-amber-600"
                                  : "text-gray-500"
                              )}
                            >
                              {match.matchPercentage}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {recommendations.length > 4 && (
              <Button
                variant="ghost"
                className="w-full text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                onClick={() => setShowResults(false)}
              >
                Voir plus de suggestions
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        )}

        {showResults && recommendations.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <Popcorn className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Pas assez de données pour faire des recommandations.</p>
            <p className="text-sm">Ajoutez plus de réactions aux films !</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
