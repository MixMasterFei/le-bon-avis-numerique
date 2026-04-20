"use client"

import { useState } from "react"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { Eye, EyeOff, Check, X, ArrowRight, Loader2 } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"

const SAGE = "#5C8A5C"

export function ApercuInscription({ serifClass }: { serifClass: string }) {
  const p = APERCU_PALETTE
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [newsletterWeekly, setNewsletterWeekly] = useState<boolean | null>(null)
  const [newsletterMission, setNewsletterMission] = useState<boolean | null>(null)
  const [newsletterUpdates, setNewsletterUpdates] = useState<boolean | null>(null)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
  }
  const passwordValid = Object.values(passwordChecks).every(Boolean)

  const formValid =
    firstName.trim() &&
    lastName.trim() &&
    email.includes("@") &&
    passwordValid &&
    newsletterWeekly !== null &&
    newsletterMission !== null &&
    newsletterUpdates !== null &&
    acceptTerms

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formValid || isLoading) return
    setErrorMessage(null)
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${firstName} ${lastName}`.trim(),
          email,
          password,
          preferences: {
            newsletterWeekly,
            newsletterMission,
            newsletterUpdates,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrorMessage(data.error || "Erreur lors de l'inscription")
        setIsLoading(false)
        return
      }

      setRegisteredEmail(email)
      setSubmitted(true)
    } catch {
      setErrorMessage("Une erreur est survenue")
      setIsLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    await signIn("google", { callbackUrl: "/profil" })
  }

  return (
    <div
      className="flex flex-col flex-1"
      style={{ background: p.bg, color: p.ink }}
    >
      {submitted ? (
        <SuccessScreen
          email={registeredEmail}
          firstName={firstName}
          serifClass={serifClass}
        />
      ) : (
        <section className="container mx-auto px-4 md:px-8 py-10 md:py-16">
          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-16 items-start">
            {/* Left: editorial intro */}
            <div className="lg:pt-4">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-7"
                style={{
                  background: p.bg2,
                  border: `1px solid ${p.line}`,
                  color: p.ink,
                }}
              >
                <span
                  className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] text-white"
                  style={{ background: p.accent2 }}
                >
                  ✦
                </span>
                Recherche indépendante · pensée pour les familles
              </div>

              <h1
                className={`${serifClass} text-3xl md:text-5xl font-medium leading-[1.05]`}
                style={{ color: p.ink, letterSpacing: "-0.02em" }}
              >
                Rejoignez les{" "}
                <em className="italic" style={{ color: p.accent }}>
                  familles
                </em>{" "}
                qui choisissent{" "}
                <em className="italic" style={{ color: p.accent2 }}>
                  en confiance
                </em>
                .
              </h1>

              <p
                className="mt-6 text-base md:text-lg leading-relaxed max-w-md"
                style={{ color: p.ink2 }}
              >
                Créez votre compte en moins d&apos;une minute pour personnaliser
                Totem Avisé selon votre foyer.
              </p>

              <ul className="mt-8 space-y-4 max-w-md">
                {[
                  { stat: "9 600 œuvres", body: "analysées sur 7 critères familiaux" },
                  { stat: "Recommandations", body: "adaptées à chaque membre du foyer" },
                  { stat: "Indépendant", body: "pensé pour les familles, pas pour un algorithme" },
                ].map((it, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="inline-flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 text-[11px] mt-0.5"
                      style={{ background: p.accent2, color: "#fff" }}
                    >
                      ✦
                    </span>
                    <div>
                      <span
                        className={`${serifClass} text-base`}
                        style={{ color: p.ink, fontWeight: 600 }}
                      >
                        {it.stat}
                      </span>
                      <span className="text-sm ml-1.5" style={{ color: p.ink2 }}>
                        — {it.body}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: form */}
            <div
              className="rounded-3xl p-6 md:p-8"
              style={{ background: p.card, border: `1px solid ${p.line}` }}
            >
              <h2
                className={`${serifClass} text-2xl md:text-3xl font-medium mb-1`}
                style={{ color: p.ink, letterSpacing: "-0.02em" }}
              >
                Créer mon compte
              </h2>
              <p className="text-sm mb-6" style={{ color: p.ink2 }}>
                Vos données restent privées et ne sont jamais revendues.
              </p>

              {errorMessage && (
                <div
                  className="rounded-xl px-3.5 py-2.5 mb-4 text-sm"
                  style={{
                    background: "rgba(209, 106, 74, 0.12)",
                    border: `1px solid ${p.accent}`,
                    color: p.ink,
                  }}
                  role="alert"
                >
                  {errorMessage}
                </div>
              )}

              <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Prénom" value={firstName} onChange={setFirstName} placeholder="Léa" />
                  <Field label="Nom" value={lastName} onChange={setLastName} placeholder="Dupont" />
                </div>

                <Field
                  label="Adresse email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="lea.dupont@example.fr"
                />

                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: p.ink2 }}>
                    Mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-sm rounded-xl px-3.5 py-2.5 pr-10 outline-none focus:ring-2 focus:ring-offset-1"
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
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2.5 text-[11px]">
                    {[
                      { ok: passwordChecks.length, label: "8 caractères minimum" },
                      { ok: passwordChecks.upper, label: "Une majuscule" },
                      { ok: passwordChecks.lower, label: "Une minuscule" },
                      { ok: passwordChecks.digit, label: "Un chiffre" },
                    ].map((c, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-1.5"
                        style={{ color: c.ok ? SAGE : p.ink2 }}
                      >
                        {c.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {c.label}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-1">
                  <div className="text-xs font-semibold mb-2" style={{ color: p.ink2 }}>
                    Préférences de communication
                  </div>
                  <div className="flex flex-col gap-2">
                    <YesNoRow
                      label="Newsletter hebdomadaire (sélection famille)"
                      value={newsletterWeekly}
                      onChange={setNewsletterWeekly}
                    />
                    <YesNoRow
                      label="Mission éditoriale (1 fois par mois)"
                      value={newsletterMission}
                      onChange={setNewsletterMission}
                    />
                    <YesNoRow
                      label="Nouveautés et améliorations du site"
                      value={newsletterUpdates}
                      onChange={setNewsletterUpdates}
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2.5 text-sm cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-[#1E1A15]"
                  />
                  <span style={{ color: p.ink2 }}>
                    J&apos;accepte les{" "}
                    <Link href="/mentions-legales" className="underline" style={{ color: p.ink }}>
                      conditions d&apos;utilisation
                    </Link>{" "}
                    et la{" "}
                    <Link href="/confidentialite" className="underline" style={{ color: p.ink }}>
                      politique de confidentialité
                    </Link>
                    .
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={!formValid || isLoading}
                  className="mt-2 inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: p.ink, color: p.bg }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Création du compte...
                    </>
                  ) : (
                    <>
                      Créer mon compte
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="relative my-2">
                  <div
                    className="absolute inset-0 flex items-center"
                    aria-hidden="true"
                  >
                    <div className="w-full" style={{ borderTop: `1px solid ${p.line}` }} />
                  </div>
                  <div className="relative flex justify-center">
                    <span
                      className="px-3 text-xs"
                      style={{ background: p.card, color: p.ink2 }}
                    >
                      ou
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: p.bg2, color: p.ink, border: `1px solid ${p.line2}` }}
                >
                  {googleLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <GoogleG />
                  )}
                  Continuer avec Google
                </button>

                <p className="text-xs text-center mt-3" style={{ color: p.ink2 }}>
                  Déjà inscrit ?{" "}
                  <Link href="/connexion" className="underline font-semibold" style={{ color: p.ink }}>
                    Se connecter
                  </Link>
                </p>
              </form>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const p = APERCU_PALETTE
  return (
    <div>
      <label className="text-xs font-semibold mb-1.5 block" style={{ color: p.ink2 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-offset-1"
        style={{ background: p.bg2, border: `1px solid ${p.line2}`, color: p.ink }}
      />
    </div>
  )
}

function YesNoRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | null
  onChange: (v: boolean) => void
}) {
  const p = APERCU_PALETTE
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm flex-1" style={{ color: p.ink }}>
        {label}
      </span>
      <div className="flex gap-1.5 flex-shrink-0">
        {[
          { val: true, label: "Oui" },
          { val: false, label: "Non" },
        ].map((opt) => {
          const active = value === opt.val
          return (
            <button
              key={String(opt.val)}
              type="button"
              onClick={() => onChange(opt.val)}
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                background: active ? p.ink : "transparent",
                color: active ? p.bg : p.ink2,
                border: `1px solid ${active ? p.ink : p.line2}`,
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SuccessScreen({
  email,
  firstName,
  serifClass,
}: {
  email: string
  firstName: string
  serifClass: string
}) {
  const p = APERCU_PALETTE
  return (
    <section className="container mx-auto px-4 md:px-8 py-16 md:py-24 max-w-2xl">
      <div
        className="rounded-3xl p-8 md:p-12 text-center"
        style={{ background: p.card, border: `1px solid ${p.line}` }}
      >
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
          style={{ background: SAGE, color: "#fff" }}
        >
          <Check className="w-8 h-8" />
        </div>
        <h1
          className={`${serifClass} text-3xl md:text-4xl font-medium mb-3`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          Bienvenue {firstName} !
        </h1>
        <p className="text-base mb-8 max-w-md mx-auto" style={{ color: p.ink2 }}>
          Votre compte est créé. Un email de vérification a été envoyé à{" "}
          <strong style={{ color: p.ink }}>{email}</strong>. Cliquez sur le lien
          pour activer votre compte.
        </p>
        <div
          className="rounded-2xl p-5 text-left mb-8"
          style={{ background: p.bg2, border: `1px solid ${p.line}` }}
        >
          <div
            className="text-[11px] font-semibold uppercase tracking-wide mb-2"
            style={{ color: p.accent }}
          >
            Prochaines étapes
          </div>
          <ol
            className="text-sm space-y-1.5 list-decimal pl-5"
            style={{ color: p.ink }}
          >
            <li>Vérifiez votre boîte mail (et le dossier indésirables)</li>
            <li>Cliquez sur le lien de confirmation</li>
            <li>Connectez-vous et créez votre foyer</li>
          </ol>
        </div>
        <Link
          href="/connexion"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold"
          style={{ background: p.ink, color: p.bg }}
        >
          Se connecter
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  )
}

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}
