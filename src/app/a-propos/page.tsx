import { Heart, Users, Sparkles, ArrowRight, Shield, BookOpen, Film } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

export const metadata = {
  title: "À propos | Le Bon Avis Numérique",
  description: "Découvrez l'histoire, la mission et l'équipe derrière Le Bon Avis Numérique — le guide parental des médias numériques.",
}

const howItWorks = [
  {
    step: "1",
    title: "Analyse experte",
    description: "Chaque contenu est analysé selon 7 critères détaillés grâce à une combinaison d'intelligence artificielle et de vérification humaine.",
    icon: Sparkles,
  },
  {
    step: "2",
    title: "Enrichissement communautaire",
    description: "Les familles membres partagent leurs avis, leurs notes et les réactions de leurs enfants pour enrichir les évaluations.",
    icon: Users,
  },
  {
    step: "3",
    title: "Recommandation personnalisée",
    description: "En fonction de l'âge de vos enfants et de vos préférences, vous recevez des suggestions adaptées à votre famille.",
    icon: Heart,
  },
]

const stats = [
  { label: "Contenus analysés", value: "4 000+" },
  { label: "Critères par contenu", value: "7" },
  { label: "Types de médias", value: "5" },
]

export default function AProposPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-white py-20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="inline-flex p-4 bg-emerald-500/20 rounded-full mb-6">
            <Heart className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-6">
            À propos
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Le Bon Avis Numérique est né d&apos;un constat simple : les parents méritent des informations claires et détaillées pour guider les choix médiatiques de leur famille.
          </p>
        </div>
      </section>

      {/* Origin story */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="prose max-w-none mb-16">
            <Card>
              <CardContent className="p-8 lg:p-10">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Pourquoi ce projet ?</h2>
                <div className="space-y-4 text-gray-600 leading-relaxed">
                  <p>
                    En tant que parents, nous avons tous vécu ce moment : un film supposé &quot;pour toute la famille&quot; qui contient des scènes trop intenses pour notre enfant, ou un jeu vidéo dont les mécaniques d&apos;achat nous inquiètent.
                  </p>
                  <p>
                    Les classifications officielles — PEGI pour les jeux, CSA pour les films — donnent un âge recommandé, mais rarement le <strong>détail du pourquoi</strong>. Est-ce à cause de la violence ? Du langage ? De thèmes complexes ? La réponse change tout pour un parent qui cherche à faire un choix éclairé.
                  </p>
                  <p>
                    <strong>Le Bon Avis Numérique</strong> a été créé pour combler ce manque. Notre mission : fournir à chaque famille francophone les informations détaillées dont elle a besoin, gratuitement, pour naviguer dans l&apos;univers des médias numériques en toute confiance.
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
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Ce que nous couvrons</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { icon: Film, label: "Films" },
                  { icon: Film, label: "Séries" },
                  { icon: BookOpen, label: "Livres" },
                  { icon: Shield, label: "Jeux vidéo" },
                  { icon: Sparkles, label: "Applications" },
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
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Rejoignez la communauté</h2>
            <p className="text-gray-600 mb-6 max-w-lg mx-auto">
              Créez un compte gratuit pour sauvegarder vos favoris, partager vos avis et recevoir des recommandations personnalisées.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/inscription"
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
              >
                Créer un compte gratuit
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/nos-valeurs"
                className="inline-flex items-center gap-2 px-6 py-3 border-2 border-emerald-600 text-emerald-700 rounded-xl font-medium hover:bg-emerald-50 transition-colors"
              >
                Nos critères d&apos;évaluation
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
