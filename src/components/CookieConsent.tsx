"use client"

import { useState, useEffect, useSyncExternalStore } from "react"
import { Cookie, Settings, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ESSENTIAL_ONLY,
  WITH_ANALYTICS,
  getCookieConsent,
  getServerCookieConsent,
  saveCookieConsent,
  subscribeCookieConsent,
  type CookiePreferences,
} from "@/lib/cookie-consent"

export function CookieConsent() {
  const consent = useSyncExternalStore(subscribeCookieConsent, getCookieConsent, getServerCookieConsent)
  const [delayElapsed, setDelayElapsed] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [preferences, setPreferences] = useState<CookiePreferences>(ESSENTIAL_ONLY)

  useEffect(() => {
    const timer = setTimeout(() => setDelayElapsed(true), 800)
    return () => clearTimeout(timer)
  }, [])

  const handleAcceptAll = () => {
    saveCookieConsent(WITH_ANALYTICS, "accepted")
  }

  const handleRejectAll = () => {
    saveCookieConsent(ESSENTIAL_ONLY, "declined")
  }

  const handleSavePreferences = () => {
    saveCookieConsent(preferences, "customized")
  }

  if (!delayElapsed || consent.choice !== "pending") return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[70] animate-in slide-in-from-bottom duration-300">
      <div className="mx-auto max-w-5xl px-4 pb-4">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          {!showDetails ? (
            /* Compact banner */
            <div className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-1.5 bg-primary/10 rounded-lg shrink-0 mt-0.5">
                    <Cookie className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-sm text-gray-600">
                    Avec votre accord, nous mesurons l’utilisation et les performances du site.{" "}
                    <Link href="/confidentialite" className="text-primary hover:underline">
                      En savoir plus
                    </Link>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    onClick={() => setShowDetails(true)}
                    variant="ghost"
                    size="sm"
                    className="text-gray-500"
                  >
                    <Settings className="mr-1.5 h-3.5 w-3.5" />
                    Personnaliser
                  </Button>
                  <Button
                    onClick={handleRejectAll}
                    variant="outline"
                    size="sm"
                    className="border-primary text-primary hover:bg-primary/5"
                  >
                    Tout refuser
                  </Button>
                  <Button onClick={handleAcceptAll} size="sm">
                    Tout accepter
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Expanded preferences panel */
            <div>
              <div className="flex items-center justify-between p-4 border-b bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-primary/10 rounded-lg">
                    <Cookie className="h-4 w-4 text-primary" />
                  </div>
                  <h2 className="font-semibold text-gray-900 text-sm">Gestion des cookies</h2>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-500 hover:text-gray-600 p-1"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 sm:p-5">
                <div className="grid gap-3 mb-4">
                  {/* Essential */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="mr-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 text-sm">Essentiels</h3>
                        <span className="text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                          Toujours actif
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Session et sécurité du site.
                      </p>
                    </div>
                    <div className="w-9 h-5 bg-primary rounded-full relative cursor-not-allowed shrink-0">
                      <div className="absolute right-[2px] top-[2px] w-4 h-4 bg-white rounded-full" />
                    </div>
                  </div>

                  {/* Analytics */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="mr-4">
                      <h3 className="font-medium text-gray-900 text-sm">Analytiques</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Mesurer l’utilisation et les performances du site.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        aria-label="Autoriser la mesure d’audience"
                        className="sr-only peer"
                        checked={preferences.analytics}
                        onChange={(e) =>
                          setPreferences({ ...preferences, analytics: e.target.checked })
                        }
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-checked:bg-primary rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                    </label>
                  </div>

                  {/* Marketing */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="mr-4">
                      <h3 className="font-medium text-gray-900 text-sm">Marketing</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Aucun traceur publicitaire utilisé.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-not-allowed shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        aria-label="Marketing non utilisé"
                        checked={false}
                        disabled
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-checked:bg-primary rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-gray-400">
                    <Link href="/cookies" className="text-primary hover:underline">
                      Politique de cookies
                    </Link>
                    {" · "}
                    Art. 82 loi Informatique et Libertes
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleRejectAll}
                      variant="outline"
                      size="sm"
                      className="border-primary text-primary hover:bg-primary/5"
                    >
                      Tout refuser
                    </Button>
                    <Button onClick={handleSavePreferences} size="sm">
                      Enregistrer
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
