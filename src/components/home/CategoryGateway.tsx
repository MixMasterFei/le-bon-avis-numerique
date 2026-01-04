"use client"

import Link from "next/link"
import { Film, Tv, Gamepad2, ArrowRight } from "lucide-react"

const categories = [
  {
    name: "Films",
    description: "Des classiques Disney aux nouveautes",
    href: "/films",
    icon: Film,
    gradient: "from-red-500 to-orange-500",
    hoverGradient: "hover:from-red-600 hover:to-orange-600",
    count: "2000+",
  },
  {
    name: "Series",
    description: "Dessins animes et series familiales",
    href: "/series",
    icon: Tv,
    gradient: "from-blue-500 to-indigo-500",
    hoverGradient: "hover:from-blue-600 hover:to-indigo-600",
    count: "500+",
  },
  {
    name: "Jeux video",
    description: "Jeux adaptes a chaque age",
    href: "/jeux",
    icon: Gamepad2,
    gradient: "from-green-500 to-emerald-500",
    hoverGradient: "hover:from-green-600 hover:to-emerald-600",
    count: "300+",
  },
]

export function CategoryGateway() {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900">Explorez par categorie</h2>
        <p className="text-sm text-gray-600">Trouvez le contenu adapte a votre famille</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {categories.map((category) => (
          <Link
            key={category.name}
            href={category.href}
            className="group"
          >
            <div
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${category.gradient} ${category.hoverGradient} p-6 text-white shadow-lg transition-all duration-300 group-hover:shadow-xl group-hover:scale-[1.02]`}
            >
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M20 20c0-5.5-4.5-10-10-10S0 14.5 0 20s4.5 10 10 10 10-4.5 10-10zm10 0c0 5.5 4.5 10 10 10s10-4.5 10-10-4.5-10-10-10-10 4.5-10 10z'/%3E%3C/g%3E%3C/svg%3E")`,
                }} />
              </div>

              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-xl">
                    <category.icon className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">
                    {category.count} titres
                  </span>
                </div>

                <h3 className="text-xl font-bold mb-1">{category.name}</h3>
                <p className="text-sm text-white/80 mb-4">{category.description}</p>

                <div className="flex items-center text-sm font-medium group-hover:translate-x-1 transition-transform">
                  Explorer <ArrowRight className="h-4 w-4 ml-1" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
