import { Target, Sparkles, Users, Heart, Lightbulb, ArrowRight, CheckCircle, Shield } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

export const metadata = {
  title: "Notre mission | Totem Avisé",
  description: "Aider chaque famille à découvrir les films, séries et jeux parfaits pour chaque membre du foyer grâce à des recommandations personnalisées.",
}

const pillars = [
  {
    icon: Sparkles,
    title: "Recommandations personnalisées",
    description: "Chaque membre de votre famille a son profil. Nos suggestions s'adaptent à l'âge, aux goûts et aux sensibilités de chacun.",
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    icon: Shield,
    title: "Indépendance totale",
    description: "Aucun studio, éditeur ou plateforme n'influence nos recommandations. Nous travaillons uniquement pour les familles.",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    icon: Users,
    title: "Enrichi par la communauté",
    description: "Les retours des familles améliorent nos recommandations en continu. Chaque réaction partagée bénéficie à tous.",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    icon: Lightbulb,
    title: "Découverte facilitée",
    description: "Par âge, par humeur, par thème ou par plateforme — trouvez le contenu idéal en quelques clics.",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
]

const differences = [
  "Recommandations personnalisées pour chaque membre de votre foyer",
  "7 dimensions analysées : au-delà d'un simple âge recommandé",
  "Prise en compte des messages positifs et des modèles inspirants",
  "Filtrage par sensibilité : violence, langage, peur... selon vos limites",
  "Films, séries, jeux vidéo, livres — tout au même endroit",
]

export default function ObjectifPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-white py-20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="inline-flex p-4 bg-emerald-500/20 rounded-full mb-6">
            <Target className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-6">
            Notre mission
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Aider chaque famille à trouver le contenu parfait — celui qui plaît aux enfants, rassure les parents, et crée des moments partagés.
          </p>
        </div>
      </section>

      {/* Vision / How */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <Card className="border-violet-100">
              <CardContent className="p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Heart className="h-5 w-5 text-violet-500" />
                  Ce que nous croyons
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  Chaque famille est unique. Un film parfait pour un enfant de 7 ans ne l&apos;est pas forcément pour un autre du même âge. Les goûts, les sensibilités et les valeurs de chaque foyer comptent — et les recommandations devraient en tenir compte.
                </p>
              </CardContent>
            </Card>
            <Card className="border-emerald-100">
              <CardContent className="p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-emerald-500" />
                  Ce que nous proposons
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  Un moteur de recommandation qui connaît votre famille. Créez un profil pour chaque membre de votre foyer, et Totem Avisé vous suggère les films, séries et jeux qui correspondent vraiment — par âge, par goûts, et par moment.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* What makes us different */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Ce qui fait la différence</h2>
            <div className="space-y-3 max-w-xl mx-auto">
              {differences.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">{item}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pillars */}
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Nos piliers</h2>
          <div className="grid sm:grid-cols-2 gap-6 mb-16">
            {pillars.map((pillar) => (
              <Card key={pillar.title}>
                <CardContent className="p-6">
                  <div className={`inline-flex p-3 rounded-xl ${pillar.bg} mb-4`}>
                    <pillar.icon className={`h-6 w-6 ${pillar.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{pillar.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{pillar.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Trouvez votre prochaine soirée en famille</h2>
            <p className="text-gray-600 mb-6">
              Explorez des milliers de films, séries et jeux, filtrés pour votre famille.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/films"
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
              >
                Découvrir les films
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/inscription"
                className="inline-flex items-center gap-2 px-6 py-3 border-2 border-emerald-600 text-emerald-700 rounded-xl font-medium hover:bg-emerald-50 transition-colors"
              >
                Créer mon profil famille
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
