import { BookText, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = {
  title: "Nos guides | Le Bon Avis Numérique",
  description: "Guides pratiques pour accompagner vos enfants dans leur consommation médiatique",
}

export default function GuidesPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-12">
        <div className="inline-flex p-4 bg-purple-100 rounded-full mb-6">
          <BookText className="h-8 w-8 text-purple-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Nos guides</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Des guides pratiques pour accompagner vos enfants dans leur consommation médiatique.
        </p>
      </div>

      <Card>
        <CardContent className="p-8 text-center">
          <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Bientôt disponible</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Nous préparons des guides thématiques : comment parler des écrans avec vos enfants,
            comprendre les classifications d&apos;âge, choisir des jeux vidéo adaptés, et bien plus.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
