"use client"

import Link from "next/link"
import { Shield, Heart, Users, BookOpen, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

const trustPoints = [
  {
    icon: Shield,
    title: "Indépendant",
    description: "Évaluations objectives sans influence commerciale",
  },
  {
    icon: Heart,
    title: "Pour les familles",
    description: "Créé par des parents, pour des parents",
  },
  {
    icon: Users,
    title: "Communautaire",
    description: "Avis vérifiés de milliers de familles",
  },
  {
    icon: BookOpen,
    title: "Éducatif",
    description: "Ressources pour une consommation responsable",
  },
]

export function TrustBanner() {
  return (
    <section className="py-12 bg-gradient-to-b from-gray-50 to-white border-t border-gray-100">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full mb-4">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Totem Avisé</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            Votre guide de confiance pour les médias en famille
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Nous aidons les familles françaises à faire des choix éclairés sur les films,
            séries, jeux et livres pour leurs enfants. Notre mission : des médias adaptés
            à chaque âge, analysés pour votre famille.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          {trustPoints.map((point) => {
            const Icon = point.icon
            return (
              <div key={point.title} className="text-center">
                <div className="inline-flex p-3 rounded-2xl bg-white shadow-sm border border-gray-100 mb-3">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{point.title}</h3>
                <p className="text-sm text-gray-600">{point.description}</p>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/a-propos">
            <Button variant="outline" size="lg">
              En savoir plus sur notre mission
            </Button>
          </Link>
          <Link href="/inscription">
            <Button size="lg" className="bg-primary hover:bg-primary/90">
              Rejoindre la communauté
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
