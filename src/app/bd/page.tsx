import { Clock, BookOpen } from "lucide-react"
import Link from "next/link"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

export const metadata = {
  title: "Bandes Dessinées | Totem Avisé",
  description:
    "Évaluations de bandes dessinées et comics pour enfants et adolescents",
  robots: { index: false, follow: true },
}

export default function BDPage() {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"

  return (
    <div
      className="flex-1 flex items-center justify-center py-16 px-4"
      style={{ background: p.bg, color: p.ink }}
    >
      <div
        className="w-full max-w-lg rounded-3xl p-8 md:p-10 text-center"
        style={{ background: p.card, border: `1px solid ${p.line}` }}
      >
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5"
          style={{ background: p.bg2, color: p.accent }}
        >
          <BookOpen className="h-6 w-6" />
        </div>

        <div
          className="text-[11px] font-semibold mb-2 uppercase tracking-wide"
          style={{ color: p.accent }}
        >
          Bientôt
        </div>
        <h1
          className={`${serifClass} text-3xl md:text-4xl font-medium mb-4 leading-[1.05]`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          Bandes{" "}
          <em className="italic" style={{ color: p.accent }}>
            dessinées
          </em>
        </h1>
        <p className="text-base mb-6 max-w-md mx-auto" style={{ color: p.ink2 }}>
          Nous travaillons sur l&apos;ajout de bandes dessinées, mangas et
          comics à notre base de données. Vous pourrez bientôt consulter nos
          évaluations pour ces contenus.
        </p>

        <div
          className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full text-xs"
          style={{ background: p.bg2, color: p.ink2 }}
        >
          <Clock className="h-3.5 w-3.5" />
          En cours de préparation
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/films"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: p.ink, color: p.bg }}
          >
            Voir les films
          </Link>
          <Link
            href="/livres"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
            style={{
              background: "transparent",
              color: p.ink,
              border: `1px solid ${p.line2}`,
            }}
          >
            Voir les livres
          </Link>
        </div>
      </div>
    </div>
  )
}
