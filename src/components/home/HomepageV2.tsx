"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Users, SlidersHorizontal, Tv, ArrowRight, Sparkles, Film } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { getMemberAge } from "@/lib/age-utils"
import { HeroSearch } from "./HeroSearch"
import { NowInCinema } from "./NowInCinema"
import { CuratedCollections } from "./CuratedCollections"
import { FamilyMovieNight } from "./FamilyMovieNight"
import { StreamingSection } from "./StreamingSection"
import { MediaCardV2 } from "@/components/media/MediaCardV2"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FamilyMember {
  id: string
  name: string
  avatarEmoji: string
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  birthYear: number | null
  birthMonth: number | null
}

interface Recommendation {
  id: string
  title: string
  type: "MOVIE" | "TV" | "GAME" | "BOOK" | "APP" | "MANGA"
  posterUrl: string
  genres: string[]
  expertAgeRec: number | null
  releaseDate?: string | null
  contentMetrics?: {
    violence: number
    sexNudity: number
    language: number
    consumerism: number
    substanceUse: number
    positiveMessages: number
    roleModels: number
    whatParentsNeedToKnow: string[]
    toneTags?: string[]
    pacing?: string | null
    enrichmentSource?: string
    enrichmentConfidence?: number | null
  } | null
}

interface HomepageV2Props {
  session: {
    user: {
      id: string
      name?: string | null
      role?: string
    }
  } | null
}

// ---------------------------------------------------------------------------
// Section 1: Hero — "Trouvez le film parfait pour ce soir"
// ---------------------------------------------------------------------------

function HeroV2({ session, familyMembers }: { session: HomepageV2Props["session"]; familyMembers: FamilyMember[] }) {
  const isLoggedIn = !!session?.user
  const hasFamily = familyMembers.length > 0

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-violet-50 via-white to-white">
      <div className="container mx-auto px-4 py-14 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-black text-gray-900 mb-4 leading-tight">
            Trouvez le film parfait
            <span className="text-violet-600"> pour ce soir</span>
          </h1>
          <p className="text-gray-600 mb-8 text-lg max-w-xl mx-auto">
            Des recommandations personnalisees pour votre famille, adaptees a chaque age et sensibilite.
          </p>

          <div className="max-w-xl mx-auto relative z-40 mb-10">
            <HeroSearch />
          </div>

          {/* Logged-in with family: show family member quick-picker */}
          {isLoggedIn && hasFamily && (
            <div className="mt-8">
              <p className="text-sm text-gray-500 mb-3">Recommandations rapides pour :</p>
              <div className="flex flex-wrap justify-center gap-3">
                {familyMembers.slice(0, 5).map((member) => {
                  const age = getMemberAge(member.birthYear, member.birthMonth)
                  return (
                    <Link
                      key={member.id}
                      href={`/profil/membres/${member.id}`}
                      className="group flex items-center gap-2 px-4 py-2.5 bg-white rounded-full border-2 border-violet-100 hover:border-violet-400 hover:shadow-md transition-all duration-200"
                    >
                      <MemberAvatar
                        avatarStyle={member.avatarStyle ?? null}
                        avatarSeed={member.avatarSeed ?? null}
                        avatarOptions={member.avatarOptions ?? null}
                        avatarEmoji={member.avatarEmoji ?? null}
                        name={member.name}
                        size={24}
                      />
                      <span className="font-medium text-gray-800 group-hover:text-violet-700 text-sm">
                        {member.name}
                        {age && <span className="text-gray-400 ml-1">{age} ans</span>}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Logged out: value propositions */}
          {!isLoggedIn && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 max-w-2xl mx-auto">
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-violet-50/50 border border-violet-100">
                <Users className="h-6 w-6 text-violet-600" />
                <span className="text-sm font-medium text-gray-700 text-center">
                  Personnalise pour votre famille
                </span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                <SlidersHorizontal className="h-6 w-6 text-emerald-600" />
                <span className="text-sm font-medium text-gray-700 text-center">
                  Filtrez par age et sensibilite
                </span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-50/50 border border-blue-100">
                <Tv className="h-6 w-6 text-blue-600" />
                <span className="text-sm font-medium text-gray-700 text-center">
                  Trouvez ou le regarder
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 2: For Your Family (logged-in only)
// ---------------------------------------------------------------------------

function ForYourFamily({ familyMembers }: { familyMembers: FamilyMember[] }) {
  const [activeTab, setActiveTab] = useState(0)
  const [recommendations, setRecommendations] = useState<Record<string, Recommendation[]>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  const activeMember = familyMembers[activeTab]

  useEffect(() => {
    if (!activeMember) return
    if (recommendations[activeMember.id]) return

    const fetchRecs = async () => {
      setLoading((prev) => ({ ...prev, [activeMember.id]: true }))
      try {
        const res = await fetch(`/api/recommendations?familyMemberId=${activeMember.id}`)
        if (res.ok) {
          const data = await res.json()
          setRecommendations((prev) => ({
            ...prev,
            [activeMember.id]: data.recommendations || [],
          }))
        }
      } catch {
        // silently fail
      } finally {
        setLoading((prev) => ({ ...prev, [activeMember.id]: false }))
      }
    }
    fetchRecs()
  }, [activeMember, recommendations])

  if (familyMembers.length === 0) return null

  const memberRecs = activeMember ? recommendations[activeMember.id] : []
  const isLoading = activeMember ? loading[activeMember.id] : false

  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Recommande pour vous</h2>
            <p className="text-sm text-gray-500 mt-1">Base sur les gouts de chaque membre</p>
          </div>
          <Link href="/profil" className="text-violet-600 hover:text-violet-800 text-sm font-medium flex items-center gap-1">
            Voir tout <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Member tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {familyMembers.map((member, i) => (
            <button
              key={member.id}
              onClick={() => setActiveTab(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === i
                  ? "bg-violet-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <MemberAvatar
                avatarStyle={member.avatarStyle ?? null}
                avatarSeed={member.avatarSeed ?? null}
                avatarOptions={member.avatarOptions ?? null}
                avatarEmoji={member.avatarEmoji ?? null}
                name={member.name}
                size={20}
              />
              {member.name}
            </button>
          ))}
        </div>

        {/* Recommendation grid */}
        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : memberRecs && memberRecs.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-4">
            {memberRecs.slice(0, 7).map((rec) => (
              <MediaCardV2
                key={rec.id}
                media={{
                  ...rec,
                  posterUrl: rec.posterUrl || "",
                  releaseDate: rec.releaseDate ?? null,
                }}
                variant="compact"
                showAiLabel={false}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-violet-300" />
            <p>Ajoutez des reactions pour obtenir des recommandations pour {activeMember?.name}</p>
            <Link href={`/profil/membres/${activeMember?.id}`}>
              <Button variant="outline" size="sm" className="mt-3">
                Voir le profil
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 5: Browse by Theme/Tone — Enhanced CuratedCollections
// ---------------------------------------------------------------------------

function BrowseByTheme() {
  // Tone-based categories (new enrichment v2 data) + existing genre collections
  const toneCollections = [
    {
      label: "Doux et rassurant",
      emoji: "🌿",
      description: "Pour les tout-petits",
      href: "/films/recherche?tones=Doux+et+rassurant,Doux+et+chaleureux&sortBy=quality&requirePoster=true",
      gradient: "from-emerald-400 to-teal-300",
    },
    {
      label: "Aventureux et exaltant",
      emoji: "🗺️",
      description: "Frissons et decouvertes",
      href: "/films/recherche?tones=Aventureux+et+exaltant&sortBy=quality&requirePoster=true",
      gradient: "from-amber-400 to-orange-300",
    },
    {
      label: "Fait reflechir",
      emoji: "💭",
      description: "Pour les ados",
      href: "/films/recherche?tones=Fait+r%C3%A9fl%C3%A9chir&sortBy=quality&requirePoster=true",
      gradient: "from-blue-400 to-indigo-300",
    },
    {
      label: "Joyeux et colore",
      emoji: "🌈",
      description: "Bonne humeur garantie",
      href: "/films/recherche?tones=Joyeux+et+color%C3%A9&sortBy=quality&requirePoster=true",
      gradient: "from-pink-400 to-rose-300",
    },
  ]

  return (
    <section className="py-12 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Explorer par ambiance</h2>
            <p className="text-sm text-gray-500 mt-1">Quel type d&apos;experience cherchez-vous ?</p>
          </div>
        </div>

        {/* Tone-based quick picks */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {toneCollections.map((col) => (
            <Link key={col.label} href={col.href}>
              <div className={`relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${col.gradient} text-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer`}>
                <span className="text-3xl">{col.emoji}</span>
                <h3 className="font-bold text-sm mt-2">{col.label}</h3>
                <p className="text-white/80 text-xs">{col.description}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Existing genre-based collections */}
        <CuratedCollections />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 7: CTA (logged-out) / Quick Actions (logged-in)
// ---------------------------------------------------------------------------

function BottomCTA({ session }: { session: HomepageV2Props["session"] }) {
  if (session?.user) {
    return (
      <section className="py-12 bg-gradient-to-br from-violet-600 to-indigo-700 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Que faire ensuite ?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/profil">
              <Button size="lg" className="bg-white text-violet-700 hover:bg-gray-100 rounded-full px-8 shadow-lg font-semibold">
                <Users className="h-4 w-4 mr-2" />
                Mon profil famille
              </Button>
            </Link>
            <Link href="/films">
              <Button size="lg" variant="outline" className="border-2 border-white/30 text-white hover:bg-white/10 rounded-full px-8 font-semibold">
                <Film className="h-4 w-4 mr-2" />
                Parcourir les films
              </Button>
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-16 bg-gradient-to-br from-violet-600 to-indigo-700 text-white">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-black mb-4">
          Creez votre profil famille en 2 minutes
        </h2>
        <p className="text-white/70 mb-10 max-w-xl mx-auto text-lg">
          Recevez des recommandations personnalisees pour chaque membre de votre famille.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/inscription">
            <Button size="lg" className="bg-white text-violet-700 hover:bg-gray-100 rounded-full px-8 shadow-lg font-semibold">
              Creer un compte gratuit
            </Button>
          </Link>
          <Link href="/recherche">
            <Button size="lg" variant="outline" className="border-2 border-white/30 text-white hover:bg-white/10 rounded-full px-8 font-semibold">
              Decouvrir sans compte
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Main HomepageV2
// ---------------------------------------------------------------------------

export function HomepageV2({ session }: HomepageV2Props) {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])

  useEffect(() => {
    if (!session?.user) return
    const fetchFamily = async () => {
      try {
        const res = await fetch("/api/user/family")
        if (res.ok) {
          const data = await res.json()
          setFamilyMembers(data.members || [])
        }
      } catch {
        // silently fail
      }
    }
    fetchFamily()
  }, [session?.user])

  return (
    <div className="flex flex-col">
      {/* Admin preview banner */}
      <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-center">
        <span className="text-sm text-amber-800 font-medium">
          Apercu admin — Design V2 (non visible par les utilisateurs)
        </span>
      </div>

      {/* Section 1: Hero */}
      <HeroV2 session={session} familyMembers={familyMembers} />

      {/* Section 2: For Your Family (logged-in only) */}
      {session?.user && <ForYourFamily familyMembers={familyMembers} />}

      {/* Section 3: Now in Cinema */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <NowInCinema />
        </div>
      </section>

      {/* Section 4: Streaming Tonight */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <StreamingSection />
        </div>
      </section>

      {/* Section 5: Browse by Theme */}
      <BrowseByTheme />

      {/* Section 6: Family Movie Night (logged-in only) */}
      {session?.user && (
        <section className="py-12 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto">
              <FamilyMovieNight />
            </div>
          </div>
        </section>
      )}

      {/* Section 7: CTA */}
      <BottomCTA session={session} />
    </div>
  )
}
