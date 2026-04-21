"use client"

import Link from "next/link"
import { APERCU_PALETTE } from "./apercuTheme"

export function ApercuFinalCTA({
  serifClass,
  isLoggedIn,
}: {
  serifClass: string
  isLoggedIn: boolean
}) {
  const p = APERCU_PALETTE

  return (
    <section className="py-10 md:py-14" style={{ background: p.bg }}>
      <div className="container mx-auto px-4 md:px-8">
        <div
          // Gradient uses accent/accent2 so it tracks the theme (darker
          // terracotta/sage in light, lifted variants in dark). Text
          // stays dark in both modes — lifted-pastel + dark text reads
          // as an editorial banner instead of a neon marketing splash.
          className="rounded-3xl text-center relative overflow-hidden py-12 md:py-16 px-6 md:px-14"
          style={{
            background: `linear-gradient(135deg, ${p.accent} 0%, ${p.accent2} 100%)`,
            color: "#1E1A15",
          }}
        >
          <h2
            className={`${serifClass} text-2xl md:text-4xl lg:text-5xl font-medium leading-[1.05] max-w-2xl mx-auto`}
            style={{ letterSpacing: "-0.03em" }}
          >
            {isLoggedIn
              ? "Prêts pour votre prochaine soirée ?"
              : "Prêts à composer votre prochaine soirée ?"}
          </h2>
          <p className="mt-4 text-sm md:text-base max-w-xl mx-auto" style={{ opacity: 0.75 }}>
            {isLoggedIn
              ? "Des recommandations adaptées à votre foyer, mises à jour chaque semaine."
              : "Gratuit et indépendant. Des analyses honnêtes, pensées pour les familles."}
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            {isLoggedIn ? (
              <>
                <Link
                  href="/profil"
                  className="px-7 py-3 rounded-full text-sm font-semibold transition-transform hover:scale-[1.02]"
                  style={{ background: "#1E1A15", color: "#F5F1E9" }}
                >
                  Mon espace
                </Link>
                <Link
                  href="/films"
                  className="px-6 py-3 rounded-full text-sm font-medium transition-colors"
                  style={{
                    border: "2px solid rgba(30,26,21,0.55)",
                    color: "#1E1A15",
                  }}
                >
                  Parcourir le catalogue
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/inscription"
                  className="px-7 py-3 rounded-full text-sm font-semibold transition-transform hover:scale-[1.02]"
                  style={{ background: "#1E1A15", color: "#F5F1E9" }}
                >
                  Créer mon foyer gratuitement
                </Link>
                <Link
                  href="/recherche"
                  className="px-6 py-3 rounded-full text-sm font-medium transition-colors"
                  style={{
                    border: "2px solid rgba(30,26,21,0.55)",
                    color: "#1E1A15",
                  }}
                >
                  Découvrir sans compte
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
