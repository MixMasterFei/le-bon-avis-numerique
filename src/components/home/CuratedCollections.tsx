"use client"

import Link from "next/link"
import { ArrowRight, Plane, Heart, Laugh, Wand2, Dog, Music, Rocket, BookOpen } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface Collection {
  id: string
  title: string
  description: string
  icon: any
  color: string
  bgGradient: string
  href: string
  count?: number
}

const collections: Collection[] = [
  {
    id: "adventure",
    title: "Aventure & Exploration",
    description: "Voyages, decouvertes et expeditions",
    icon: Plane,
    color: "text-sky-600",
    bgGradient: "from-sky-100 to-blue-100",
    href: "/films/recherche?genres=Aventure&sortBy=quality&requirePoster=true",
  },
  {
    id: "animals",
    title: "Animaux & Nature",
    description: "Nos amis les betes",
    icon: Dog,
    color: "text-amber-600",
    bgGradient: "from-amber-100 to-orange-100",
    href: "/films/recherche?topics=Animaux,Nature&sortBy=quality&requirePoster=true",
  },
  {
    id: "comedy",
    title: "Comédies",
    description: "Rires garantis pour tous",
    icon: Laugh,
    color: "text-pink-600",
    bgGradient: "from-pink-100 to-rose-100",
    href: "/films/recherche?genres=Comédie&sortBy=quality&requirePoster=true",
  },
  {
    id: "fantasy",
    title: "Fantastique",
    description: "Mondes enchantes et creatures magiques",
    icon: Wand2,
    color: "text-purple-600",
    bgGradient: "from-purple-100 to-violet-100",
    href: "/films/recherche?genres=Fantastique&sortBy=quality&requirePoster=true",
  },
  {
    id: "music",
    title: "Musique & Danse",
    description: "Comédies musicales et films musicaux",
    icon: Music,
    color: "text-emerald-600",
    bgGradient: "from-emerald-100 to-teal-100",
    href: "/films/recherche?genres=Musique&sortBy=quality&requirePoster=true",
  },
  {
    id: "scifi",
    title: "Science-Fiction",
    description: "L'espace et le futur",
    icon: Rocket,
    color: "text-indigo-600",
    bgGradient: "from-indigo-100 to-blue-100",
    href: "/films/recherche?genres=Science-Fiction&sortBy=quality&requirePoster=true",
  },
  {
    id: "family",
    title: "Drame & Famille",
    description: "Histoires émouvantes pour toute la famille",
    icon: Heart,
    color: "text-red-500",
    bgGradient: "from-red-100 to-pink-100",
    href: "/films/recherche?genres=Drame,Famille&sortBy=quality&requirePoster=true",
  },
  {
    id: "animation",
    title: "Animation",
    description: "Dessins animés et films d'animation",
    icon: BookOpen,
    color: "text-teal-600",
    bgGradient: "from-teal-100 to-cyan-100",
    href: "/films/recherche?genres=Animation&sortBy=quality&requirePoster=true",
  },
]

function CollectionCard({ collection }: { collection: Collection }) {
  const Icon = collection.icon

  return (
    <Link href={collection.href}>
      <Card className={`group h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br ${collection.bgGradient}`}>
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`p-2.5 rounded-xl bg-white/80 shadow-sm ${collection.color} group-hover:scale-110 transition-transform`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm line-clamp-1 group-hover:text-primary transition-colors">
              {collection.title}
            </h3>
            <p className="text-xs text-gray-600 line-clamp-1">
              {collection.description}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
        </CardContent>
      </Card>
    </Link>
  )
}

export function CuratedCollections() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">
            Explorer par theme
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Trouvez le film parfait selon vos envies
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {collections.map((collection) => (
          <CollectionCard key={collection.id} collection={collection} />
        ))}
      </div>
    </div>
  )
}
