"use client"

import { useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, Lock, Eye, EyeOff, Check, X } from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

const SAGE = "#5C8A5C"

function ResetPasswordForm() {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  if (!token) {
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
            style={{ background: p.accent, color: "#fff" }}
          >
            <X className="h-6 w-6" />
          </div>
          <h1
            className={`${serifClass} text-2xl md:text-3xl font-medium mb-2`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Lien invalide
          </h1>
          <p className="text-sm mb-6" style={{ color: p.ink2 }}>
            Ce lien de réinitialisation n&apos;est pas valide ou a expiré.
          </p>
          <Link
            href="/mot-de-passe-oublie"
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: p.ink, color: p.bg }}
          >
            Demander un nouveau lien
          </Link>
        </div>
      </section>
    )
  }

  if (success) {
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
            Mot de passe réinitialisé
          </h1>
          <p className="text-sm mb-6" style={{ color: p.ink2 }}>
            Votre mot de passe a été mis à jour avec succès.
          </p>
          <button
            onClick={() => router.push("/connexion")}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: p.ink, color: p.bg }}
          >
            Se connecter
          </button>
        </div>
      </section>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères")
      return
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas")
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(true)
      } else {
        setError(data.error || "Une erreur est survenue")
      }
    } catch {
      setError("Erreur de connexion au serveur")
    } finally {
      setIsLoading(false)
    }
  }

  const passwordChecks = {
    length: password.length >= 8,
    match: password.length > 0 && password === confirmPassword,
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
        <h1
          className={`${serifClass} text-2xl md:text-3xl font-medium mb-2`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          Nouveau mot de passe
        </h1>
        <p className="text-sm mb-6" style={{ color: p.ink2 }}>
          Choisissez un nouveau mot de passe pour votre compte.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="password"
              className="text-xs font-semibold mb-1.5 block"
              style={{ color: p.ink2 }}
            >
              Nouveau mot de passe
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                style={{ color: p.ink2 }}
              />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={8}
                className="w-full text-sm rounded-xl pl-9 pr-10 py-2.5 outline-none focus:ring-2 focus:ring-offset-1"
                style={{
                  background: p.bg2,
                  border: `1px solid ${p.line2}`,
                  color: p.ink,
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5"
                style={{ color: p.ink2 }}
                aria-label={showPassword ? "Masquer" : "Afficher"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="text-xs font-semibold mb-1.5 block"
              style={{ color: p.ink2 }}
            >
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                style={{ color: p.ink2 }}
              />
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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

          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            {[
              { ok: passwordChecks.length, label: "8 caractères minimum" },
              { ok: passwordChecks.match, label: "Les deux correspondent" },
            ].map((c, i) => (
              <li
                key={i}
                className="flex items-center gap-1.5"
                style={{ color: c.ok ? SAGE : p.ink2 }}
              >
                {c.ok ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <X className="w-3 h-3" />
                )}
                {c.label}
              </li>
            ))}
          </ul>

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
                Réinitialisation...
              </>
            ) : (
              "Réinitialiser le mot de passe"
            )}
          </button>
        </form>
      </div>
    </section>
  )
}

export default function ResetPasswordPage() {
  const p = APERCU_PALETTE
  return (
    <Suspense
      fallback={
        <div
          className="min-h-[60vh] flex items-center justify-center"
          style={{ background: p.bg }}
        >
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: p.accent }} />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
