"use client"

import Link from "next/link"
import { Check, X, Crown, Heart, Users, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const plans = [
  {
    name: "Gratuit",
    description: "Tout ce dont vous avez besoin pour faire les bons choix",
    price: "0",
    period: "pour toujours",
    highlight: false,
    features: [
      { text: "Tous les avis et evaluations", included: true },
      { text: "Recherche et filtres par age", included: true },
      { text: "Recommandations par age", included: true },
      { text: "Classifications francaises (CNC, PEGI)", included: true },
      { text: "Metriques de contenu detaillees", included: true },
      { text: "Acces sur tous vos appareils", included: true },
      { text: "Profils famille multiples", included: false },
      { text: "Recommandations personnalisees IA", included: false },
      { text: "Experience sans publicite", included: false },
    ],
    cta: "Creer un compte gratuit",
    ctaHref: "/inscription",
  },
  {
    name: "Premium",
    description: "Pour les familles qui veulent aller plus loin",
    price: "2,99",
    period: "/mois",
    highlight: true,
    badge: "Bientot disponible",
    features: [
      { text: "Tout du plan Gratuit", included: true },
      { text: "Profils famille multiples", included: true, highlight: true },
      { text: "Recommandations personnalisees IA", included: true, highlight: true },
      { text: "\"Ce soir on regarde\" suggestions", included: true, highlight: true },
      { text: "Listes de lecture synchronisees", included: true, highlight: true },
      { text: "Experience sans publicite", included: true, highlight: true },
      { text: "Acces anticipe aux nouveautes", included: true, highlight: true },
      { text: "Badge Soutien sur votre profil", included: true },
      { text: "Support prioritaire", included: true },
    ],
    cta: "M'avertir du lancement",
    ctaHref: "/inscription?notify=premium",
    ctaDisabled: true,
  },
]

const testimonials = [
  {
    quote: "Enfin un site en francais qui comprend nos besoins de parents !",
    author: "Marie L.",
    role: "Maman de 2 enfants",
  },
  {
    quote: "Les evaluations sont precises et m'aident vraiment a choisir.",
    author: "Thomas D.",
    role: "Papa de 3 enfants",
  },
]

export default function TarifsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="container mx-auto px-4 py-16 text-center">
        <Badge className="mb-4 bg-emerald-100 text-emerald-700 border-emerald-200">
          Tarification simple et transparente
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Gratuit pour l&apos;essentiel,
          <br />
          <span className="text-emerald-600">Premium pour aller plus loin</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Notre mission est d&apos;aider toutes les familles. C&apos;est pourquoi les fonctions essentielles
          resteront toujours gratuites.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="container mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative ${plan.highlight ? "border-emerald-500 border-2 shadow-xl" : "border-gray-200"}`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-emerald-500 text-white px-4 py-1">
                    {plan.badge}
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-2">
                <div className="flex justify-center mb-2">
                  {plan.highlight ? (
                    <div className="p-3 bg-emerald-100 rounded-full">
                      <Crown className="h-6 w-6 text-emerald-600" />
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-100 rounded-full">
                      <Heart className="h-6 w-6 text-gray-600" />
                    </div>
                  )}
                </div>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>

                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}€</span>
                  <span className="text-gray-500 ml-1">{plan.period}</span>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      {feature.included ? (
                        <Check className={`h-5 w-5 mt-0.5 flex-shrink-0 ${feature.highlight ? "text-emerald-500" : "text-gray-400"}`} />
                      ) : (
                        <X className="h-5 w-5 mt-0.5 flex-shrink-0 text-gray-300" />
                      )}
                      <span className={`text-sm ${feature.included ? (feature.highlight ? "text-gray-900 font-medium" : "text-gray-700") : "text-gray-400"}`}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link href={plan.ctaHref}>
                  <Button
                    className={`w-full ${plan.highlight ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                    variant={plan.highlight ? "default" : "outline"}
                    disabled={plan.ctaDisabled}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Trust Section */}
      <div className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Pourquoi c&apos;est gratuit ?
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Nous croyons que chaque parent merite d&apos;avoir acces a des informations fiables
              pour proteger ses enfants, quel que soit son budget.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="inline-flex p-4 bg-emerald-100 rounded-full mb-4">
                <Heart className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Mission sociale</h3>
              <p className="text-sm text-gray-600">
                Aider les familles est notre priorite, pas les profits.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex p-4 bg-emerald-100 rounded-full mb-4">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Communaute</h3>
              <p className="text-sm text-gray-600">
                Les membres Premium financent l&apos;acces gratuit pour tous.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex p-4 bg-emerald-100 rounded-full mb-4">
                <Sparkles className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Pas de surprise</h3>
              <p className="text-sm text-gray-600">
                Les fonctions gratuites le resteront. Promis.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
          Questions frequentes
        </h2>

        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Le plan gratuit est-il vraiment gratuit pour toujours ?
            </h3>
            <p className="text-gray-600">
              Oui. Nous nous engageons a maintenir l&apos;acces gratuit aux avis, evaluations et
              recommandations par age. C&apos;est le coeur de notre mission.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Quand le plan Premium sera-t-il disponible ?
            </h3>
            <p className="text-gray-600">
              Nous travaillons sur les fonctionnalites Premium. Inscrivez-vous pour etre
              averti du lancement et beneficier d&apos;une offre speciale early adopter.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Puis-je annuler mon abonnement Premium a tout moment ?
            </h3>
            <p className="text-gray-600">
              Absolument. Aucun engagement, vous pouvez annuler quand vous voulez et
              continuer a utiliser toutes les fonctions gratuites.
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-emerald-600 py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Pret a faire les bons choix pour votre famille ?
          </h2>
          <p className="text-emerald-100 mb-6 max-w-xl mx-auto">
            Rejoignez des milliers de parents qui utilisent Le Bon Sens Numerique.
          </p>
          <Link href="/inscription">
            <Button size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50">
              Commencer gratuitement
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
