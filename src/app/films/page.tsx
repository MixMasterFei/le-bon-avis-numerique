"use client"

import { Film, Search, SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MovieCategoryRow, type CategoryConfig } from "@/components/media/MovieCategoryRow"

// Define all movie categories with their API parameters
const MOVIE_CATEGORIES: CategoryConfig[] = [
  {
    id: "family-favorites",
    title: "Films pour les enfants",
    subtitle: "Adaptés aux plus jeunes, évalués par nos experts",
    apiParams: "limit=20&maxAge=8&genres=Animation,Famille,Aventure,Comédie",
    linkHref: "/films/recherche?maxAge=8",
  },
  {
    id: "recent",
    title: "Récemment évalués",
    subtitle: "Les dernières critiques de notre équipe",
    apiParams: "limit=20&maxAge=12",
    linkHref: "/films/recherche?maxAge=12",
  },
  {
    id: "animation",
    title: "Films d'animation",
    subtitle: "Dessins animés et films animés pour tous les âges",
    apiParams: "limit=20&genres=Animation",
    linkHref: "/films/recherche?topics=Animation",
  },
  {
    id: "adventure",
    title: "Films d'aventure",
    subtitle: "Action et aventures pour toute la famille",
    apiParams: "limit=20&genres=Aventure,Famille&requireAllGenres=true&maxAge=12&excludeGenres=Horreur,Thriller,Crime,Guerre",
    linkHref: "/films/recherche?topics=Aventure&maxAge=12",
  },
  {
    id: "comedy",
    title: "Comédies familiales",
    subtitle: "Des films drôles à regarder ensemble",
    apiParams: "limit=20&genres=Comédie,Famille&requireAllGenres=true&maxAge=12&excludeGenres=Action,Horreur,Thriller,Crime,Guerre,Drame,Romance",
    linkHref: "/films/recherche?topics=Comédie&maxAge=12",
  },
  {
    id: "teens",
    title: "Pour les adolescents",
    subtitle: "Films adaptés aux 12 ans et plus",
    apiParams: "limit=20&maxAge=16",
    linkHref: "/films/recherche?maxAge=16",
  },
  {
    id: "fantasy",
    title: "Fantastique et Science-Fiction",
    subtitle: "Mondes imaginaires et aventures épiques",
    apiParams: "limit=20&genres=Fantastique,Science-Fiction&maxAge=14",
    linkHref: "/films/recherche?topics=Fantastique,Science-Fiction",
  },
  {
    id: "drama",
    title: "Drames familiaux",
    subtitle: "Des histoires touchantes pour réfléchir ensemble",
    apiParams: "limit=20&genres=Drame,Famille&requireAllGenres=true&maxAge=12&excludeGenres=Horreur,Thriller,Crime,Guerre",
    linkHref: "/films/recherche?topics=Drame&maxAge=12",
  },
]

export default function FilmsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-slate-700 to-slate-800 text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-white/20 rounded-xl">
                  <Film className="h-8 w-8" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold">Films</h1>
              </div>
              <p className="text-red-100 text-lg max-w-xl">
                Découvrez les meilleurs films pour toute la famille avec nos critiques
                et recommandations par âge.
              </p>
            </div>

            {/* Search & Filter Actions */}
            <div className="flex gap-3">
              <Button
                asChild
                variant="secondary"
                size="lg"
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                <Link href="/films/recherche">
                  <Search className="h-5 w-5 mr-2" />
                  Rechercher
                </Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                size="lg"
                className="bg-white hover:bg-white/90 text-slate-700"
              >
                <Link href="/films/recherche">
                  <SlidersHorizontal className="h-5 w-5 mr-2" />
                  Filtrer
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Category Sections */}
      <div className="container mx-auto px-4 py-8">
        {MOVIE_CATEGORIES.map((category) => (
          <MovieCategoryRow key={category.id} category={category} />
        ))}
      </div>
    </div>
  )
}
