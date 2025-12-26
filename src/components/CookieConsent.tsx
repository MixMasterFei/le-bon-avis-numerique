"use client"

import { useState, useEffect } from "react"
import { Cookie, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if user has already consented
    const hasConsented = localStorage.getItem("cookie-consent")
    if (!hasConsented) {
      // Small delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", "accepted")
    setIsVisible(false)
  }

  const handleDecline = () => {
    localStorage.setItem("cookie-consent", "declined")
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6",
        "animate-fade-in"
      )}
    >
      <div className="container mx-auto max-w-4xl">
        <div className="bg-white rounded-2xl shadow-2xl border p-6 md:flex md:items-center md:gap-6">
          <div className="flex items-start gap-4 flex-1 mb-4 md:mb-0">
            <div className="p-3 bg-primary/10 rounded-xl shrink-0">
              <Cookie className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Nous respectons votre vie privée 🍪
              </h3>
              <p className="text-sm text-gray-600">
                Nous utilisons des cookies pour améliorer votre expérience. 
                Conformément au RGPD, vous pouvez accepter ou refuser les cookies non essentiels.{" "}
                <Link href="/confidentialite" className="text-primary hover:underline">
                  En savoir plus
                </Link>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button variant="outline" onClick={handleDecline}>
              Refuser
            </Button>
            <Button onClick={handleAccept}>
              Accepter
            </Button>
          </div>

          <button
            onClick={handleDecline}
            className="absolute top-4 right-4 md:hidden p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}



