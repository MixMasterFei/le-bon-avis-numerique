import { BookText, Clock, Monitor, Gamepad2, MessageCircle, Shield, Brain, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

export const metadata = {
  title: "Nos guides | Totem Avisé",
  description: "Guides pratiques pour accompagner vos enfants dans leur consommation médiatique : temps d'écran, classifications, jeux vidéo et plus.",
}

const guides = [
  {
    title: "Temps d'écran par âge : repères et conseils",
    description: "Combien de temps devant un écran selon l'âge ? Les recommandations de l'OMS et du CSA, et nos conseils pratiques pour chaque tranche d'âge.",
    icon: Monitor,
    color: "text-blue-600",
    bg: "bg-blue-50",
    available: true,
    slug: "temps-ecran",
    content: [
      { age: "Moins de 3 ans", rec: "Pas d'écran (ou exceptionnel, accompagné)", detail: "L'OMS et les pédiatres recommandent d'éviter les écrans avant 3 ans. Les interactions réelles sont essentielles au développement." },
      { age: "3-6 ans", rec: "Maximum 30 min/jour, accompagné", detail: "Privilégiez des contenus courts, adaptés, et regardez-les ensemble. Pas d'écran pendant les repas ni avant le coucher." },
      { age: "6-10 ans", rec: "Maximum 1h/jour", detail: "Diversifiez les activités. Encouragez la lecture, le jeu libre et les activités physiques. Restez présent pour discuter de ce qu'ils voient." },
      { age: "10-14 ans", rec: "1 à 2h/jour", detail: "C'est l'âge où les réseaux sociaux deviennent un sujet. Établissez des règles claires et maintenez le dialogue." },
      { age: "14+ ans", rec: "Cadre négocié en famille", detail: "Accompagnez vers l'autonomie. L'important est de maintenir des temps sans écran (repas, nuit) et un dialogue ouvert." },
    ],
  },
  {
    title: "Comprendre les classifications d'âge",
    description: "PEGI, CSA, CNC... Que signifient ces classifications ? Leurs limites et comment notre système les complète.",
    icon: Shield,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    available: true,
    slug: "classifications",
    content: [
      { age: "CSA (Films & TV)", rec: "Tous publics, -10, -12, -16, -18", detail: "Le Conseil Supérieur de l'Audiovisuel attribue ces classifications basées sur le contenu violent, sexuel ou choquant. Mais elles ne détaillent pas les raisons." },
      { age: "PEGI (Jeux vidéo)", rec: "PEGI 3, 7, 12, 16, 18", detail: "Le système européen de classification des jeux. Les pictogrammes (violence, peur, langage...) complètent l'âge mais restent généraux." },
      { age: "Notre approche", rec: "7 critères détaillés", detail: "Nous allons plus loin : violence, sexe/nudité, langage, consommérisme, substances, mais aussi messages positifs et modèles. Chaque famille peut évaluer selon ses propres valeurs." },
    ],
  },
  {
    title: "Choisir un jeu vidéo adapté",
    description: "Au-delà du PEGI : comment évaluer si un jeu vidéo convient à votre enfant, repérer les microtransactions et le contenu addictif.",
    icon: Gamepad2,
    color: "text-purple-600",
    bg: "bg-purple-50",
    available: true,
    slug: "jeux-video",
    content: [
      { age: "Vérifiez au-delà du PEGI", rec: "PEGI ne couvre pas tout", detail: "Le PEGI ne prend pas en compte les achats intégrés, le chat en ligne non modéré, ou les mécaniques addictives (loot boxes, battle pass)." },
      { age: "Achats intégrés", rec: "Attention aux microtransactions", detail: "De nombreux jeux 'gratuits' reposent sur des achats. Désactivez les achats in-app et discutez de la valeur de l'argent avec vos enfants." },
      { age: "Jeu en ligne", rec: "Supervisez les interactions", detail: "Les jeux multijoueurs exposent les enfants à des inconnus. Vérifiez les paramètres de confidentialité et les options de chat." },
      { age: "Temps de jeu", rec: "Fixez des limites claires", detail: "Utilisez les contrôles parentaux intégrés aux consoles et PC. Définissez des plages horaires de jeu en famille." },
    ],
  },
  {
    title: "Parler des écrans avec vos enfants",
    description: "Comment aborder le sujet des écrans sans conflit, instaurer des règles familiales et maintenir un dialogue constructif.",
    icon: MessageCircle,
    color: "text-amber-600",
    bg: "bg-amber-50",
    available: false,
    slug: "dialogue-ecrans",
    content: [],
  },
  {
    title: "Développer l'esprit critique face aux médias",
    description: "Apprendre à vos enfants à questionner ce qu'ils voient en ligne : publicité, désinformation, images retouchées.",
    icon: Brain,
    color: "text-teal-600",
    bg: "bg-teal-50",
    available: false,
    slug: "esprit-critique",
    content: [],
  },
]

export default function GuidesPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-white py-20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="inline-flex p-4 bg-emerald-500/20 rounded-full mb-6">
            <BookText className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-6">
            Nos guides
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Des guides pratiques pour accompagner vos enfants dans leur consommation médiatique, à chaque âge.
          </p>
        </div>
      </section>

      {/* Guides list */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="space-y-12">
            {guides.map((guide) => (
              <div key={guide.slug} id={guide.slug}>
                <Card className={!guide.available ? "opacity-75" : ""}>
                  <CardContent className="p-6 lg:p-8">
                    {/* Guide header */}
                    <div className="flex items-start gap-4 mb-6">
                      <div className={`inline-flex p-3 rounded-xl ${guide.bg} flex-shrink-0`}>
                        <guide.icon className={`h-6 w-6 ${guide.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h2 className="text-xl font-bold text-gray-900">{guide.title}</h2>
                          {!guide.available && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                              <Clock className="h-3 w-3" />
                              Bientôt
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600">{guide.description}</p>
                      </div>
                    </div>

                    {/* Guide content */}
                    {guide.available && guide.content.length > 0 && (
                      <div className="space-y-4 mt-6">
                        {guide.content.map((item) => (
                          <div key={item.age} className="border border-gray-100 rounded-xl p-4">
                            <div className="flex items-baseline justify-between mb-2">
                              <h3 className="font-semibold text-gray-900">{item.age}</h3>
                              <span className="text-sm font-medium text-emerald-600">{item.rec}</span>
                            </div>
                            <p className="text-sm text-gray-600 leading-relaxed">{item.detail}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {!guide.available && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-xl text-center">
                        <p className="text-sm text-gray-500">Ce guide est en cours de rédaction. Revenez bientôt !</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-16 text-center bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Besoin d&apos;un avis précis ?</h2>
            <p className="text-gray-600 mb-6 max-w-lg mx-auto">
              Consultez nos analyses détaillées pour trouver le film, la série ou le jeu idéal pour votre famille.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/films"
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
              >
                Explorer les contenus
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
