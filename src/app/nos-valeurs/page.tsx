import { Heart, Shield, Users, Star, BarChart3, Eye, MessageCircle, Zap, Award, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export const metadata = {
  title: "Nos valeurs & notations | Le Bon Avis Numerique",
  description: "Comprendre notre systeme d'evaluation et nos criteres pour aider les parents a choisir des contenus adaptes",
}

const contentMetrics = [
  {
    id: "violence",
    name: "Violence",
    icon: Shield,
    color: "text-red-500",
    bgColor: "bg-red-50",
    description: "Mesure la presence de violence physique, verbale ou psychologique dans le contenu.",
    scale: [
      { level: 0, label: "Aucune violence", example: "Aucune scene de conflit physique ou verbal agressif" },
      { level: 1, label: "Violence tres legere", example: "Conflits resolus pacifiquement, slapstick cartoon" },
      { level: 2, label: "Violence legere", example: "Bagarres sans consequences, tensions dramatiques" },
      { level: 3, label: "Violence moderee", example: "Combats avec consequences visibles, scenes de danger" },
      { level: 4, label: "Violence intense", example: "Scenes de bataille, violence realiste, blessures" },
      { level: 5, label: "Violence extreme", example: "Violence graphique, gore, cruaute explicite" },
    ],
  },
  {
    id: "sexNudity",
    name: "Sexe / Nudite",
    icon: Eye,
    color: "text-pink-500",
    bgColor: "bg-pink-50",
    description: "Evalue la presence de contenu sexuel, scenes romantiques explicites ou nudite.",
    scale: [
      { level: 0, label: "Aucun contenu", example: "Pas de romance ou nudite" },
      { level: 1, label: "Romance legere", example: "Baisers, mains tenues, romance innocente" },
      { level: 2, label: "Romance plus explicite", example: "Scenes de baisers prolonges, flirt marque" },
      { level: 3, label: "Contenu suggestif", example: "Sous-entendus, tenues revelatrices, nudite partielle" },
      { level: 4, label: "Contenu sexuel", example: "Scenes de nudite, allusions sexuelles explicites" },
      { level: 5, label: "Contenu explicite", example: "Scenes sexuelles explicites, nudite complete" },
    ],
  },
  {
    id: "language",
    name: "Langage",
    icon: MessageCircle,
    color: "text-orange-500",
    bgColor: "bg-orange-50",
    description: "Indique la frequence de langage grossier, insultes ou jurons.",
    scale: [
      { level: 0, label: "Langage adapte a tous", example: "Aucun mot grossier ou inapproprie" },
      { level: 1, label: "Langage tres leger", example: "Expressions legeres type 'zut', 'mince'" },
      { level: 2, label: "Langage leger", example: "Quelques jurons doux, insultes legeres" },
      { level: 3, label: "Langage modere", example: "Jurons reguliers, insultes occasionnelles" },
      { level: 4, label: "Langage grossier", example: "Gros mots frequents, insultes vulgaires" },
      { level: 5, label: "Langage tres vulgaire", example: "Langage extremement grossier et constant" },
    ],
  },
  {
    id: "consumerism",
    name: "Consumerisme",
    icon: Zap,
    color: "text-yellow-500",
    bgColor: "bg-yellow-50",
    description: "Mesure la presence de messages incitant a la consommation, placement de produits ou materialisme.",
    scale: [
      { level: 0, label: "Pas de messages commerciaux", example: "Aucun placement produit, pas de materialisme" },
      { level: 1, label: "Mentions mineures", example: "Marques visibles en arriere-plan" },
      { level: 2, label: "Quelques placements", example: "Produits identifies, mentions de marques" },
      { level: 3, label: "Placements notables", example: "Integration de produits dans l'histoire" },
      { level: 4, label: "Messages commerciaux forts", example: "Incitation claire a l'achat, merchandising" },
      { level: 5, label: "Tres commercial", example: "Contenu principalement promotionnel, achats in-app" },
    ],
  },
  {
    id: "substanceUse",
    name: "Substances",
    icon: Shield,
    color: "text-purple-500",
    bgColor: "bg-purple-50",
    description: "Evalue la representation d'alcool, tabac, drogues ou autres substances.",
    scale: [
      { level: 0, label: "Aucune representation", example: "Pas d'alcool, tabac ou drogues" },
      { level: 1, label: "Presence en arriere-plan", example: "Verres de vin au diner, bar en fond" },
      { level: 2, label: "Consommation occasionnelle", example: "Personnages qui boivent socialement" },
      { level: 3, label: "Consommation reguliere", example: "Scenes de bar, cigarettes visibles" },
      { level: 4, label: "Usage problematique aborde", example: "Ivresse, dependance montree" },
      { level: 5, label: "Usage frequemment montre", example: "Drogues, alcoolisme banalise ou glorifie" },
    ],
  },
]

const positiveMetrics = [
  {
    id: "positiveMessages",
    name: "Messages positifs",
    icon: Heart,
    color: "text-green-500",
    bgColor: "bg-green-50",
    description: "Note la presence de valeurs positives : amitie, courage, perseverance, empathie, entraide.",
    scale: [
      { level: 0, label: "Pas de message particulier", example: "Divertissement sans theme educatif" },
      { level: 1, label: "Messages implicites", example: "Valeurs suggerees mais non developpees" },
      { level: 2, label: "Quelques messages positifs", example: "Themes d'amitie ou de cooperation" },
      { level: 3, label: "Messages clairs", example: "Valeurs explicitement presentees" },
      { level: 4, label: "Messages forts", example: "Themes educatifs bien developpes" },
      { level: 5, label: "Tres enrichissant", example: "Contenu profondement educatif et inspirant" },
    ],
  },
  {
    id: "roleModels",
    name: "Modeles positifs",
    icon: Star,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    description: "Evalue la qualite des personnages comme modeles : comportements admirables, resolution de problemes, respect des autres.",
    scale: [
      { level: 0, label: "Pas de modele positif", example: "Personnages sans qualites admirables" },
      { level: 1, label: "Modeles faibles", example: "Quelques comportements positifs isoles" },
      { level: 2, label: "Modeles occasionnels", example: "Personnages parfois admirables" },
      { level: 3, label: "Bons modeles", example: "Personnages avec des qualites claires" },
      { level: 4, label: "Tres bons modeles", example: "Personnages inspirants et exemplaires" },
      { level: 5, label: "Modeles exceptionnels", example: "Personnages profondement inspirants" },
    ],
  },
]

export default function NosValeursPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex p-4 bg-primary/10 rounded-full mb-6">
          <Heart className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Nos valeurs & notations</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Comprendre notre systeme d'evaluation pour vous aider a choisir des contenus adaptes a vos enfants.
        </p>
      </div>

      {/* Introduction */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Notre philosophie
          </h2>
          <div className="space-y-4 text-gray-600">
            <p>
              <strong>Le Bon Avis Numerique</strong> a ete cree avec une conviction simple : les parents meritent
              des informations claires et detaillees pour guider les choix mediatiques de leurs enfants.
            </p>
            <p>
              Contrairement aux classifications d'age officielles (PEGI, CSA) qui donnent une indication generale,
              nous fournissons une <strong>analyse detaillee du contenu</strong> selon plusieurs criteres.
              Chaque famille a ses propres valeurs et sensibilites - notre role est de vous donner
              les informations necessaires pour faire vos propres choix eclaires.
            </p>
            <p>
              Nos evaluations sont realisees par une combinaison d'<strong>analyses expertes</strong> et
              d'<strong>intelligence artificielle</strong>, puis enrichies par les <strong>avis de la communaute</strong>
              de parents et d'educateurs.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Age Recommendations */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Nos recommandations d'age
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            Pour chaque contenu, nous fournissons deux types de recommandations d'age :
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Age recommande (Expert)</h3>
              </div>
              <p className="text-sm text-blue-800">
                Base sur notre analyse du contenu selon les criteres ci-dessous.
                Prend en compte la maturite emotionnelle necessaire pour apprecier le contenu.
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-900">Age suggere (Communaute)</h3>
              </div>
              <p className="text-sm text-green-800">
                Moyenne des suggestions des parents et educateurs de notre communaute.
                Reflete l'experience reelle des familles.
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500 italic">
            Note : Ces ages sont des suggestions. Vous connaissez votre enfant mieux que quiconque.
            Un enfant mature de 9 ans peut etre pret pour un contenu suggere a 10 ans, et inversement.
          </p>
        </CardContent>
      </Card>

      {/* Content Metrics - Negative */}
      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-primary" />
        Criteres d'evaluation du contenu
      </h2>
      <p className="text-gray-600 mb-6">
        Ces criteres mesurent la presence d'elements potentiellement sensibles.
        Une note elevee (4-5) indique une forte presence de cet element.
      </p>

      <div className="space-y-6 mb-12">
        {contentMetrics.map((metric) => (
          <Card key={metric.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                  <metric.icon className={`h-5 w-5 ${metric.color}`} />
                </div>
                {metric.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">{metric.description}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-gray-500 w-16">Note</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500 w-40">Niveau</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500">Exemple</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metric.scale.map((item) => (
                      <tr key={item.level} className="border-b last:border-0">
                        <td className="py-2 px-2">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                            item.level <= 1 ? "bg-green-100 text-green-700" :
                            item.level <= 2 ? "bg-yellow-100 text-yellow-700" :
                            item.level <= 3 ? "bg-orange-100 text-orange-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {item.level}
                          </span>
                        </td>
                        <td className="py-2 px-2 font-medium text-gray-700">{item.label}</td>
                        <td className="py-2 px-2 text-gray-500">{item.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Positive Metrics */}
      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Heart className="h-6 w-6 text-green-500" />
        Criteres positifs
      </h2>
      <p className="text-gray-600 mb-6">
        Ces criteres mesurent les aspects educatifs et inspirants du contenu.
        Une note elevee (4-5) est <strong>positive</strong> et indique un contenu enrichissant.
      </p>

      <div className="space-y-6 mb-12">
        {positiveMetrics.map((metric) => (
          <Card key={metric.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                  <metric.icon className={`h-5 w-5 ${metric.color}`} />
                </div>
                {metric.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">{metric.description}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-gray-500 w-16">Note</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500 w-40">Niveau</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500">Exemple</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metric.scale.map((item) => (
                      <tr key={item.level} className="border-b last:border-0">
                        <td className="py-2 px-2">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                            item.level <= 1 ? "bg-gray-100 text-gray-600" :
                            item.level <= 2 ? "bg-green-50 text-green-600" :
                            item.level <= 3 ? "bg-green-100 text-green-700" :
                            "bg-green-200 text-green-800"
                          }`}>
                            {item.level}
                          </span>
                        </td>
                        <td className="py-2 px-2 font-medium text-gray-700">{item.label}</td>
                        <td className="py-2 px-2 text-gray-500">{item.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Community Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            La communaute
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            En plus de nos evaluations expertes, nous affichons les <strong>moyennes de la communaute</strong> :
            les notes donnees par les parents et educateurs qui ont utilise ces contenus avec leurs enfants.
          </p>
          <p className="text-gray-600">
            Vous pouvez <strong>contribuer</strong> en evaluant vous-meme les contenus que vous connaissez.
            Chaque avis aide d'autres familles a faire de meilleurs choix.
          </p>
          <div className="flex gap-4 pt-4">
            <Link
              href="/inscription"
              className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Rejoindre la communaute
            </Link>
            <Link
              href="/films"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Explorer les contenus
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle>Questions frequentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Comment sont realisees vos evaluations ?
            </h3>
            <p className="text-gray-600 text-sm">
              Nos evaluations combinent une analyse initiale par intelligence artificielle
              (basee sur les synopsis, classifications officielles et metadonnees),
              puis sont verifiees et ajustees par notre equipe. Les avis de la communaute
              viennent enrichir ces evaluations au fil du temps.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Pourquoi une note de 3 en violence est-elle orange et non verte ?
            </h3>
            <p className="text-gray-600 text-sm">
              Pour les criteres sensibles (violence, sexe, langage, etc.), nous utilisons
              un code couleur prudent : vert (0-1), jaune (2), orange (3), rouge (4-5).
              Une note de 3 indique une presence moderee qui peut necessiter une discussion
              avec l'enfant ou une supervision.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Quelle est la difference avec PEGI ou les classifications CSA ?
            </h3>
            <p className="text-gray-600 text-sm">
              Les classifications officielles donnent un age minimum recommande.
              Nous fournissons une analyse plus detaillee : vous pouvez voir exactement
              pourquoi un contenu est recommande a un certain age, et decider si cela
              correspond aux valeurs de votre famille.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
