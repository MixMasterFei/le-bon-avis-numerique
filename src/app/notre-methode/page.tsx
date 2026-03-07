import { ShieldAlert, Users, Award, Star, ThumbsUp, BookOpen, Scale, Heart } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

export const metadata = {
  title: "Notre méthode | Totem Avisé",
  description: "Comment Totem Avisé évalue les contenus, attribue les badges et calcule la compatibilité familiale.",
}

const sections = [
  {
    id: "age",
    icon: Award,
    iconColor: "text-red-600",
    iconBg: "bg-red-50",
    title: "Nos recommandations d\u2019âge",
    content: [
      "Chaque contenu sur Totem Avisé porte une recommandation d\u2019âge indépendante de la classification officielle (CNC/CSA). La classification légale donne un âge minimum d\u2019accès en salle. Nous, on regarde l\u2019expérience dans son ensemble : est-ce que ce film risque de faire peur ? Est-ce que les thèmes abordés sont compréhensibles à cet âge ?",
      "On s\u2019appuie sur 7 critères : violence, contenu sexuel, langage, substances, messages positifs, modèles positifs et valeur éducative. Chaque critère est évalué sur une échelle de 0 à 5.",
      "Quand les données du CNC sont disponibles, on les affiche en complément. Sur chaque fiche, vous voyez les deux côte à côte : la classification officielle et notre recommandation.",
    ],
  },
  {
    id: "badges",
    icon: Star,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-50",
    title: "Les badges",
    content: [
      "Les badges apparaissent sur les fiches et les cartes pour repérer rapidement les qualités d\u2019un contenu :",
    ],
    list: [
      { label: "Éducatif", desc: "Le contenu a un fort potentiel éducatif (score de 5/5 en valeur éducative)." },
      { label: "Modèles+", desc: "Le contenu met en avant des modèles positifs (score de 5/5)." },
      { label: "Âge (ex : 8+)", desc: "Âge minimum recommandé par nos experts." },
      { label: "Classif. officielle", desc: "La classification CNC/CSA quand elle est disponible." },
    ],
  },
  {
    id: "famille",
    icon: Users,
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-50",
    title: "Adapté à ma famille",
    content: [
      "Quand vous créez un profil famille, Totem Avisé calcule un score de compatibilité pour chaque membre. Ce score croise plusieurs facteurs :",
    ],
    list: [
      { label: "Âge", desc: "L\u2019âge du membre par rapport à la recommandation d\u2019âge du contenu. C\u2019est le facteur qui pèse le plus." },
      { label: "Sensibilités", desc: "On compare les niveaux de contenu sensible (violence, peur, langage\u2026) avec ce que chaque membre tolère." },
      { label: "Genres préférés", desc: "Correspondance entre les genres du contenu et les favoris du membre." },
      { label: "Centres d\u2019intérêt", desc: "Les thèmes et sujets du contenu par rapport aux centres d\u2019intérêt du membre." },
      { label: "Affinités", desc: "Si le membre a aimé des contenus similaires, ça joue en faveur." },
      { label: "Ambiance", desc: "Le ton et le rythme du contenu par rapport à l\u2019âge et la sensibilité du membre." },
      { label: "Contenu positif", desc: "Correspondance avec les préférences en messages positifs, modèles inspirants et contenu éducatif." },
      { label: "Sujets à éviter", desc: "On vérifie que le contenu ne contient pas de sujets que le membre souhaite éviter." },
    ],
    after: "Les avatars des membres compatibles apparaissent directement sur les cartes, pour voir d\u2019un coup d\u2019œil à qui chaque contenu convient.",
  },
  {
    id: "warning",
    icon: ShieldAlert,
    iconColor: "text-orange-600",
    iconBg: "bg-orange-50",
    title: "Attention famille",
    content: [
      "Le badge \u00ab Attention famille \u00bb signale les contenus qui méritent une vigilance particulière pour les foyers avec enfants. Il se déclenche dans deux cas :",
    ],
    list: [
      { label: "Détection automatique", desc: "Le contenu est recommandé à partir de 15 ans ET contient des éléments de genre (horreur, crime, thriller), de violence élevée, ou une ambiance sombre et intense." },
      { label: "Signalement communautaire*", desc: "Au moins 10 parents ont signalé ce contenu comme sensible pour les familles. L\u2019astérisque (*) distingue ce signalement du signal automatique." },
    ],
    after: "Ce badge ne veut pas dire que le contenu est \u00ab mauvais \u00bb. Il indique qu\u2019il vaut mieux y jeter un œil avant de le regarder en famille.",
  },
  {
    id: "votes",
    icon: ThumbsUp,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
    title: "Les votes communautaires",
    content: [
      "Totem Avisé s\u2019améliore grâce aux retours des parents. Vous pouvez contribuer de plusieurs façons :",
    ],
    list: [
      { label: "Vote sur l\u2019âge", desc: "Confirmez ou contestez la recommandation d\u2019âge avec un pouce en haut ou en bas. À partir de 5 votes et 70\u00a0% d\u2019accord, un badge de consensus apparaît." },
      { label: "Signalement famille", desc: "Si vous estimez qu\u2019un contenu mérite un avertissement familial, vous pouvez le signaler depuis la fiche. Seuls les utilisateurs avec un profil famille peuvent voter." },
      { label: "Réactions par membre", desc: "Enregistrez les réactions de chaque membre (adoré, aimé, ennuyeux, trop jeune\u2026). Ces réactions alimentent les recommandations." },
    ],
  },
  {
    id: "sources",
    icon: BookOpen,
    iconColor: "text-slate-600",
    iconBg: "bg-slate-50",
    title: "Nos sources",
    content: [
      "Nos données viennent de plusieurs sources complémentaires :",
    ],
    list: [
      { label: "Bases de données internationales", desc: "Informations générales (synopsis, genres, dates, équipes techniques) issues de bases collaboratives." },
      { label: "CNC / data.gouv.fr", desc: "Classifications officielles des films en France, importées depuis les données publiques du CNC." },
      { label: "Analyse de contenu", desc: "Évaluation des 7 critères par notre système d\u2019analyse, affinée par les retours de la communauté." },
      { label: "Communauté", desc: "Avis, votes d\u2019âge et signalements des parents utilisateurs." },
    ],
    after: "Nos recommandations sont indépendantes. On n\u2019est affilié à aucun studio, distributeur ou plateforme de streaming.",
  },
]

export default function NotreMethodePage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white py-20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="inline-flex p-4 bg-indigo-500/20 rounded-full mb-6">
            <Scale className="h-8 w-8 text-indigo-400" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-6">
            Notre méthode
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Comment on évalue les contenus, attribue les badges et calcule la compatibilité avec votre famille.
          </p>
        </div>
      </section>

      {/* Navigation rapide */}
      <section className="py-8 border-b">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex flex-wrap justify-center gap-3">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-sm px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              >
                {s.title}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Sections */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl space-y-12">
          {sections.map((section) => (
            <Card key={section.id} id={section.id} className="scroll-mt-24">
              <CardContent className="p-8 lg:p-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`inline-flex p-2.5 rounded-xl ${section.iconBg}`}>
                    <section.icon className={`h-6 w-6 ${section.iconColor}`} />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">{section.title}</h2>
                </div>

                <div className="space-y-4 text-gray-600 leading-relaxed">
                  {section.content.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}

                  {section.list && (
                    <ul className="space-y-3 mt-4">
                      {section.list.map((item) => (
                        <li key={item.label} className="flex gap-3">
                          <span className="flex-shrink-0 mt-1">
                            <Heart className="h-4 w-4 text-gray-400" />
                          </span>
                          <div>
                            <span className="font-semibold text-gray-800">{item.label}</span>
                            {" \u2014 "}
                            {item.desc}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {section.after && (
                    <p className="mt-4">{section.after}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* CTA */}
          <div className="text-center bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Une question ? Une suggestion ?</h2>
            <p className="text-gray-600 mb-6 max-w-lg mx-auto">
              Notre méthode évolue grâce aux retours des familles. Écrivez-nous, on lit tout.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
              >
                Nous écrire
              </Link>
              <Link
                href="/a-propos"
                className="inline-flex items-center gap-2 px-6 py-3 border-2 border-indigo-600 text-indigo-700 rounded-xl font-medium hover:bg-indigo-50 transition-colors"
              >
                À propos
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
