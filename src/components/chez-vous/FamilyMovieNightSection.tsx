"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import Image from "next/image"
import Link from "next/link"
import { Users, Popcorn, ChevronDown, ChevronUp, Check, Sparkles, Film, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toMediaRouteId } from "@/lib/media-route"
import { MemberAvatar } from "@/components/ui/MemberAvatar"

interface FamilyMember {
  id: string
  name: string
  avatarEmoji: string
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  birthYear: number | null
  birthMonth: number | null
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
    avatarStyle?: string | null
    avatarSeed?: string | null
    avatarOptions?: Record<string, unknown> | null
    matchScore: number
    matchPercentage: number
  }>
}

export function FamilyMovieNightSection() {
  const { data: session } = useSession()
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [recommendations, setRecommendations] = useState<MediaRecommendation[]>([])
  const [sharedGenres, setSharedGenres] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingFamily, setLoadingFamily] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [showAllResults, setShowAllResults] = useState(false)

  // Fetch family members on mount (only if logged in)
  useEffect(() => {
    if (!session?.user) {
      setLoadingFamily(false)
      return
    }

    async function loadFamily() {
      try {
        const res = await fetch("/api/user/family")
        if (res.ok) {
          const data = await res.json()
          setFamilyMembers(data.familyMembers || [])
        }
      } catch {
        // No family members
      } finally {
        setLoadingFamily(false)
      }
    }
    loadFamily()
  }, [session])

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    )
    setShowResults(false)
    setShowAllResults(false)
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

  // Loading state
  if (loadingFamily) {
    return (
      <section className="rounded-2xl bg-gradient-to-br from-orange-50 via-amber-50/50 to-white border border-orange-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-orange-100/50">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <div className="p-1.5 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg text-white">
              <Popcorn className="h-4 w-4" />
            </div>
            Soirée Ciné en Famille
          </h2>
        </div>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-orange-500"></div>
        </div>
      </section>
    )
  }

  // Don't render if user has no family members or only 1
  if (familyMembers.length < 2) {
    return (
      <section className="rounded-2xl bg-gradient-to-br from-orange-50 via-amber-50/50 to-white border border-orange-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-orange-100/50">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <div className="p-1.5 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg text-white">
              <Popcorn className="h-4 w-4" />
            </div>
            Soirée Ciné en Famille
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Trouvez le film parfait qui plaira à toute la famille
          </p>
        </div>
        <div className="text-center py-10 px-6">
          <div className="inline-flex p-3 bg-orange-50 rounded-2xl mb-4">
            <Users className="h-6 w-6 text-orange-500" />
          </div>
          <p className="text-gray-500 mb-5 max-w-sm mx-auto">
            Ajoutez au moins 2 membres à votre famille pour utiliser cette fonctionnalité.
          </p>
          <Button asChild variant="outline" className="rounded-full border-orange-200 text-orange-700 hover:bg-orange-50">
            <Link href="/profil">
              Gérer ma famille
            </Link>
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl bg-gradient-to-br from-orange-50 via-amber-50/50 to-white border border-orange-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-orange-100/50">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <div className="p-1.5 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg text-white">
            <Popcorn className="h-4 w-4" />
          </div>
          Soirée Ciné en Famille
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Trouvez le film parfait qui plaira à toute la famille
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Member Selection */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-orange-500" />
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
                    "flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all text-sm font-medium",
                    isSelected
                      ? "border-orange-400 bg-orange-100 text-orange-900"
                      : "border-gray-200 bg-white hover:border-orange-300"
                  )}
                >
                  <MemberAvatar
                    avatarStyle={member.avatarStyle ?? null}
                    avatarSeed={member.avatarSeed ?? null}
                    avatarOptions={member.avatarOptions ?? null}
                    avatarEmoji={member.avatarEmoji ?? null}
                    name={member.name}
                    size={24}
                  />
                  <span>{member.name}</span>
                  {isSelected && <Check className="h-4 w-4 text-orange-600" />}
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
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-full shadow-md shadow-orange-200"
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
            {/* Shared Genres + Refresh */}
            <div className="flex items-center justify-between">
              {sharedGenres.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm text-gray-500">Goûts communs :</span>
                  {sharedGenres.slice(0, 4).map((genre) => (
                    <Badge key={genre} variant="secondary" className="bg-orange-100 text-orange-800 border-0">
                      {genre}
                    </Badge>
                  ))}
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchRecommendations}
                disabled={loading}
                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 shrink-0"
              >
                <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
                Rafraîchir
              </Button>
            </div>

            {/* Recommendation Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recommendations.slice(0, showAllResults ? 12 : 4).map((media) => (
                <Link
                  key={media.id}
                  href={`/media/${toMediaRouteId(media.type, media.id)}`}
                  className="group"
                >
                  <div className="flex gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-orange-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                    {/* Poster */}
                    <div className="relative w-16 h-24 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                      {media.posterUrl ? (
                        <Image
                          src={media.posterUrl}
                          alt={media.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="h-6 w-6 text-gray-300" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm line-clamp-2 group-hover:text-orange-700 transition-colors">
                        {media.title}
                      </h4>

                      {/* Family Match */}
                      <div className="mt-1.5 flex items-center gap-1">
                        <div
                          className={cn(
                            "text-xs font-bold px-2 py-0.5 rounded-full",
                            media.familyMatchPercentage >= 70
                              ? "bg-emerald-100 text-emerald-700"
                              : media.familyMatchPercentage >= 50
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-500"
                          )}
                        >
                          {media.familyMatchPercentage}% match
                        </div>
                      </div>

                      {/* Per-member matches */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.values(media.memberMatches).map((match) => (
                          <div
                            key={match.name}
                            className="flex items-center gap-1 text-xs"
                            title={`${match.name}: ${match.matchPercentage}%`}
                          >
                            <MemberAvatar
                              avatarStyle={match.avatarStyle ?? null}
                              avatarSeed={match.avatarSeed ?? null}
                              avatarOptions={match.avatarOptions ?? null}
                              avatarEmoji={match.avatarEmoji ?? null}
                              name={match.name}
                              size={16}
                            />
                            <span
                              className={cn(
                                "font-semibold",
                                match.matchPercentage >= 70
                                  ? "text-emerald-600"
                                  : match.matchPercentage >= 50
                                  ? "text-amber-600"
                                  : "text-gray-400"
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

            {/* Show more/less button */}
            {recommendations.length > 4 && (
              <Button
                variant="ghost"
                className="w-full text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-full"
                onClick={() => setShowAllResults(!showAllResults)}
              >
                {showAllResults ? (
                  <>
                    Voir moins
                    <ChevronUp className="h-4 w-4 ml-1" />
                  </>
                ) : (
                  <>
                    Voir plus de suggestions ({recommendations.length - 4} de plus)
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            )}

            {/* Retry button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-gray-500 rounded-full"
              onClick={() => {
                setShowResults(false)
                setShowAllResults(false)
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Nouvelle recherche
            </Button>
          </div>
        )}

        {showResults && recommendations.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Popcorn className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Pas assez de données pour faire des recommandations.</p>
            <p className="text-sm mt-1">Ajoutez plus de réactions aux films !</p>
          </div>
        )}
      </div>
    </section>
  )
}
