import { Info, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = {
  title: "Notre histoire | Le Bon Avis Numérique",
  description: "Découvrez l'histoire et les origines du Bon Avis Numérique",
}

export default function AProposPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-12">
        <div className="inline-flex p-4 bg-blue-100 rounded-full mb-6">
          <Info className="h-8 w-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Notre histoire</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Comment Le Bon Avis Numérique est né et pourquoi nous existons.
        </p>
      </div>

      <Card>
        <CardContent className="p-8 text-center">
          <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Page en construction</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Cette page sera bientôt disponible avec l&apos;histoire complète de notre projet
            et les motivations qui nous ont poussé à créer Le Bon Avis Numérique.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
