import { Heart, Users, Sparkles, ArrowRight, Film, Tv, Gamepad2, BookOpen, Compass } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { auth } from "@/lib/auth"

export const metadata = {
  title: "À propos | Totem Avisé",
  description: "Totem Avisé aide les familles françaises à trouver les films, séries et jeux adaptés à chaque membre du foyer.",
}

const howItWorks = [
  {
    step: "1",
    title: "Créez votre profil famille",
    description: "Ajoutez chaque membre avec son âge et ses préférences. 30 secondes, c\u2019est fait.",
    icon: Users,
  },
  {
    step: "2",
    title: "On analyse, vous choisissez",
    description: "Chaque contenu est passé au crible sur 7 critères (violence, langage, messages positifs\u2026) et croisé avec le profil de votre famille.",
    icon: Sparkles,
  },
  {
    step: "3",
    title: "Découvrez ensemble",
    description: "Filtrez par âge, par humeur ou par thème. Trouvez le bon film pour le mercredi soir ou le jeu du week-end.",
    icon: Heart,
  },
]

const stats = [
  { label: "Contenus analysés", value: "8 000+" },
  { label: "Critères évalués", value: "7" },
  { label: "Types de médias", value: "4" },
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
            Le bon film pour le bon enfant, au bon moment. On aide les familles à s&apos;y retrouver dans la jungle des écrans.
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
                    <strong>&quot;Qu&apos;est-ce qu&apos;on regarde ce soir ?&quot;</strong> La question revient chaque semaine. Et chaque semaine, c&apos;est le même problème : le petit veut un dessin animé, l&apos;aîné veut de l&apos;action, et les parents veulent être sûrs que personne ne va voir quelque chose d&apos;inadapté.
                  </p>
                  <p>
                    Les classifications officielles donnent un âge, point final. Elles ne disent pas si le film va faire peur au petit dernier, ni si la série va captiver l&apos;ado. Chaque enfant est différent. Un gamin de 7 ans qui adore les dinosaures n&apos;a pas les mêmes besoins qu&apos;un autre du même âge qui a peur du noir.
                  </p>
                  <p>
                    Totem Avisé est né de ce constat. On analyse chaque film, série et jeu sur 7 critères, on croise ça avec le profil de votre famille, et on vous dit ce qui colle vraiment. Pas de pub, pas de partenariat avec des studios. Juste des recommandations honnêtes pour les familles.
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
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Trouvez votre prochain coup de cœur</h2>
                <p className="text-gray-600 mb-6 max-w-lg mx-auto">
                  Explorez nos collections par thème ou laissez-vous surprendre par les recommandations de votre famille.
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
                  Créez votre profil famille en 30 secondes. On s&apos;occupe du reste.
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
