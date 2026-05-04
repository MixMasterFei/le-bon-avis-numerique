import { Heart, Shield, Users, Star, BarChart3, Eye, MessageCircle, Zap, Award, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export const metadata = {
  title: "Comment ça marche | Totem Avisé",
  description: "Comment Totem Avisé analyse chaque contenu sur 7 critères pour recommander les films, séries et jeux adaptés à votre famille.",
  // Override the root layout's canonical "/" so this page isn't
  // merged with the homepage in Google's index.
  alternates: { canonical: "/nos-valeurs" },
}

const contentMetrics = [
  {
    id: "violence",
    name: "Violence",
    icon: Shield,
    color: "text-red-500",
    bgColor: "bg-red-50",
    description: "Mesure la présence de violence physique, verbale ou psychologique dans le contenu.",
    scale: [
      { level: 0, label: "Aucune violence", example: "Aucune scène de conflit physique ou verbal agressif" },
      { level: 1, label: "Violence très légère", example: "Conflits résolus pacifiquement, slapstick cartoon" },
      { level: 2, label: "Violence légère", example: "Bagarres sans conséquences, tensions dramatiques" },
      { level: 3, label: "Violence modérée", example: "Combats avec conséquences visibles, scènes de danger" },
      { level: 4, label: "Violence intense", example: "Scènes de bataille, violence réaliste, blessures" },
      { level: 5, label: "Violence extrême", example: "Violence graphique, gore, cruauté explicite" },
    ],
  },
  {
    id: "sexNudity",
    name: "Sexe / Nudité",
    icon: Eye,
    color: "text-pink-500",
    bgColor: "bg-pink-50",
    description: "Évalue la présence de contenu sexuel, scènes romantiques explicites ou nudité.",
    scale: [
      { level: 0, label: "Aucun contenu", example: "Pas de romance ou nudité" },
      { level: 1, label: "Romance légère", example: "Baisers, mains tenues, romance innocente" },
      { level: 2, label: "Romance plus explicite", example: "Scènes de baisers prolongés, flirt marqué" },
      { level: 3, label: "Contenu suggestif", example: "Sous-entendus, tenues révélatrices, nudité partielle" },
      { level: 4, label: "Contenu sexuel", example: "Scènes de nudité, allusions sexuelles explicites" },
      { level: 5, label: "Contenu explicite", example: "Scènes sexuelles explicites, nudité complète" },
    ],
  },
  {
    id: "language",
    name: "Langage",
    icon: MessageCircle,
    color: "text-orange-500",
    bgColor: "bg-orange-50",
    description: "Indique la fréquence de langage grossier, insultes ou jurons.",
    scale: [
      { level: 0, label: "Langage adapté à tous", example: "Aucun mot grossier ou inapproprié" },
      { level: 1, label: "Langage très léger", example: "Expressions légères type 'zut', 'mince'" },
      { level: 2, label: "Langage léger", example: "Quelques jurons doux, insultes légères" },
      { level: 3, label: "Langage modéré", example: "Jurons réguliers, insultes occasionnelles" },
      { level: 4, label: "Langage grossier", example: "Gros mots fréquents, insultes vulgaires" },
      { level: 5, label: "Langage très vulgaire", example: "Langage extrêmement grossier et constant" },
    ],
  },
  {
    id: "consumerism",
    name: "Consumérisme",
    icon: Zap,
    color: "text-yellow-500",
    bgColor: "bg-yellow-50",
    description: "Mesure la présence de messages incitant à la consommation, placement de produits ou matérialisme.",
    scale: [
      { level: 0, label: "Pas de messages commerciaux", example: "Aucun placement produit, pas de matérialisme" },
      { level: 1, label: "Mentions mineures", example: "Marques visibles en arrière-plan" },
      { level: 2, label: "Quelques placements", example: "Produits identifiés, mentions de marques" },
      { level: 3, label: "Placements notables", example: "Intégration de produits dans l'histoire" },
      { level: 4, label: "Messages commerciaux forts", example: "Incitation claire à l'achat, merchandising" },
      { level: 5, label: "Très commercial", example: "Contenu principalement promotionnel, achats in-app" },
    ],
  },
  {
    id: "substanceUse",
    name: "Substances",
    icon: Shield,
    color: "text-purple-500",
    bgColor: "bg-purple-50",
    description: "Évalue la représentation d'alcool, tabac, drogues ou autres substances.",
    scale: [
      { level: 0, label: "Aucune représentation", example: "Pas d'alcool, tabac ou drogues" },
      { level: 1, label: "Présence en arrière-plan", example: "Verres de vin au dîner, bar en fond" },
      { level: 2, label: "Consommation occasionnelle", example: "Personnages qui boivent socialement" },
      { level: 3, label: "Consommation régulière", example: "Scènes de bar, cigarettes visibles" },
      { level: 4, label: "Usage problématique abordé", example: "Ivresse, dépendance montrée" },
      { level: 5, label: "Usage fréquemment montré", example: "Drogues, alcoolisme banalisé ou glorifié" },
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
    description: "Note la présence de valeurs positives : amitié, courage, persévérance, empathie, entraide.",
    scale: [
      { level: 0, label: "Pas de message particulier", example: "Divertissement sans thème éducatif" },
      { level: 1, label: "Messages implicites", example: "Valeurs suggérées mais non développées" },
      { level: 2, label: "Quelques messages positifs", example: "Thèmes d'amitié ou de coopération" },
      { level: 3, label: "Messages clairs", example: "Valeurs explicitement présentées" },
      { level: 4, label: "Messages forts", example: "Thèmes éducatifs bien développés" },
      { level: 5, label: "Très enrichissant", example: "Contenu profondément éducatif et inspirant" },
    ],
  },
  {
    id: "roleModels",
    name: "Modèles positifs",
    icon: Star,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    description: "Évalue la qualité des personnages comme modèles : comportements admirables, résolution de problèmes, respect des autres.",
    scale: [
      { level: 0, label: "Pas de modèle positif", example: "Personnages sans qualités admirables" },
      { level: 1, label: "Modèles faibles", example: "Quelques comportements positifs isolés" },
      { level: 2, label: "Modèles occasionnels", example: "Personnages parfois admirables" },
      { level: 3, label: "Bons modèles", example: "Personnages avec des qualités claires" },
      { level: 4, label: "Très bons modèles", example: "Personnages inspirants et exemplaires" },
      { level: 5, label: "Modèles exceptionnels", example: "Personnages profondément inspirants" },
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
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Comment ça marche</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Comment on évalue chaque contenu et pourquoi on recommande (ou pas) un film, une série ou un jeu pour votre famille.
        </p>
      </div>

      {/* Introduction */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Notre approche
          </h2>
          <div className="space-y-4 text-gray-600">
            <p>
              <strong>Totem Avisé</strong> est fait pour les familles.
              On analyse chaque contenu sur 7 critères pour aller au-delà d&apos;un simple âge minimum.
              Violence, langage, messages positifs, modèles inspirants : on regarde tout.
            </p>
            <p>
              Quand vous créez votre profil famille, on croise ces données avec l&apos;âge,
              les sensibilités et les goûts de chaque membre.
              Résultat : des suggestions qui collent vraiment à votre foyer.
            </p>
            <p>
              Les retours des familles améliorent nos suggestions au fil du temps.
              Quand un parent dit &quot;trop effrayant pour mon fils de 6 ans&quot;, ça profite à tout le monde.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Age Recommendations */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Nos recommandations d&apos;âge
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            Pour chaque contenu, nous fournissons deux types de recommandations d&apos;âge :
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Âge recommandé (Totem)</h3>
              </div>
              <p className="text-sm text-blue-800">
                Basé sur notre analyse du contenu selon les critères ci-dessous.
                Prend en compte la maturité émotionnelle nécessaire pour apprécier le contenu.
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-900">Âge suggéré (Communauté)</h3>
              </div>
              <p className="text-sm text-green-800">
                Moyenne des suggestions des membres de notre communauté.
                Reflète l&apos;expérience réelle des spectateurs et des familles.
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500 italic">
            Note : Ces âges sont des suggestions indicatives. Chaque personne et chaque famille est différente.
            Un contenu suggéré pour un âge donné peut convenir plus tôt ou plus tard selon la maturité et les sensibilités de chacun.
          </p>
        </CardContent>
      </Card>

      {/* Content Metrics - Negative */}
      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-primary" />
        Critères d&apos;évaluation du contenu
      </h2>
      <p className="text-gray-600 mb-6">
        Ces critères mesurent la présence d&apos;éléments potentiellement sensibles.
        Une note élevée (4-5) indique une forte présence de cet élément.
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
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full text-xs sm:text-sm">
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
        Critères positifs
      </h2>
      <p className="text-gray-600 mb-6">
        Ces critères mesurent les aspects éducatifs et inspirants du contenu.
        Une note élevée (4-5) est <strong>positive</strong> et indique un contenu enrichissant.
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
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full text-xs sm:text-sm">
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
            La communauté
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            Plus les familles partagent leurs retours, plus les suggestions s&apos;affinent.
            &quot;Mon enfant a adoré&quot;, &quot;c&apos;était trop effrayant&quot;, &quot;parfait pour cet âge&quot; :
            chaque réaction améliore les recommandations pour tout le monde.
          </p>
          <p className="text-gray-600">
            Partagez les réactions de votre famille sur les contenus que vous connaissez.
            Ça prend quelques secondes et ça aide toutes les familles.
          </p>
          <div className="flex gap-4 pt-4">
            <Link
              href="/inscription"
              className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Créer mon profil famille
            </Link>
            <Link
              href="/films"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Découvrir les films
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle>Questions fréquentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Comment fonctionnent vos recommandations ?
            </h3>
            <p className="text-gray-600 text-sm">
              Chaque contenu est analysé sur 7 critères (violence, langage, messages positifs, substances, contenu sexuel, consumérisme, modèles positifs).
              On croise ces données avec le profil de votre famille pour trouver ce qui colle.
              Les retours des parents affinent les suggestions au fil du temps.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Pourquoi une note de 3 en violence est-elle orange et non verte ?
            </h3>
            <p className="text-gray-600 text-sm">
              Pour les critères sensibles (violence, sexe, langage, etc.), nous utilisons
              un code couleur prudent : vert (0-1), jaune (2), orange (3), rouge (4-5).
              Une note de 3 indique une présence modérée qui peut nécessiter une réflexion
              ou une discussion en famille.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Quelle est la différence avec PEGI ou les classifications CSA ?
            </h3>
            <p className="text-gray-600 text-sm">
              Les classifications officielles donnent un âge minimum, point final.
              Totem Avisé vous montre <em>pourquoi</em> un contenu convient (ou pas) à un âge donné,
              et les suggestions s&apos;adaptent aux sensibilités de chaque membre de votre famille.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
