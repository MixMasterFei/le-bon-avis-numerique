import Link from "next/link"
import { ArrowRight, Shield, Star, Users, Film, Tv, Gamepad2, BookOpen, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MediaCard } from "@/components/media/MediaCard"
import { mockMediaItems } from "@/lib/mock-data"
import { HeroSearch } from "@/components/home/HeroSearch"
import { RecommendationWizard } from "@/components/home/RecommendationWizard"

const demoCounts = {
  MOVIE: mockMediaItems.filter((m) => m.type === "MOVIE").length,
  TV: mockMediaItems.filter((m) => m.type === "TV").length,
  GAME: mockMediaItems.filter((m) => m.type === "GAME").length,
  BOOK: mockMediaItems.filter((m) => m.type === "BOOK").length,
  APP: mockMediaItems.filter((m) => m.type === "APP").length,
}

const categories = [
  { name: "Films", href: "/films", icon: Film, count: demoCounts.MOVIE, color: "bg-red-500" },
  { name: "Séries TV", href: "/series", icon: Tv, count: demoCounts.TV, color: "bg-blue-500" },
  { name: "Jeux Vidéo", href: "/jeux", icon: Gamepad2, count: demoCounts.GAME, color: "bg-green-500" },
  { name: "Livres", href: "/livres", icon: BookOpen, count: demoCounts.BOOK, color: "bg-amber-500" },
  { name: "Applications", href: "/apps", icon: Smartphone, count: demoCounts.APP, color: "bg-purple-500" },
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
  const featuredItems = mockMediaItems.slice(0, 4)
  const recentItems = mockMediaItems.slice(0, 8)
  const connectedSources =
    (process.env.TMDB_API_KEY ? 1 : 0) +
    (process.env.GOOGLE_BOOKS_API_KEY ? 1 : 0) +
    (process.env.IGDB_CLIENT_ID && process.env.IGDB_CLIENT_SECRET ? 1 : 0)

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary via-blue-700 to-blue-900 text-white overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="container mx-auto px-4 py-16 md:py-24 relative">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-6 bg-white/20 text-white border-white/30 backdrop-blur-sm">
              🇫🇷 Le guide média pour les familles françaises
            </Badge>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Des choix médias
              <span className="text-emerald-400"> éclairés </span>
              pour vos enfants
            </h1>
            
            <p className="text-lg md:text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Découvrez des films, séries, jeux et livres adaptés à chaque âge grâce à nos avis experts et notre communauté de parents engagés.
            </p>

            {/* Search Bar */}
            <div className="max-w-xl mx-auto mb-8">
              <HeroSearch />
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap justify-center gap-8 text-sm">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{mockMediaItems.length}</div>
                <div className="text-blue-200">Médias (démo)</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{connectedSources}</div>
                <div className="text-blue-200">Sources connectées</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">
                  {connectedSources > 0 ? "API" : "Démo"}
                </div>
                <div className="text-blue-200">Mode données</div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave Separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 50L60 45.7C120 41 240 33 360 37.5C480 42 600 58 720 62.5C840 67 960 58 1080 50C1200 42 1320 33 1380 29.2L1440 25V100H1380C1320 100 1200 100 1080 100C960 100 840 100 720 100C600 100 480 100 360 100C240 100 120 100 60 100H0V50Z" fill="#f8fafc"/>
          </svg>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {categories.map((category) => (
              <Link key={category.name} href={category.href}>
                <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full">
                  <CardContent className="p-6 text-center">
                    <div className={`inline-flex p-4 rounded-2xl ${category.color} text-white mb-4 group-hover:scale-110 transition-transform`}>
                      <category.icon className="h-8 w-8" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{category.name}</h3>
                    <p className="text-sm text-gray-500">
                      {connectedSources > 0
                        ? "Explorer"
                        : `${category.count.toLocaleString("fr-FR")} titres (démo)`}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Recommendation Wizard (demo) */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <RecommendationWizard />
        </div>
      </section>

      {/* Featured Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Sélection de nos experts</h2>
              <p className="text-gray-600 mt-1">Des choix de qualité recommandés par notre équipe</p>
            </div>
            <Button variant="outline" asChild className="hidden sm:inline-flex">
              <Link href="/selection">
                Voir tout <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {featuredItems.map((item, index) => (
              <div key={item.id} className={`animate-fade-in stagger-${index + 1}`} style={{ opacity: 0 }}>
                <MediaCard media={item} />
              </div>
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Button variant="outline" asChild>
              <Link href="/selection">
                Voir tout <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
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
            {features.map((feature, index) => (
              <Card key={feature.title} className={`animate-fade-in stagger-${index + 1} border-0 shadow-lg`} style={{ opacity: 0 }}>
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

      {/* Recent Reviews Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Récemment évalués</h2>
              <p className="text-gray-600 mt-1">Les dernières critiques de notre équipe</p>
            </div>
            <Button variant="outline" asChild className="hidden sm:inline-flex">
              <Link href="/nouveautes">
                Voir tout <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 md:gap-6">
            {recentItems.map((item, index) => (
              <div key={item.id} className={`animate-fade-in stagger-${(index % 5) + 1}`} style={{ opacity: 0 }}>
                <MediaCard media={item} />
              </div>
            ))}
          </div>
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
