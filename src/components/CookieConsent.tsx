"use client"

import { useState, useEffect } from "react"
import { Cookie, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface CookiePreferences {
  essential: boolean
  analytics: boolean
  marketing: boolean
}

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    marketing: false,
  })

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem("cookie-consent")
    if (!consent) {
      // Small delay to prevent flash on page load
      const timer = setTimeout(() => setShowBanner(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAcceptAll = () => {
    const allAccepted = { essential: true, analytics: true, marketing: true }
    localStorage.setItem("cookie-preferences", JSON.stringify(allAccepted))
    localStorage.setItem("cookie-consent", "accepted")
    setShowBanner(false)
  }

  const handleRejectAll = () => {
    const onlyEssential = { essential: true, analytics: false, marketing: false }
    localStorage.setItem("cookie-preferences", JSON.stringify(onlyEssential))
    localStorage.setItem("cookie-consent", "declined")
    setShowBanner(false)
  }

  const handleSavePreferences = () => {
    localStorage.setItem("cookie-preferences", JSON.stringify(preferences))
    localStorage.setItem("cookie-consent", "customized")
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Banner */}
      <div className="relative w-full max-w-2xl mx-4 mb-4 sm:mb-0 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Cookie className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-semibold text-gray-900">Gestion des cookies</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {!showDetails ? (
            <>
              <p className="text-gray-600 text-sm mb-4">
                Nous utilisons des cookies pour ameliorer votre experience sur notre site,
                analyser le trafic et personnaliser le contenu. Conformement au RGPD et aux
                recommandations de la CNIL, nous vous demandons votre consentement avant
                de deposer certains cookies.
              </p>
              <p className="text-gray-600 text-sm mb-6">
                Vous pouvez accepter tous les cookies, les refuser ou personnaliser vos
                choix. Pour en savoir plus, consultez notre{" "}
                <Link href="/confidentialite" className="text-primary hover:underline">
                  Politique de confidentialite
                </Link>{" "}
                et notre page{" "}
                <Link href="/cookies" className="text-primary hover:underline">
                  Gestion des cookies
                </Link>
                .
              </p>
            </>
          ) : (
            <div className="space-y-4 mb-6">
              {/* Essential cookies */}
              <div className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 mr-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 text-sm">Cookies essentiels</h3>
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                      Toujours actif
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Necessaires au fonctionnement du site (session, securite).
                  </p>
                </div>
                <div className="w-11 h-6 bg-primary rounded-full relative cursor-not-allowed">
                  <div className="absolute right-[2px] top-[2px] w-5 h-5 bg-white rounded-full" />
                </div>
              </div>

              {/* Analytics cookies */}
              <div className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 mr-4">
                  <h3 className="font-medium text-gray-900 text-sm">Cookies analytiques</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Nous aident a comprendre comment vous utilisez le site.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={preferences.analytics}
                    onChange={(e) =>
                      setPreferences({ ...preferences, analytics: e.target.checked })
                    }
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-checked:bg-primary rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                </label>
              </div>

              {/* Marketing cookies */}
              <div className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 mr-4">
                  <h3 className="font-medium text-gray-900 text-sm">Cookies marketing</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Utilises pour afficher des publicites pertinentes.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={preferences.marketing}
                    onChange={(e) =>
                      setPreferences({ ...preferences, marketing: e.target.checked })
                    }
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-checked:bg-primary rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                </label>
              </div>
            </div>
          )}

          {/* Buttons - CNIL requires equal prominence for Accept and Reject */}
          <div className="flex flex-col sm:flex-row gap-3">
            {!showDetails ? (
              <>
                {/* CNIL: Accept and Reject must have equal prominence */}
                <Button
                  onClick={handleAcceptAll}
                  className="flex-1"
                >
                  Tout accepter
                </Button>
                <Button
                  onClick={handleRejectAll}
                  variant="outline"
                  className="flex-1 border-primary text-primary hover:bg-primary/5"
                >
                  Tout refuser
                </Button>
                <Button
                  onClick={() => setShowDetails(true)}
                  variant="ghost"
                  className="flex-1"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Personnaliser
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleSavePreferences}
                  className="flex-1"
                >
                  Enregistrer mes choix
                </Button>
                <Button
                  onClick={() => setShowDetails(false)}
                  variant="ghost"
                  className="flex-1"
                >
                  Retour
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-t">
          <p className="text-xs text-gray-500 text-center">
            Conformement a l&apos;article 82 de la loi Informatique et Libertes et aux
            recommandations de la CNIL, vous pouvez modifier vos choix a tout moment
            depuis notre page{" "}
            <Link href="/cookies" className="text-primary hover:underline">
              Gestion des cookies
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}




