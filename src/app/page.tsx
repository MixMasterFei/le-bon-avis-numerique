import Link from "next/link"
import { Shield, Star, Users, Film, Tv, Gamepad2, BookOpen, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { HeroSearch } from "@/components/home/HeroSearch"
import { RecommendationWizard } from "@/components/home/RecommendationWizard"
import { FeaturedMovies } from "@/components/home/FeaturedMovies"
import { RecentMovies } from "@/components/home/RecentMovies"
import { FamilyImageSection, TestimonialsSection } from "@/components/home/FamilyImageSection"

const categories = [
  { name: "Films", href: "/films", icon: Film, color: "bg-red-500" },
  { name: "Séries TV", href: "/series", icon: Tv, color: "bg-blue-500" },
  { name: "Jeux Vidéo", href: "/jeux", icon: Gamepad2, color: "bg-green-500" },
  { name: "Livres", href: "/livres", icon: BookOpen, color: "bg-amber-500" },
  { name: "Applications", href: "/apps", icon: Smartphone, color: "bg-purple-500" },
]

const features = [
  {
    icon: Shield,
    title: "Évaluations indépendantes",
    description: "Des experts analysent chaque contenu pour vous donner des avis objectifs et fiables.",
  },
  {
    icon: Users,
    title: "Avis de la communauté",
    description: "Parents, enfants et éducateurs partagent leurs expériences pour vous guider.",
  },
  {
    icon: Star,
    title: "Recommandations par âge",
    description: "Trouvez facilement ce qui convient à l'âge de votre enfant grâce à notre système de notation.",
  },
]

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section - Compact */}
      <section className="relative bg-gradient-to-br from-primary via-blue-700 to-blue-900 text-white overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="container mx-auto px-4 py-8 md:py-12 relative">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-3 bg-white/20 text-white border-white/30 backdrop-blur-sm text-xs">
              🇫🇷 Le guide média pour les familles françaises
            </Badge>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 leading-tight">
              Des choix médias
              <span className="text-emerald-400"> éclairés </span>
              pour vos enfants
            </h1>

            <p className="text-base md:text-lg text-blue-100 mb-5 max-w-2xl mx-auto">
              Films, séries, jeux et livres adaptés à chaque âge grâce à nos avis experts.
            </p>

            {/* Search Bar */}
            <div className="max-w-xl mx-auto">
              <HeroSearch />
            </div>
          </div>
        </div>

        {/* Wave Separator - Smaller */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 50" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-4">
            <path d="M0 25L60 22.8C120 20.5 240 16.5 360 18.8C480 21 600 29 720 31.3C840 33.5 960 29 1080 25C1200 21 1320 16.5 1380 14.6L1440 12.5V50H1380C1320 50 1200 50 1080 50C960 50 840 50 720 50C600 50 480 50 360 50C240 50 120 50 60 50H0V25Z" fill="#f8fafc"/>
          </svg>
        </div>
      </section>

      {/* Categories Section - Compact */}
      <section className="pt-4 pb-6 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {categories.map((category) => (
              <Link key={category.name} href={category.href}>
                <Card className="group hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 h-full">
                  <CardContent className="p-4 text-center">
                    <div className={`inline-flex p-3 rounded-xl ${category.color} text-white mb-2 group-hover:scale-105 transition-transform`}>
                      <category.icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-medium text-gray-900 text-sm">{category.name}</h3>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Movies Section */}
      <section className="py-8 bg-white">
        <div className="container mx-auto px-4">
          <FeaturedMovies />
        </div>
      </section>

      {/* Recommendation Wizard */}
      <section className="py-8 bg-gray-50">
        <div className="container mx-auto px-4">
          <RecommendationWizard />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              Pourquoi nous faire confiance ?
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Nous aidons les familles à naviguer dans l&apos;univers des médias numériques avec confiance et sérénité.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <Card key={feature.title} className="border-0 shadow-lg">
                <CardContent className="p-8 text-center">
                  <div className="inline-flex p-4 rounded-2xl bg-primary/10 text-primary mb-6">
                    <feature.icon className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Family Image Section */}
      <FamilyImageSection />

      {/* Testimonials Section */}
      <TestimonialsSection />

      {/* Recent Movies Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <RecentMovies />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Rejoignez notre communauté de parents
          </h2>
          <p className="text-emerald-100 mb-8 max-w-2xl mx-auto">
            Partagez vos avis, recevez des recommandations personnalisées et aidez d&apos;autres familles à faire les bons choix.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50">
              Créer un compte gratuit
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
              En savoir plus
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
