"use client"

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { Home, Users, Heart, Bookmark, Clock } from "lucide-react"
import { WelcomeHeader } from "@/components/chez-vous/WelcomeHeader"
import { UserListsPreview } from "@/components/chez-vous/UserListsPreview"
import { FamilyRecommendationsSection } from "@/components/chez-vous/FamilyRecommendationsSection"
import { FamilyMovieNightSection } from "@/components/chez-vous/FamilyMovieNightSection"

export default function ChezVousPage() {
  const { data: session, status } = useSession()

  // Redirect to login if not authenticated
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    redirect("/connexion?callbackUrl=/chez-vous")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-xl">
              <Home className="h-6 w-6" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">Chez vous</h1>
          </div>
          <p className="text-white/80">
            Votre espace personnalisé pour toute la famille
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Header with Stats */}
        <WelcomeHeader />

        {/* Family Recommendations */}
        <section>
          <FamilyRecommendationsSection />
        </section>

        {/* Family Movie Night */}
        <section>
          <FamilyMovieNightSection />
        </section>

        {/* User Lists Preview */}
        <section>
          <UserListsPreview />
        </section>
      </div>
    </div>
  )
}
