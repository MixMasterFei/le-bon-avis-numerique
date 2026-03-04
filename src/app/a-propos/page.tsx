import { Heart, Users, Sparkles, ArrowRight, Film, Tv, Gamepad2, BookOpen, Compass } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { auth } from "@/lib/auth"

export const metadata = {
  title: "À propos | Totem Avisé",
  description: "Découvrez Totem Avisé — le moteur de recommandation qui aide les familles françaises à trouver les films, séries et jeux parfaits pour chaque membre du foyer.",
}

const howItWorks = [
  {
    step: "1",
    title: "Créez votre profil famille",
    description: "Ajoutez chaque membre de votre foyer avec son âge et ses préférences. En 30 secondes, votre famille est prête.",
    icon: Users,
  },
  {
    step: "2",
    title: "Recevez des recommandations",
    description: "Notre moteur analyse chaque contenu sur 7 dimensions et le croise avec le profil de votre famille pour trouver ce qui convient à chacun.",
    icon: Sparkles,
  },
  {
    step: "3",
    title: "Découvrez ensemble",
    description: "Explorez par âge, par humeur ou par thème. Planifiez votre soirée cinéma en famille avec le bon contenu pour tout le monde.",
    icon: Heart,
  },
]

const stats = [
  { label: "Contenus disponibles", value: "8 000+" },
  { label: "Dimensions analysées", value: "7" },
  { label: "Types de médias", value: "5" },
]

export default async function AProposPage() {
  const session = await auth()
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-white py-20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="inline-flex p-4 bg-emerald-500/20 rounded-full mb-6">
            <Compass className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-6">
            À propos de Totem Avisé
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Trouvez le film, la série ou le jeu parfait pour chaque membre de votre famille — personnalisé selon l&apos;âge, les goûts et les sensibilités de chacun.
          </p>
        </div>
      </section>

      {/* Origin story */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="prose max-w-none mb-16">
            <Card>
              <CardContent className="p-8 lg:p-10">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">L&apos;histoire de Totem Avisé</h2>
                <div className="space-y-4 text-gray-600 leading-relaxed">
                  <p>
                    Tout a commencé par une question simple : <strong>&quot;Qu&apos;est-ce qu&apos;on regarde ce soir ?&quot;</strong> Avec des enfants d&apos;âges différents, trouver un contenu qui plaît à tout le monde — et qui convient à chacun — peut vite devenir un casse-tête.
                  </p>
                  <p>
                    Les classifications officielles donnent un âge, mais pas le contexte. Est-ce que ce film sera trop effrayant pour le petit dernier ? Est-ce que cette série captivera aussi l&apos;aîné ? Chaque famille est unique, et les réponses devraient l&apos;être aussi.
                  </p>
                  <p>
                    <strong>Totem Avisé</strong> a été créé pour résoudre exactement ce problème : un moteur de recommandation qui connaît votre famille et vous propose les contenus parfaits pour chaque moment — soirée cinéma, après-midi jeux, ou série à suivre ensemble.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 mb-16">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl lg:text-4xl font-bold text-emerald-600 mb-1">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* How it works */}
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Comment ça fonctionne</h2>
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {howItWorks.map((step) => (
              <Card key={step.step}>
                <CardContent className="p-6 text-center">
                  <div className="inline-flex p-3 bg-emerald-50 rounded-xl mb-4">
                    <step.icon className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">
                    Étape {step.step}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Coverage */}
          <Card className="mb-16">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Ce que vous pouvez découvrir</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { icon: Film, label: "Films" },
                  { icon: Tv, label: "Séries" },
                  { icon: Gamepad2, label: "Jeux vidéo" },
                  { icon: BookOpen, label: "Livres" },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-xl">
                    <item.icon className="h-6 w-6 text-slate-600" />
                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="text-center bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-8">
            {session ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Trouvez votre prochain coup de coeur</h2>
                <p className="text-gray-600 mb-6 max-w-lg mx-auto">
                  Explorez nos collections, utilisez les filtres par âge ou laissez notre moteur vous surprendre avec des recommandations personnalisées.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <Link
                    href="/collections"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
                  >
                    Explorer les collections
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/recommandations"
                    className="inline-flex items-center gap-2 px-6 py-3 border-2 border-emerald-600 text-emerald-700 rounded-xl font-medium hover:bg-emerald-50 transition-colors"
                  >
                    Mes recommandations
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Essayez gratuitement</h2>
                <p className="text-gray-600 mb-6 max-w-lg mx-auto">
                  Créez votre profil famille en 30 secondes et recevez des recommandations personnalisées pour chaque membre de votre foyer.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <Link
                    href="/inscription"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
                  >
                    Créer mon profil famille
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/films"
                    className="inline-flex items-center gap-2 px-6 py-3 border-2 border-emerald-600 text-emerald-700 rounded-xl font-medium hover:bg-emerald-50 transition-colors"
                  >
                    Découvrir les films
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
