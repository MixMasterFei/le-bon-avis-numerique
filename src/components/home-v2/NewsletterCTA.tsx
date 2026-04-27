"use client"

import { useState } from "react"
import { Mail, Send, CheckCircle2, Loader2, Lock } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }

/**
 * Bottom-of-page newsletter signup. Lives below the older briefs
 * (after the user has scrolled through the whole feed) — the natural
 * place to offer "want this delivered weekly?".
 *
 * Wired to /api/newsletter/subscribe → Resend Audiences. Idempotent:
 * resubmitting an already-subscribed email shows the "already there"
 * message rather than failing.
 *
 * `canSubscribe` is the admin-gate flag from the server (admin role
 * OR NEWSLETTER_PUBLIC=true). When false, renders an "en bêta" stub
 * instead of the form so non-admin testers can't subscribe to a
 * newsletter Xavier hasn't validated yet.
 */
export function NewsletterCTA({
  serifClass,
  canSubscribe,
}: {
  serifClass: string
  canSubscribe: boolean
}) {
  const p = APERCU_PALETTE
  const [email, setEmail] = useState("")
  const [state, setState] = useState<SubmitState>({ kind: "idle" })

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email.trim()) return
    setState({ kind: "submitting" })
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = (await res.json()) as
        | { status: "subscribed" | "already"; email: string }
        | { error: string }
      if (!res.ok || "error" in data) {
        setState({
          kind: "error",
          message:
            "error" in data
              ? data.error
              : "Une erreur est survenue. Réessayez dans quelques instants.",
        })
        return
      }
      setState({
        kind: "success",
        message:
          data.status === "already"
            ? "Vous êtes déjà inscrit·e — merci !"
            : "Inscription confirmée. À très bientôt dans votre boîte mail.",
      })
      setEmail("")
    } catch {
      setState({
        kind: "error",
        message: "Réseau indisponible. Réessayez dans un instant.",
      })
    }
  }

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
        {!canSubscribe ? (
          <div
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold"
            style={{ background: "rgba(30,26,21,0.85)", color: "#F5F1E9" }}
          >
            <Lock className="w-3.5 h-3.5" />
            En bêta privée. Inscriptions bientôt ouvertes.
          </div>
        ) : state.kind === "success" ? (
          <div
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold"
            style={{ background: "#1E1A15", color: "#F5F1E9" }}
          >
            <CheckCircle2 className="w-4 h-4" />
            {state.message}
          </div>
        ) : (
          <form
            className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto"
            onSubmit={onSubmit}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre.email@exemple.fr"
              required
              disabled={state.kind === "submitting"}
              autoComplete="email"
              className="flex-1 px-4 py-3 rounded-full text-sm focus:outline-none focus:ring-2 disabled:opacity-60"
              style={{
                background: "rgba(255,255,255,0.95)",
                color: "#1E1A15",
              }}
            />
            <button
              type="submit"
              disabled={state.kind === "submitting"}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-full text-sm font-semibold transition-transform hover:scale-[1.02] disabled:opacity-60"
              style={{ background: "#1E1A15", color: "#F5F1E9" }}
            >
              {state.kind === "submitting" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              S&apos;abonner
            </button>
          </form>
        )}
        {state.kind === "error" && (
          <p className="text-[12px] mt-3 font-medium" style={{ color: "#1E1A15" }}>
            {state.message}
          </p>
        )}
        <p className="text-[11px] mt-3" style={{ opacity: 0.6 }}>
          Désabonnement en un clic. Aucune publicité.
        </p>
      </div>
    </section>
  )
}
