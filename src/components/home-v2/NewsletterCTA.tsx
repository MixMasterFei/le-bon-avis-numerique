"use client"

import { Mail, Send } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"

/**
 * Bottom-of-page newsletter signup. Lives below the older briefs
 * (after the user has scrolled through the whole feed) — the natural
 * place to offer "want this delivered weekly?".
 *
 * For the Aperçu the form is non-functional — we'll wire to Resend
 * (already in the stack) once the layout ships.
 */
export function NewsletterCTA({ serifClass }: { serifClass: string }) {
  const p = APERCU_PALETTE

  return (
    <section className="my-12 md:my-16">
      <div
        className="rounded-3xl px-6 md:px-12 py-10 md:py-14 text-center"
        style={{
          background: `linear-gradient(135deg, ${p.accent} 0%, ${p.accent2} 100%)`,
          color: "#1E1A15",
        }}
      >
        <Mail className="w-8 h-8 mx-auto mb-3" style={{ opacity: 0.7 }} />
        <h2
          className={`${serifClass} text-2xl md:text-3xl font-medium mb-2`}
          style={{ letterSpacing: "-0.02em" }}
        >
          La sélection famille,{" "}
          <em className="italic">chaque semaine</em>
        </h2>
        <p className="text-sm md:text-base mb-6 max-w-md mx-auto" style={{ opacity: 0.8 }}>
          Les actualités qui comptent pour les familles, condensées en quelques minutes de lecture. Gratuit et sans publicité.
        </p>
        <form
          className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto"
          onSubmit={(e) => {
            e.preventDefault()
            // Wire to Resend in the live cutover — for the Aperçu this
            // is a layout placeholder.
          }}
        >
          <input
            type="email"
            placeholder="votre.email@exemple.fr"
            required
            className="flex-1 px-4 py-3 rounded-full text-sm focus:outline-none focus:ring-2"
            style={{
              background: "rgba(255,255,255,0.95)",
              color: "#1E1A15",
            }}
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-full text-sm font-semibold transition-transform hover:scale-[1.02]"
            style={{ background: "#1E1A15", color: "#F5F1E9" }}
          >
            <Send className="w-3.5 h-3.5" />
            S&apos;abonner
          </button>
        </form>
        <p className="text-[11px] mt-3" style={{ opacity: 0.6 }}>
          Désabonnement en un clic. Aucune publicité.
        </p>
      </div>
    </section>
  )
}
