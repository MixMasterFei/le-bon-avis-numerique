"use client"

import { Film, Search, SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MovieCategoryRow, type CategoryConfig } from "@/components/media/MovieCategoryRow"
import { StreamingSection } from "@/components/home/StreamingSection"
import { CuratedCollections } from "@/components/home/CuratedCollections"

// Define all movie categories with their API parameters
// All categories filter to French/English content (language=fr,en) for French audience relevance
const MOVIE_CATEGORIES: CategoryConfig[] = [
  {
    id: "family-favorites",
    title: "Films pour les enfants",
    subtitle: "Adaptes aux plus jeunes, evalues par nos experts",
    apiParams: "limit=20&maxAge=7&genres=Animation,Famille&excludeGenres=Romance,Drame,Horreur,Thriller,Crime,Guerre&language=fr,en&requirePoster=true",
    linkHref: "/films/recherche?maxAge=7",
  },
  {
    id: "recent",
    title: "Recemment evalues",
    subtitle: "Les dernieres critiques de notre equipe",
    apiParams: "limit=20&maxAge=12&language=fr,en&requirePoster=true",
    linkHref: "/films/recherche?maxAge=12",
  },
  {
    id: "animation",
    title: "Films d'animation",
    subtitle: "Dessins animes et films animes pour tous les ages",
    apiParams: "limit=20&genres=Animation&language=fr,en&requirePoster=true",
    linkHref: "/films/recherche?topics=Animation",
  },
  {
    id: "adventure",
    title: "Films d'aventure",
    subtitle: "Action et aventures pour toute la famille",
    apiParams: "limit=20&genres=Aventure,Famille&requireAllGenres=true&maxAge=12&excludeGenres=Horreur,Thriller,Crime,Guerre&language=fr,en&requirePoster=true",
    linkHref: "/films/recherche?topics=Aventure&maxAge=12",
  },
  {
    id: "comedy",
    title: "Comedies familiales",
    subtitle: "Des films droles a regarder ensemble",
    apiParams: "limit=20&genres=Comedie,Famille&requireAllGenres=true&maxAge=12&excludeGenres=Action,Horreur,Thriller,Crime,Guerre,Drame,Romance&language=fr,en&requirePoster=true",
    linkHref: "/films/recherche?topics=Comedie&maxAge=12",
  },
  {
    id: "teens",
    title: "Pour les adolescents",
    subtitle: "Films adaptes aux 12 ans et plus",
    apiParams: "limit=20&maxAge=16&language=fr,en&requirePoster=true",
    linkHref: "/films/recherche?maxAge=16",
  },
  {
    id: "fantasy",
    title: "Fantastique et Science-Fiction",
    subtitle: "Mondes imaginaires et aventures epiques",
    apiParams: "limit=20&genres=Fantastique,Science-Fiction&maxAge=14&language=fr,en&requirePoster=true",
    linkHref: "/films/recherche?topics=Fantastique,Science-Fiction",
  },
  {
    id: "drama",
    title: "Drames familiaux",
    subtitle: "Des histoires touchantes pour reflechir ensemble",
    apiParams: "limit=20&genres=Drame,Famille&requireAllGenres=true&maxAge=12&excludeGenres=Horreur,Thriller,Crime,Guerre&language=fr,en&requirePoster=true",
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
              <p className="text-gray-300 text-lg max-w-xl">
                Decouvrez les meilleurs films pour toute la famille avec nos critiques
                et recommandations par age.
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

      {/* Streaming Section - What's on your platforms */}
      <div className="container mx-auto px-4 py-8">
        <StreamingSection />
      </div>

      {/* Curated Collections */}
      <div className="bg-white">
        <div className="container mx-auto px-4 py-8">
          <CuratedCollections />
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
