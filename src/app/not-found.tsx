import type { Metadata } from "next"
import { Search, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Page introuvable",
  description: "La page que vous recherchez n'existe pas ou a été déplacée.",
  robots: { index: false, follow: true },
  alternates: {},
}

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-400/20 to-orange-400/20 rounded-full blur-2xl" />
        <div className="relative bg-gradient-to-br from-violet-100 to-orange-100 rounded-full p-6">
          <Search className="h-12 w-12 text-violet-600" />
        </div>
      </div>

      <h1 className="text-6xl md:text-8xl font-black gradient-text mb-2">
        404
      </h1>

      <h2 className="text-2xl md:text-3xl mb-3">
        Page introuvable
      </h2>

      <p className="text-muted-foreground text-lg mb-8 max-w-md">
        Cette page n&apos;existe pas ou a été déplacée.
        Essayez de chercher ce que vous voulez ou retournez à l&apos;accueil.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button size="lg" asChild className="gap-2">
          <Link href="/">
            <Home className="h-4 w-4" />
            Retour à l&apos;accueil
          </Link>
        </Button>
        <Button variant="outline" size="lg" asChild className="gap-2">
          <Link href="/recherche">
            <Search className="h-4 w-4" />
            Rechercher
          </Link>
        </Button>
      </div>
    </div>
  )
}
