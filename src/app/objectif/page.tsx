import { Target, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = {
  title: "Notre objectif | Le Bon Avis Numérique",
  description: "Découvrez la mission et les objectifs du Bon Avis Numérique",
}

export default function ObjectifPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-12">
        <div className="inline-flex p-4 bg-green-100 rounded-full mb-6">
          <Target className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Notre objectif</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Ce que nous cherchons à accomplir pour les familles francophones.
        </p>
      </div>

      <Card>
        <CardContent className="p-8 text-center">
          <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Page en construction</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Cette page sera bientôt disponible avec une présentation complète
            de notre mission : aider les parents à faire des choix éclairés
            pour les contenus médiatiques de leurs enfants.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
