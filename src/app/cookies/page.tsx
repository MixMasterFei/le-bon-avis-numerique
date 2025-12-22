"use client"

import { useState, useEffect } from "react"
import { Cookie, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface CookiePreferences {
  essential: boolean
  analytics: boolean
  marketing: boolean
}

export default function CookiesPage() {
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Always required
    analytics: false,
    marketing: false,
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Load saved preferences
    const savedPrefs = localStorage.getItem("cookie-preferences")
    if (savedPrefs) {
      try {
        const parsed = JSON.parse(savedPrefs)
        setPreferences((prev) => ({ ...prev, ...parsed }))
      } catch {
        // Ignore parse errors
      }
    }
  }, [])

  const handleSave = () => {
    localStorage.setItem("cookie-preferences", JSON.stringify(preferences))
    localStorage.setItem("cookie-consent", "customized")
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleAcceptAll = () => {
    const allAccepted = { essential: true, analytics: true, marketing: true }
    setPreferences(allAccepted)
    localStorage.setItem("cookie-preferences", JSON.stringify(allAccepted))
    localStorage.setItem("cookie-consent", "accepted")
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleRejectAll = () => {
    const onlyEssential = { essential: true, analytics: false, marketing: false }
    setPreferences(onlyEssential)
    localStorage.setItem("cookie-preferences", JSON.stringify(onlyEssential))
    localStorage.setItem("cookie-consent", "declined")
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
      examples: ["Session utilisateur", "Preferences de langue", "Securite"],
    },
    {
      id: "analytics",
      name: "Cookies analytiques",
      description:
        "Ces cookies nous aident a comprendre comment les visiteurs interagissent avec le site en collectant des informations anonymes.",
      required: false,
      examples: ["Pages visitees", "Temps passe sur le site", "Source du trafic"],
    },
    {
      id: "marketing",
      name: "Cookies marketing",
      description:
        "Ces cookies sont utilises pour suivre les visiteurs sur les sites web afin d'afficher des publicites pertinentes.",
      required: false,
      examples: ["Publicites personnalisees", "Reseaux sociaux", "Remarketing"],
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
          Nous utilisons des cookies pour ameliorer votre experience sur notre site.
          Vous pouvez personnaliser vos preferences ci-dessous.
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
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={preferences[category.id as keyof CookiePreferences]}
                    disabled={category.required}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        [category.id]: e.target.checked,
                      })
                    }
                  />
                  <div
                    className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all ${
                      category.required
                        ? "bg-primary cursor-not-allowed"
                        : "bg-gray-200 peer-checked:bg-primary"
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
          Vos preferences sont sauvegardees localement dans votre navigateur.
        </p>
        <Button onClick={handleSave}>
          {saved ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Preferences sauvegardees
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
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
