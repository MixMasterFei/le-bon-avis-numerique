import { BookOpen, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = {
  title: "Bandes Dessinées | Totem Avisé",
  description: "Évaluations de bandes dessinées et comics pour enfants et adolescents",
}

export default function BDPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-12">
        <div className="inline-flex p-4 bg-yellow-100 rounded-full mb-6">
          <BookOpen className="h-8 w-8 text-yellow-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Bandes Dessinées</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Évaluations de bandes dessinées, mangas et comics pour enfants et adolescents.
        </p>
      </div>

      <Card>
        <CardContent className="p-8 text-center">
          <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Bientôt disponible</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Nous travaillons sur l&apos;ajout de bandes dessinées, mangas et comics à notre base de données.
            Vous pourrez bientôt consulter nos évaluations pour ces contenus.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
