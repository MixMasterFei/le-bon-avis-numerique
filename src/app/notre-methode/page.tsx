import { ShieldAlert, Users, Award, Star, ThumbsUp, BookOpen, Scale, Heart, AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

export const metadata = {
  title: "Notre methode | Totem Avise",
  description: "Decouvrez comment Totem Avise evalue les contenus, attribue les badges et calcule la compatibilite familiale.",
}

const sections = [
  {
    id: "age",
    icon: Award,
    iconColor: "text-red-600",
    iconBg: "bg-red-50",
    title: "Nos recommandations d'age",
    content: [
      "Chaque contenu sur Totem Avise porte une recommandation d'age experte, independante de la classification officielle (CNC/CSA). Alors que la classification legale indique un age minimum d'acces en salle, notre recommandation prend en compte l'experience globale du contenu.",
      "Notre analyse s'appuie sur 7 dimensions : violence, contenu sexuel, langage, substances, messages positifs, modeles positifs et valeur educative. Ces criteres sont evalues sur une echelle de 0 a 5 par notre systeme d'analyse.",
      "Quand les donnees du CNC sont disponibles, nous les integrons comme reference complementaire. Vous verrez les deux informations cote a cote sur chaque fiche : la classification officielle et notre recommandation.",
    ],
  },
  {
    id: "badges",
    icon: Star,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-50",
    title: "Les badges",
    content: [
      "Les badges apparaissent sur les fiches et les cartes pour vous aider a reperer rapidement les qualites d'un contenu :",
    ],
    list: [
      { label: "Educatif", desc: "Le contenu a un fort potentiel educatif (score >= 5/5 en valeur educative)." },
      { label: "Modeles+", desc: "Le contenu met en avant des modeles positifs (score >= 5/5)." },
      { label: "Age (ex : 8+)", desc: "Age minimum recommande par nos experts." },
      { label: "Classif. officielle", desc: "La classification CNC/CSA quand elle est disponible." },
    ],
  },
  {
    id: "famille",
    icon: Users,
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-50",
    title: "Adapte a ma famille",
    content: [
      "Quand vous creez un profil famille, notre moteur calcule un score de compatibilite pour chaque membre. Ce score prend en compte plusieurs facteurs :",
    ],
    list: [
      { label: "Age (35%)", desc: "L'age du membre par rapport a la recommandation d'age du contenu." },
      { label: "Sensibilites (30%)", desc: "Comparaison entre les niveaux de contenu sensible (violence, etc.) et les tolerances du membre." },
      { label: "Genres preferes (10%)", desc: "Correspondance avec les genres favoris du membre." },
      { label: "Sujets a eviter (5%)", desc: "Verification que le contenu ne contient pas de sujets que le membre souhaite eviter." },
      { label: "Affinites (10%)", desc: "Connexions avec des contenus deja apprecies par le membre." },
      { label: "Ambiance (10%)", desc: "Adequation du ton et du rythme avec l'age et la sensibilite." },
    ],
    after: "Les avatars des membres compatibles apparaissent directement sur les cartes de la page d'accueil, pour que vous voyiez d'un coup d'oeil a qui chaque contenu convient le mieux.",
  },
  {
    id: "warning",
    icon: ShieldAlert,
    iconColor: "text-orange-600",
    iconBg: "bg-orange-50",
    title: "Attention famille",
    content: [
      "Le badge \"Attention famille\" apparait sur les contenus qui meritent une vigilance particuliere pour les foyers avec enfants. Il se declenche dans deux cas :",
    ],
    list: [
      { label: "Detection automatique", desc: "Le contenu est recommande a partir de 15 ans ET contient des elements de genre (horreur, crime, thriller), de violence elevee, ou une ambiance sombre et intense." },
      { label: "Signalement communautaire*", desc: "Au moins 10 parents ont signale ce contenu comme sensible pour les familles. L'asterisque (*) distingue ce signalement du signal automatique." },
    ],
    after: "Ce badge ne signifie pas que le contenu est \"mauvais\" — il indique simplement qu'il necessite une attention particuliere avant de le regarder en famille.",
  },
  {
    id: "votes",
    icon: ThumbsUp,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
    title: "Les votes communautaires",
    content: [
      "Totem Avise s'enrichit grace a sa communaute de parents. Vous pouvez contribuer de plusieurs facons :",
    ],
    list: [
      { label: "Vote sur l'age", desc: "Confirmez ou contestez la recommandation d'age avec un pouce en haut ou en bas. A partir de 5 votes et 70% d'accord, un badge de consensus apparait." },
      { label: "Signalement famille", desc: "Si vous estimez qu'un contenu merite un avertissement familial, vous pouvez le signaler depuis la fiche du contenu. Seuls les utilisateurs ayant un profil famille peuvent voter." },
      { label: "Reactions par membre", desc: "Enregistrez les reactions de chaque membre de votre famille (adore, aime, ennuyeux, trop jeune, etc.). Ces reactions alimentent les recommandations personnalisees." },
    ],
  },
  {
    id: "sources",
    icon: BookOpen,
    iconColor: "text-slate-600",
    iconBg: "bg-slate-50",
    title: "Nos sources",
    content: [
      "Nos donnees proviennent de plusieurs sources complementaires :",
    ],
    list: [
      { label: "Bases de donnees internationales", desc: "Informations generales (synopsis, genres, dates, equipes techniques) issues de bases de donnees cinematographiques collaboratives." },
      { label: "CNC / data.gouv.fr", desc: "Classifications officielles des films en France, importees directement depuis les donnees publiques du CNC." },
      { label: "Analyse de contenu", desc: "Evaluation des 7 dimensions de contenu par notre systeme d'analyse, affine par les retours de la communaute." },
      { label: "Communaute", desc: "Avis, votes d'age et signalements des parents utilisateurs de Totem Avise." },
    ],
    after: "Toutes nos recommandations sont independantes. Nous ne sommes affilies a aucun studio, distributeur ou plateforme de streaming.",
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
            Notre methode
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Transparence totale sur la facon dont nous evaluons les contenus, attribuons les badges et calculons la compatibilite familiale.
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
                            {" — "}
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
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Des questions ?</h2>
            <p className="text-gray-600 mb-6 max-w-lg mx-auto">
              Notre methode evolue en continu grace aux retours de notre communaute. N&apos;hesitez pas a nous contacter si vous avez des suggestions.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
              >
                Nous contacter
              </Link>
              <Link
                href="/a-propos"
                className="inline-flex items-center gap-2 px-6 py-3 border-2 border-indigo-600 text-indigo-700 rounded-xl font-medium hover:bg-indigo-50 transition-colors"
              >
                A propos
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
