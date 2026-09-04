"use client"

import { useState, useSyncExternalStore } from "react"
import { Cookie, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

import {
  ESSENTIAL_ONLY,
  WITH_ANALYTICS,
  getCookieConsent,
  getServerCookieConsent,
  saveCookieConsent,
  subscribeCookieConsent,
  type CookieConsentState,
  type CookiePreferences,
} from "@/lib/cookie-consent"

export default function CookiesPage() {
  const consent = useSyncExternalStore(subscribeCookieConsent, getCookieConsent, getServerCookieConsent)
  const [draft, setDraft] = useState<{ consent: CookieConsentState; preferences: CookiePreferences } | null>(null)
  const preferences = draft?.consent === consent ? draft.preferences : consent.preferences
  const [saved, setSaved] = useState(false)
  const [persisted, setPersisted] = useState(true)

  const handleSave = () => {
    setPersisted(saveCookieConsent(preferences, "customized"))
    setDraft(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleAcceptAll = () => {
    setPersisted(saveCookieConsent(WITH_ANALYTICS, "accepted"))
    setDraft(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleRejectAll = () => {
    setPersisted(saveCookieConsent(ESSENTIAL_ONLY, "declined"))
    setDraft(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const cookieCategories = [
    {
      id: "essential",
      name: "Cookies essentiels",
      description:
        "Ces cookies sont necessaires au fonctionnement du site. Ils permettent d'utiliser les fonctionnalites de base comme la navigation et l'acces aux zones securisees.",
      required: true,
      unused: false,
      examples: ["Session utilisateur", "Preferences de langue", "Securite"],
    },
    {
      id: "analytics",
      name: "Mesure d’audience et de performance",
      description:
        "Avec votre accord, Plausible, Vercel Analytics et Vercel Speed Insights mesurent la fréquentation, les interactions et les performances du site. Ces outils fonctionnent sans cookies publicitaires.",
      required: false,
      unused: false,
      examples: ["Pages visitées", "Performances du site", "Source du trafic"],
    },
    {
      id: "marketing",
      name: "Cookies marketing",
      description:
        "Nous n’utilisons aucun traceur publicitaire ou de remarketing. Cette catégorie est désactivée.",
      required: false,
      unused: true,
      examples: ["Non utilisé"],
    },
  ]

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-12">
        <div className="inline-flex p-4 bg-primary/10 rounded-full mb-4">
          <Cookie className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Gestion des cookies</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Les cookies essentiels permettent le fonctionnement du site.
          Vous pouvez choisir d’autoriser la mesure d’audience et de performance ci-dessous.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <Button onClick={handleAcceptAll} className="flex-1">
          <Check className="mr-2 h-4 w-4" />
          Accepter tous les cookies
        </Button>
        <Button onClick={handleRejectAll} variant="outline" className="flex-1">
          <X className="mr-2 h-4 w-4" />
          Refuser les cookies non essentiels
        </Button>
      </div>

      {/* Cookie Categories */}
      <div className="space-y-4 mb-8">
        {cookieCategories.map((category) => (
          <Card key={category.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{category.name}</CardTitle>
                  {category.required && (
                    <span className="text-xs text-gray-500">Toujours actif</span>
                  )}
                  {category.unused && (
                    <span className="text-xs text-gray-500">Non utilisé</span>
                  )}
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    aria-label={category.name}
                    className="sr-only peer"
                    checked={preferences[category.id as keyof CookiePreferences]}
                    disabled={category.required || category.unused}
                    onChange={(e) =>
                      setDraft({
                        consent,
                        preferences: { ...preferences, [category.id]: e.target.checked },
                      })
                    }
                  />
                  <div
                    className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all ${
                      category.required
                        ? "bg-primary cursor-not-allowed"
                        : category.unused ? "bg-gray-200 cursor-not-allowed" : "bg-gray-200 peer-checked:bg-primary"
                    }`}
                  />
                </label>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-3">{category.description}</CardDescription>
              <div className="flex flex-wrap gap-2">
                {category.examples.map((example) => (
                  <span
                    key={example}
                    className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                  >
                    {example}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {persisted
            ? "Vos préférences sont sauvegardées localement dans votre navigateur."
            : "Votre choix est appliqué pour cette visite. Le stockage du navigateur est indisponible."}
        </p>
        <Button onClick={handleSave}>
          {saved ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              {persisted ? "Préférences sauvegardées" : "Préférences appliquées"}
            </>
          ) : (
            "Sauvegarder mes preferences"
          )}
        </Button>
      </div>

      {/* Additional Info */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">En savoir plus</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm text-gray-600">
          <p>
            Pour plus d&apos;informations sur la facon dont nous utilisons vos donnees,
            consultez notre{" "}
            <a href="/confidentialite" className="text-primary hover:underline">
              Politique de Confidentialite
            </a>
            .
          </p>
          <p>
            Conformement au RGPD, vous avez le droit de retirer votre consentement
            a tout moment en modifiant vos preferences sur cette page.
            Le retrait arrête les nouvelles mesures ; il n’efface pas les données déjà transmises.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
