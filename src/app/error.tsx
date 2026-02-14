"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Application error:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-400/20 to-pink-400/20 rounded-full blur-2xl" />
        <div className="relative bg-gradient-to-br from-violet-100 to-pink-100 rounded-full p-6">
          <AlertTriangle className="h-12 w-12 text-violet-600" />
        </div>
      </div>

      <h1 className="text-3xl md:text-4xl mb-3 gradient-text">
        Oups, quelque chose s&apos;est mal passe
      </h1>

      <p className="text-muted-foreground text-lg mb-8 max-w-md">
        Une erreur inattendue est survenue. Pas de panique, vous pouvez
        reessayer ou retourner a l&apos;accueil.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={reset} size="lg" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Reessayer
        </Button>
        <Button variant="outline" size="lg" asChild className="gap-2">
          <Link href="/">
            <Home className="h-4 w-4" />
            Retour a l&apos;accueil
          </Link>
        </Button>
      </div>

      {error.digest && (
        <p className="text-xs text-muted-foreground mt-8">
          Code erreur : {error.digest}
        </p>
      )}
    </div>
  )
}
