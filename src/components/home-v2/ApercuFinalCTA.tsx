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
          className="rounded-3xl text-center text-white relative overflow-hidden py-12 md:py-16 px-6 md:px-14"
          style={{
            background: `linear-gradient(135deg, ${p.accent} 0%, ${p.accent2} 100%)`,
          }}
        >
          <h2
            className={`${serifClass} text-2xl md:text-4xl lg:text-5xl font-medium leading-[1.05] max-w-2xl mx-auto`}
            style={{ letterSpacing: "-0.03em" }}
          >
            {isLoggedIn
              ? "Prêts pour votre prochaine soirée famille ?"
              : "Prêts à composer votre prochaine soirée famille ?"}
          </h2>
          <p className="mt-4 text-sm md:text-base opacity-90 max-w-xl mx-auto">
            {isLoggedIn
              ? "Des recommandations adaptées à votre foyer, mises à jour chaque semaine."
              : "Gratuit, sans publicité, sans algorithme opaque. Juste des parents qui s’entraident."}
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            {isLoggedIn ? (
              <>
                <Link
                  href="/profil"
                  className="px-7 py-3 rounded-full text-sm font-semibold transition-transform hover:scale-[1.02]"
                  style={{ background: "#fff", color: p.ink }}
                >
                  Mon espace famille
                </Link>
                <Link
                  href="/films"
                  className="px-6 py-3 rounded-full text-sm font-medium border-2 border-white/50 text-white hover:bg-white/10 transition-colors"
                >
                  Parcourir le catalogue
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/inscription"
                  className="px-7 py-3 rounded-full text-sm font-semibold transition-transform hover:scale-[1.02]"
                  style={{ background: "#fff", color: p.ink }}
                >
                  Créer mon foyer gratuitement
                </Link>
                <Link
                  href="/recherche"
                  className="px-6 py-3 rounded-full text-sm font-medium border-2 border-white/50 text-white hover:bg-white/10 transition-colors"
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
