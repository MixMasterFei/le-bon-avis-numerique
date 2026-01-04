import Link from "next/link"
import { Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HeroSearch } from "@/components/home/HeroSearch"
import { ValueProofBar } from "@/components/home/ValueProofBar"
import { ContentPreview } from "@/components/home/ContentPreview"
import { CategoryGateway } from "@/components/home/CategoryGateway"
import { WizardTeaser } from "@/components/home/WizardTeaser"
import { TestimonialsSection } from "@/components/home/FamilyImageSection"

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* 1. Hero Section - Value prop + Search */}
      <section className="relative bg-gradient-to-br from-primary via-blue-700 to-blue-900 text-white overflow-visible">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10 overflow-hidden">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="container mx-auto px-4 py-8 md:py-12 relative">
          <div className="max-w-3xl mx-auto text-center">
            {/* Trust Badge */}
            <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 bg-white/15 backdrop-blur-sm rounded-full border border-white/20">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium">Le guide independant pour les parents numeriques</span>
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 leading-tight">
              Les evaluations que
              <span className="text-emerald-400"> les parents </span>
              peuvent faire confiance
            </h1>

            <p className="text-base md:text-lg text-blue-100 mb-5 max-w-2xl mx-auto">
              Des avis experts et independants sur les films, series, jeux et livres.
              Nous ne sommes pas payes par les studios.
            </p>

            {/* Search Bar */}
            <div className="max-w-xl mx-auto relative z-50">
              <HeroSearch />
            </div>
          </div>
        </div>

        {/* Wave Separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 50" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-4">
            <path d="M0 25L60 22.8C120 20.5 240 16.5 360 18.8C480 21 600 29 720 31.3C840 33.5 960 29 1080 25C1200 21 1320 16.5 1380 14.6L1440 12.5V50H1380C1320 50 1200 50 1080 50C960 50 840 50 720 50C600 50 480 50 360 50C240 50 120 50 60 50H0V25Z" fill="#ffffff"/>
          </svg>
        </div>
      </section>

      {/* 2. Value Proof Bar - 4 trust icons */}
      <section className="py-6 bg-white">
        <div className="container mx-auto px-4">
          <ValueProofBar />
        </div>
      </section>

      {/* 3. Content Preview - 8 mixed items */}
      <section className="py-8 bg-gray-50">
        <div className="container mx-auto px-4">
          <ContentPreview />
        </div>
      </section>

      {/* 4. Category Gateway - 3 visual cards */}
      <section className="py-8 bg-white">
        <div className="container mx-auto px-4">
          <CategoryGateway />
        </div>
      </section>

      {/* 5. Wizard Teaser - Age selector + CTA */}
      <section className="py-8 bg-gray-50">
        <div className="container mx-auto px-4">
          <WizardTeaser />
        </div>
      </section>

      {/* 6. Testimonials + CTA */}
      <TestimonialsSection />

      {/* Final CTA Section */}
      <section className="py-12 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Rejoignez notre communaute de parents
          </h2>
          <p className="text-emerald-100 mb-8 max-w-2xl mx-auto">
            Partagez vos avis, recevez des recommandations personnalisees et aidez d&apos;autres familles a faire les bons choix.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/inscription">
              <Button size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50">
                Creer un compte gratuit
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                En savoir plus
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
