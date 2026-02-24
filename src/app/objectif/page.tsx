import { Target, Shield, Users, Eye, Lightbulb, ArrowRight, CheckCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

export const metadata = {
  title: "Notre objectif | Totem Avisé",
  description: "Aider les familles à faire des choix éclairés pour les contenus médiatiques de leurs enfants grâce à des analyses détaillées et indépendantes.",
}

const pillars = [
  {
    icon: Shield,
    title: "Indépendance",
    description: "Nos évaluations ne sont influencées par aucun studio, éditeur ou plateforme. Nous travaillons uniquement dans l'intérêt des familles.",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    icon: Eye,
    title: "Analyse détaillée",
    description: "Au-delà d'un simple âge recommandé, nous détaillons chaque dimension du contenu : violence, langage, valeurs positives, modèles...",
    color: "text-teal-600",
    bg: "bg-teal-50",
  },
  {
    icon: Users,
    title: "Communauté",
    description: "Les avis des familles enrichissent nos analyses. Chaque parent peut partager son expérience pour aider les autres.",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    icon: Lightbulb,
    title: "Guidance pratique",
    description: "Des recommandations concrètes, des guides thématiques et des collections pour chaque tranche d'âge.",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
]

const differences = [
  "7 critères d'évaluation détaillés au lieu d'un simple âge",
  "Prise en compte des messages positifs et modèles",
  "Avis croisés d'experts et de la communauté de parents",
  "Couverture films, séries, jeux vidéo, livres et applications",
  "Recommandations personnalisées selon l'âge de vos enfants",
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
            Notre objectif
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Les classifications officielles (PEGI, CSA) donnent un âge minimum — mais elles ne disent pas <em>pourquoi</em>. Nous croyons que les familles méritent mieux.
          </p>
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <Card className="border-red-100">
              <CardContent className="p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Le constat</h2>
                <p className="text-gray-600 leading-relaxed">
                  Un film classé &quot;Tous publics&quot; par le CSA peut contenir des scènes qui inquiètent un enfant de 5 ans. Un jeu PEGI 7 peut avoir des mécaniques addictives conçues pour pousser à l&apos;achat. Les parents naviguent souvent à l&apos;aveugle.
                </p>
              </CardContent>
            </Card>
            <Card className="border-emerald-100">
              <CardContent className="p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Notre réponse</h2>
                <p className="text-gray-600 leading-relaxed">
                  Totem Avisé analyse chaque contenu selon 7 dimensions distinctes. Violence, langage, consommérisme, mais aussi messages positifs et modèles. Pour que chaque famille puisse décider en connaissance de cause.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* What makes us different */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Ce qui nous différencie</h2>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Prêt à explorer ?</h2>
            <p className="text-gray-600 mb-6">
              Découvrez nos analyses détaillées et trouvez le contenu idéal pour votre famille.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/films"
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
              >
                Explorer les films
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/inscription"
                className="inline-flex items-center gap-2 px-6 py-3 border-2 border-emerald-600 text-emerald-700 rounded-xl font-medium hover:bg-emerald-50 transition-colors"
              >
                Créer un compte gratuit
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
