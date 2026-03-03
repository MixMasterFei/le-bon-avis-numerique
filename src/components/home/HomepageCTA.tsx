"use client"

import { useState } from "react"
import Link from "next/link"
import { Users, Target, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HomepageCTAProps {
  variant: "soft" | "strong"
}

export function HomepageCTA({ variant }: HomepageCTAProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false
    return sessionStorage.getItem(`homepage-cta-${variant}-dismissed`) === "true"
  })

  if (dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    sessionStorage.setItem(`homepage-cta-${variant}-dismissed`, "true")
  }

  if (variant === "soft") {
    return (
      <div className="relative bg-gradient-to-r from-violet-50 to-indigo-50 rounded-2xl p-6 border border-violet-100">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-violet-100 rounded-xl shrink-0">
            <Users className="h-5 w-5 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 mb-1">
              Personnalisez pour votre foyer
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Créez un profil famille pour voir quels contenus conviennent à chaque membre de votre foyer.
            </p>
            <Link href="/inscription">
              <Button size="sm" className="bg-violet-600 hover:bg-violet-700">
                Créer mon profil
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-100">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Fermer"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-4">
        <div className="p-2.5 bg-emerald-100 rounded-xl shrink-0">
          <Target className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 mb-1">
            Recevez des recommandations sur mesure
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Renseignez l&apos;âge et les sensibilités de votre foyer, et découvrez les contenus faits pour vous.
          </p>
          <div className="flex items-center gap-3">
            <Link href="/inscription">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                S&apos;inscrire gratuitement
              </Button>
            </Link>
            <Link href="/a-propos">
              <Button variant="ghost" size="sm" className="text-emerald-700 hover:text-emerald-800">
                En savoir plus
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
