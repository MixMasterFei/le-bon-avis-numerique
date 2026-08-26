import { Search, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

export default function NotFound() {
  const p = APERCU_PALETTE

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center"
      style={{ background: p.bg, color: p.ink }}
    >
      <div className="relative mb-6">
        <div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: "linear-gradient(135deg, var(--color-accent) 0%, #D99524 100%)", opacity: 0.2 }}
        />
        <div
          className="relative rounded-full p-6"
          style={{ background: "linear-gradient(135deg, #F4C7A6 0%, #FAEBD7 100%)" }}
        >
          <Search className="h-12 w-12" style={{ color: p.accent }} />
        </div>
      </div>

      <h1
        className="text-6xl md:text-8xl font-black mb-2"
        style={{
          background: "linear-gradient(135deg, var(--color-accent) 0%, #D99524 50%, var(--color-accent) 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        404
      </h1>

      <h2 className="text-2xl md:text-3xl mb-3" style={{ color: p.ink }}>
        Page introuvable
      </h2>

      <p className="text-lg mb-8 max-w-md" style={{ color: p.ink2 }}>
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
