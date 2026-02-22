import Image from "next/image"
import Link from "next/link"
import { Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HeroSearch } from "@/components/home/HeroSearch"
import { RecommendationWizard } from "@/components/home/RecommendationWizard"
import { FeaturedMovies } from "@/components/home/FeaturedMovies"
import { FamilyImageSection } from "@/components/home/FamilyImageSection"
import { FamilyMovieNight } from "@/components/home/FamilyMovieNight"
import { NewArrivals } from "@/components/home/NewArrivals"
import { ExpertPicks } from "@/components/home/ExpertPicks"
import { CuratedCollections } from "@/components/home/CuratedCollections"
import { TrustBanner } from "@/components/home/TrustBanner"
import { StreamingSection } from "@/components/home/StreamingSection"
import { NowInCinema } from "@/components/home/NowInCinema"

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-visible">
        {/* Banner background image */}
        <div className="absolute inset-0">
          <Image
            src="/hero-banner.jpeg"
            alt=""
            fill
            className="object-cover"
            priority
          />
          {/* Bright overlay for a lighter, airy feel */}
          <div className="absolute inset-0 bg-white/50" />
          {/* Gradient fade at bottom to blend with page */}
          <div className="absolute inset-0 bg-gradient-to-t from-white/70 via-transparent to-white/30" />
        </div>

        <div className="container mx-auto px-4 py-14 md:py-20 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 mb-6 px-5 py-2 bg-violet-600/15 backdrop-blur-sm rounded-full border border-violet-300/30">
              <Shield className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-medium text-gray-800">Le guide de référence pour choisir vos médias en famille</span>
            </div>

            <div className="max-w-xl mx-auto relative z-40">
              <HeroSearch />
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-8">
            <path d="M0 30C120 50 240 10 480 30C720 50 960 10 1200 30C1320 40 1380 35 1440 30V60H0V30Z" fill="#fffbf5"/>
          </svg>
        </div>
      </section>

      {/* Expert Picks */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <ExpertPicks />
        </div>
      </section>

      {/* Now in Cinema */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <NowInCinema />
        </div>
      </section>

      {/* Featured Movies */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <FeaturedMovies />
        </div>
      </section>

      {/* Family Image Section */}
      <FamilyImageSection />

      {/* Streaming */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <StreamingSection />
        </div>
      </section>

      {/* Curated Collections */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <CuratedCollections />
        </div>
      </section>

      {/* New Arrivals */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <NewArrivals />
        </div>
      </section>

      {/* Recommendation Wizard */}
      <section className="py-12 bg-background">
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

      {/* Trust Banner */}
      <TrustBanner />

      {/* CTA Section */}
      <section className="py-16 bg-slate-900 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-4">
            Rejoignez notre communauté de parents
          </h2>
          <p className="text-white/70 mb-10 max-w-2xl mx-auto text-lg">
            Partagez vos avis, recevez des recommandations personnalisées et aidez d&apos;autres familles à faire les bons choix.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/inscription">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-gray-100 rounded-full px-8 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 font-semibold">
                Créer un compte gratuit
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-2 border-white/30 text-white hover:bg-white/10 rounded-full px-8 font-semibold">
                En savoir plus
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
