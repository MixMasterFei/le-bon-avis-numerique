import { Newspaper, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = {
  title: "Notre blog | Le Bon Avis Numérique",
  description: "Articles et actualités sur l'éducation aux médias et la parentalité numérique",
}

export default function BlogPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-12">
        <div className="inline-flex p-4 bg-orange-100 rounded-full mb-6">
          <Newspaper className="h-8 w-8 text-orange-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Notre blog</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Articles, conseils et actualités sur l&apos;éducation aux médias et la parentalité numérique.
        </p>
      </div>

      <Card>
        <CardContent className="p-8 text-center">
          <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Bientôt disponible</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Notre blog est en préparation. Nous y partagerons des articles sur les tendances
            médiatiques, des conseils pratiques pour les parents, et des analyses de contenus populaires.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
