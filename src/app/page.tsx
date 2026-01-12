import Link from "next/link"
import { Film, Tv, Gamepad2, BookOpen, Smartphone, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HeroSearch } from "@/components/home/HeroSearch"
import { RecommendationWizard } from "@/components/home/RecommendationWizard"
import { FeaturedMovies } from "@/components/home/FeaturedMovies"
import { FamilyImageSection, TestimonialsSection } from "@/components/home/FamilyImageSection"
import { FamilyMovieNight } from "@/components/home/FamilyMovieNight"
import { NewArrivals } from "@/components/home/NewArrivals"
import { ExpertPicks } from "@/components/home/ExpertPicks"
import { CuratedCollections } from "@/components/home/CuratedCollections"
import { TrustBanner } from "@/components/home/TrustBanner"
import { StreamingSection } from "@/components/home/StreamingSection"

const categories = [
  { name: "Films", href: "/films", icon: Film, color: "bg-gradient-to-br from-rose-500 to-orange-400", textColor: "text-rose-600" },
  { name: "Séries", href: "/series", icon: Tv, color: "bg-gradient-to-br from-violet-500 to-purple-400", textColor: "text-violet-600" },
  { name: "Jeux", href: "/jeux", icon: Gamepad2, color: "bg-gradient-to-br from-emerald-500 to-teal-400", textColor: "text-emerald-600" },
  { name: "Livres", href: "/livres", icon: BookOpen, color: "bg-gradient-to-br from-amber-500 to-yellow-400", textColor: "text-amber-600" },
  { name: "Apps", href: "/apps", icon: Smartphone, color: "bg-gradient-to-br from-cyan-500 to-blue-400", textColor: "text-cyan-600" },
]

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section - Bold, Playful, Distinctive */}
      <section className="relative bg-gradient-to-br from-violet-600 via-purple-600 to-pink-500 text-white overflow-visible">
        {/* Animated blob backgrounds */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-orange-400/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-pink-400/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-400/20 rounded-full blur-3xl" />
        </div>

        {/* Geometric shapes */}
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute top-10 left-10 w-20 h-20 border-4 border-white/40 rounded-full" />
          <div className="absolute top-20 right-20 w-12 h-12 bg-orange-400/60 rotate-45" />
          <div className="absolute bottom-20 left-1/4 w-8 h-8 bg-pink-300/60 rounded-full" />
        </div>

        <div className="container mx-auto px-4 py-12 md:py-16 relative">
          <div className="max-w-3xl mx-auto text-center">
            {/* Trust Badge - Playful pill */}
            <div className="inline-flex items-center gap-2 mb-6 px-5 py-2 bg-white/20 backdrop-blur-md rounded-full border border-white/30 shadow-lg">
              <Shield className="h-5 w-5 text-emerald-300" />
              <span className="text-sm font-semibold">Le guide de référence pour choisir les médias de vos enfants</span>
            </div>

            {/* Search Bar */}
            <div className="max-w-xl mx-auto relative z-50">
              <HeroSearch />
            </div>
          </div>
        </div>

        {/* Wave Separator - More organic shape */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-8">
            <path d="M0 30C120 50 240 10 480 30C720 50 960 10 1200 30C1320 40 1380 35 1440 30V60H0V30Z" fill="#fffbf5"/>
          </svg>
        </div>
      </section>

      {/* Categories Section - Playful floating pills */}
      <section className="py-6 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((category) => (
              <Link key={category.name} href={category.href}>
                <div className="group flex items-center gap-3 px-5 py-3 bg-white hover:bg-violet-50 rounded-2xl shadow-md hover:shadow-lg border border-violet-100 hover:border-violet-200 transition-all duration-300 whitespace-nowrap hover:-translate-y-1">
                  <div className={`p-2 rounded-xl ${category.color} text-white group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                    <category.icon className="h-5 w-5" />
                  </div>
                  <span className="font-semibold text-sm text-gray-700 group-hover:text-violet-700">{category.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Expert Picks Section */}
      <section className="py-12 bg-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="container mx-auto px-4 relative">
          <ExpertPicks />
        </div>
      </section>

      {/* Featured Movies Section */}
      <section className="py-12 bg-gradient-to-br from-violet-50 via-background to-pink-50 relative">
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-100/50 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        <div className="container mx-auto px-4 relative">
          <FeaturedMovies />
        </div>
      </section>

      {/* Family Image Section */}
      <FamilyImageSection />

      {/* Streaming Section */}
      <section className="py-12 bg-white relative overflow-hidden">
        <div className="absolute top-1/2 right-0 w-72 h-72 bg-cyan-100/40 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
        <div className="container mx-auto px-4 relative">
          <StreamingSection />
        </div>
      </section>

      {/* Curated Collections */}
      <section className="py-12 bg-gradient-to-br from-amber-50 via-background to-violet-50 relative">
        <div className="absolute top-0 left-1/4 w-40 h-40 bg-pink-100/50 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 relative">
          <CuratedCollections />
        </div>
      </section>

      {/* New Arrivals Section */}
      <section className="py-12 bg-white relative overflow-hidden">
        <div className="absolute bottom-0 right-1/4 w-56 h-56 bg-emerald-100/40 rounded-full blur-3xl translate-y-1/2" />
        <div className="container mx-auto px-4 relative">
          <NewArrivals />
        </div>
      </section>

      {/* Recommendation Wizard */}
      <section className="py-12 bg-gradient-to-r from-violet-50 to-pink-50">
        <div className="container mx-auto px-4">
          <RecommendationWizard />
        </div>
      </section>

      {/* Family Movie Night */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <FamilyMovieNight />
          </div>
        </div>
      </section>

      {/* Trust Banner - NEW */}
      <TrustBanner />

      {/* CTA Section - Bold gradient with personality */}
      <section className="py-16 bg-gradient-to-br from-violet-600 via-purple-600 to-pink-500 text-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -left-20 w-60 h-60 bg-orange-400/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-pink-400/20 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 text-center relative">
          <h2 className="text-3xl md:text-4xl font-black mb-4">
            Rejoignez notre communauté de parents
          </h2>
          <p className="text-white/90 mb-10 max-w-2xl mx-auto text-lg">
            Partagez vos avis, recevez des recommandations personnalisées et aidez d&apos;autres familles à faire les bons choix.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/inscription">
              <Button size="lg" className="bg-white text-violet-700 hover:bg-violet-50 rounded-full px-8 shadow-lg shadow-violet-900/30 hover:shadow-xl hover:scale-105 transition-all duration-300 font-semibold">
                Créer un compte gratuit
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white/20 rounded-full px-8 font-semibold">
                En savoir plus
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
