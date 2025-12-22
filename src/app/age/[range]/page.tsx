import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Users } from "lucide-react"
import { MediaCard } from "@/components/media/MediaCard"
import { mockMediaItems } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"

const ageRanges: Record<string, { min: number; max: number; label: string; description: string }> = {
  "2-4": {
    min: 2,
    max: 4,
    label: "2-4 ans",
    description: "Contenu adapte aux tout-petits avec des histoires simples et colorees.",
  },
  "5-7": {
    min: 5,
    max: 7,
    label: "5-7 ans",
    description: "Aventures pour les jeunes enfants avec des themes d'amitie et de decouverte.",
  },
  "8-9": {
    min: 8,
    max: 9,
    label: "8-9 ans",
    description: "Histoires plus complexes avec des heros attachants et des defis a surmonter.",
  },
  "10-12": {
    min: 10,
    max: 12,
    label: "10-12 ans",
    description: "Contenu pour les pre-adolescents avec des themes plus matures et nuances.",
  },
  "13-plus": {
    min: 13,
    max: 18,
    label: "13+ ans",
    description: "Contenu pour adolescents abordant des sujets complexes adaptes a leur age.",
  },
}

interface AgePageProps {
  params: Promise<{ range: string }>
}

export async function generateStaticParams() {
  return Object.keys(ageRanges).map((range) => ({
    range,
  }))
}

export default async function AgePage({ params }: AgePageProps) {
  const { range } = await params
  const ageRange = ageRanges[range]

  if (!ageRange) {
    notFound()
  }

  // Filter media items by age range
  const filteredItems = mockMediaItems.filter(
    (item) =>
      item.expertAgeRec >= ageRange.min && item.expertAgeRec <= ageRange.max
  )

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-primary mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour a l&apos;accueil
        </Link>

        <div className="flex items-center gap-4 mb-4">
          <div className="p-4 bg-primary/10 rounded-2xl">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Contenu pour les {ageRange.label}
            </h1>
            <p className="text-gray-600 mt-1">{ageRange.description}</p>
          </div>
        </div>

        {/* Age Navigation */}
        <div className="flex flex-wrap gap-2 mt-6">
          {Object.entries(ageRanges).map(([key, value]) => (
            <Button
              key={key}
              variant={key === range ? "default" : "outline"}
              size="sm"
              asChild
            >
              <Link href={`/age/${key}`}>{value.label}</Link>
            </Button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="mb-6">
        <p className="text-gray-600">
          {filteredItems.length} resultat{filteredItems.length !== 1 ? "s" : ""} pour cette tranche d&apos;age
        </p>
      </div>

      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {filteredItems.map((item) => (
            <MediaCard key={item.id} media={item} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Users className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Aucun contenu disponible
          </h2>
          <p className="text-gray-500">
            Nous n&apos;avons pas encore de contenu pour cette tranche d&apos;age.
          </p>
        </div>
      )}
    </div>
  )
}
