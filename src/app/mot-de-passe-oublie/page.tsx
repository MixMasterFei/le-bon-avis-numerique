"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, Mail, ArrowLeft, Check } from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

const SAGE = "#5C8A5C"

export default function ForgotPasswordPage() {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setSent(true)
      } else {
        const data = await res.json()
        setError(data.error || "Une erreur est survenue")
      }
    } catch {
      setError("Erreur de connexion au serveur")
    } finally {
      setIsLoading(false)
    }
  }

  if (sent) {
    return (
      <section
        className="flex-1 flex items-center justify-center py-12 px-4"
        style={{ background: p.bg, color: p.ink }}
      >
        <div
          className="w-full max-w-md rounded-3xl p-8 text-center"
          style={{ background: p.card, border: `1px solid ${p.line}` }}
        >
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5"
            style={{ background: SAGE, color: "#fff" }}
          >
            <Check className="h-6 w-6" />
          </div>
          <h1
            className={`${serifClass} text-2xl md:text-3xl font-medium mb-2`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Email envoyé
          </h1>
          <p className="text-sm mb-6" style={{ color: p.ink2 }}>
            Si un compte existe avec{" "}
            <strong style={{ color: p.ink }}>{email}</strong>, vous recevrez un
            lien pour réinitialiser votre mot de passe.
          </p>
          <p className="text-xs mb-6" style={{ color: p.ink2 }}>
            Pensez à vérifier vos spams si vous ne trouvez pas l&apos;email.
          </p>
          <Link
            href="/connexion"
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: p.ink, color: p.bg }}
          >
            Retour à la connexion
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section
      className="flex-1 flex items-center justify-center py-12 px-4"
      style={{ background: p.bg, color: p.ink }}
    >
      <div
        className="w-full max-w-md rounded-3xl p-6 md:p-8"
        style={{ background: p.card, border: `1px solid ${p.line}` }}
      >
        <Link
          href="/connexion"
          className="inline-flex items-center gap-1.5 text-sm hover:opacity-70 mb-4"
          style={{ color: p.ink2 }}
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la connexion
        </Link>

        <h1
          className={`${serifClass} text-2xl md:text-3xl font-medium mb-2`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          Mot de passe oublié
        </h1>
        <p className="text-sm mb-6" style={{ color: p.ink2 }}>
          Entrez votre adresse email et nous vous enverrons un lien pour
          réinitialiser votre mot de passe.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="email"
              className="text-xs font-semibold mb-1.5 block"
              style={{ color: p.ink2 }}
            >
              Adresse email
            </label>
            <div className="relative">
              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                style={{ color: p.ink2 }}
              />
              <input
                id="email"
                type="email"
                placeholder="vous@exemple.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="w-full text-sm rounded-xl pl-9 pr-3.5 py-2.5 outline-none focus:ring-2 focus:ring-offset-1"
                style={{
                  background: p.bg2,
                  border: `1px solid ${p.line2}`,
                  color: p.ink,
                }}
              />
            </div>
          </div>

          {error && (
            <div
              className="rounded-xl px-3.5 py-2.5 text-sm"
              style={{
                background: "rgba(209, 106, 74, 0.12)",
                border: `1px solid ${p.accent}`,
                color: p.ink,
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: p.ink, color: p.bg }}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              "Envoyer le lien de réinitialisation"
            )}
          </button>
        </form>
      </div>
    </section>
  )
}
