import { Target, Sparkles, Users, Heart, Lightbulb, ArrowRight, CheckCircle, Shield } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

export const metadata = {
  title: "Notre mission | Totem Avisé",
  description: "Aider chaque famille à trouver les films, séries et jeux qui conviennent vraiment à chaque membre du foyer.",
}

const pillars = [
  {
    icon: Sparkles,
    title: "Adapté à chacun",
    description: "Chaque membre de votre famille a son profil. Les suggestions tiennent compte de l\u2019âge, des goûts et de ce que chacun supporte ou pas. Un film parfait pour votre aîné de 12 ans n\u2019est pas forcément le bon pour le petit de 5 ans.",
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    icon: Shield,
    title: "Indépendants",
    description: "Aucun studio, éditeur ou plateforme ne paie pour apparaître dans nos recommandations. Pas de pub, pas de placement, pas d\u2019affiliation. On travaille pour les familles, point.",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    icon: Users,
    title: "Amélioré par les familles",
    description: "Les parents qui utilisent Totem Avisé partagent leurs retours : \u00ab trop effrayant pour mon fils de 6 ans \u00bb, \u00ab ma fille de 9 ans a adoré \u00bb. Ces réactions améliorent les suggestions pour tout le monde.",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    icon: Lightbulb,
    title: "Simple à utiliser",
    description: "Filtrez par âge, par genre, par plateforme de streaming ou par thème. Vous cherchez un film d\u2019aventure pour un enfant de 8 ans sur Disney+ ? Deux clics.",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
]

const differences = [
  "On analyse 7 aspects du contenu, pas juste un âge minimum",
  "On repère les messages positifs et les modèles inspirants",
  "Chaque famille peut filtrer selon ses propres limites (violence, langage, peur\u2026)",
  "Films, séries, jeux vidéo, livres : tout au même endroit",
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
            Aider chaque famille à trouver le contenu qui plaît aux enfants et rassure les parents.
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
                  Ce qu&apos;on croit
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  Chaque famille est unique. Un film parfait pour un enfant de 7 ans ne l&apos;est pas forcément pour un autre du même âge. Les goûts, les sensibilités et les valeurs de chaque foyer comptent. Les recommandations devraient en tenir compte.
                </p>
              </CardContent>
            </Card>
            <Card className="border-emerald-100">
              <CardContent className="p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-emerald-500" />
                  Ce qu&apos;on propose
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  Un outil qui connaît votre famille. Créez un profil pour chaque membre, et Totem Avisé vous dit quels films, séries et jeux correspondent vraiment. Par âge, par goûts, par moment.
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
              Des milliers de films, séries et jeux analysés. Filtrés pour votre famille.
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
