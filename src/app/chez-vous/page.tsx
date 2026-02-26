"use client"

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { Sparkles } from "lucide-react"
import { WelcomeHeader } from "@/components/chez-vous/WelcomeHeader"
import { UserListsPreview } from "@/components/chez-vous/UserListsPreview"
import { FamilyRecommendationsSection } from "@/components/chez-vous/FamilyRecommendationsSection"
import { FamilyMovieNightSection } from "@/components/chez-vous/FamilyMovieNightSection"

export default function ChezVousPage() {
  const { data: session, status } = useSession()

  // Redirect to login if not authenticated
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-20">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
            <p className="text-sm text-gray-500">Chargement de votre espace...</p>
          </div>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    redirect("/connexion?callbackUrl=/chez-vous")
  }

  const firstName = session?.user?.name?.split(" ")[0] || "vous"

  return (
    <div className="min-h-screen bg-background">
      {/* Hero — warm, airy, matching homepage aesthetic */}
      <div className="relative overflow-hidden border-b border-gray-100">
        {/* Subtle warm gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-orange-50/60" />
        {/* Decorative blobs */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-violet-100/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-orange-100/40 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 py-10 md:py-14 relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-md shadow-violet-200">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900">
              Bonjour, {firstName}
            </h1>
          </div>
          <p className="text-gray-500 max-w-lg">
            Retrouvez vos recommandations personnalisées, vos listes et votre espace famille.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-10">
        {/* Stats & Quick Actions */}
        <WelcomeHeader />

        {/* Family Recommendations */}
        <FamilyRecommendationsSection />

        {/* Family Movie Night */}
        <FamilyMovieNightSection />

        {/* User Lists Preview */}
        <UserListsPreview />
      </div>
    </div>
  )
}
