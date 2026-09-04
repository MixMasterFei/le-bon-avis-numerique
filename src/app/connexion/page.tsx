"use client"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Heart,
  Star,
  Users,
} from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

/**
 * Restrict the post-login redirect to internal paths only. Anyone can
 * land on /connexion?callbackUrl=https://evil.com and be redirected
 * after a successful sign-in (open redirect → phishing pivot). We
 * accept only paths starting with a single "/", and reject:
 *   - protocol-relative URLs ("//evil.com" → host-swapped)
 *   - back-slash escape ("/\\evil.com" → some browsers normalize)
 *   - absolute URLs ("https://…")
 *   - "javascript:" / "data:" / any non-path string
 * On rejection we fall back to /profil (the default landing).
 * NOTE: at Coin Famille public launch, switch this default to /coin-famille
 * (see COIN_FAMILLE_PUBLIC in src/lib/coin-famille-flag.ts).
 */
function safeCallback(raw: string | null): string {
  if (!raw) return "/profil"
  if (raw[0] !== "/" || raw[1] === "/" || raw[1] === "\\") return "/profil"
  return raw
}

const OAUTH_ERRORS: Record<string, string> = {
  CredentialsSignin: "Email ou mot de passe incorrect",
  OAuthAccountNotLinked:
    "Connectez-vous d’abord avec la méthode déjà utilisée pour ce compte afin d’associer Google.",
  OAuthCallbackError:
    "Erreur lors de la connexion avec Google. Veuillez réessayer.",
  OAuthSignin: "Erreur lors de l'initialisation de la connexion Google",
  Default: "Une erreur est survenue lors de la connexion",
}

function ConnexionForm() {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const router = useRouter()
  const searchParams = useSearchParams()
  // Accept the legacy `?next=` param too — older redirect call-sites
  // (apercudecouverte-v3, /apercudecouverte/*) still emit it. Reading
  // both keeps existing links working while we standardize on
  // callbackUrl. Validation below covers either source.
  const callbackUrl = safeCallback(
    searchParams.get("callbackUrl") ?? searchParams.get("next"),
  )
  const error = searchParams.get("error")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [resendingVerification, setResendingVerification] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const [emailNotVerified, setEmailNotVerified] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(
    error ? OAUTH_ERRORS[error] || OAUTH_ERRORS.Default : null
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)
    setEmailNotVerified(false)
    setVerificationSent(false)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        if (result.error.includes("EMAIL_NOT_VERIFIED")) {
          setEmailNotVerified(true)
          setErrorMessage("Votre email n'est pas encore vérifié")
        } else {
          setErrorMessage("Email ou mot de passe incorrect")
        }
      } else {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      setErrorMessage("Une erreur est survenue")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!email) {
      setErrorMessage(
        "Entrez votre email pour renvoyer le lien de vérification"
      )
      return
    }
    setResendingVerification(true)
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setVerificationSent(true)
        setErrorMessage(null)
      } else {
        const data = await res.json()
        setErrorMessage(data.error || "Erreur lors de l'envoi")
      }
    } catch {
      setErrorMessage("Erreur de connexion")
    } finally {
      setResendingVerification(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    await signIn("google", { callbackUrl })
  }

  return (
    <section
      className="flex-1 container mx-auto px-4 md:px-8 py-10 md:py-16"
      style={{ background: p.bg, color: p.ink }}
    >
      <div className="grid lg:grid-cols-[1fr_1.05fr] gap-10 lg:gap-16 items-start max-w-5xl mx-auto">
        {/* Left: form */}
        <div
          className="rounded-3xl p-6 md:p-8 order-2 lg:order-1"
          style={{ background: p.card, border: `1px solid ${p.line}` }}
        >
          <h1
            className={`${serifClass} text-2xl md:text-3xl font-medium mb-1`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Se connecter
          </h1>
          <p className="text-sm mb-6" style={{ color: p.ink2 }}>
            Retrouvez vos favoris et recommandations.
          </p>

          {verificationSent && (
            <div
              className="rounded-xl px-3.5 py-2.5 mb-4 text-sm"
              style={{
                background: "rgba(92, 138, 92, 0.12)",
                border: `1px solid ${p.accent2}`,
                color: p.ink,
              }}
            >
              Un nouveau lien de vérification a été envoyé à votre adresse
              email.
            </div>
          )}

          {emailNotVerified && !verificationSent && (
            <div
              className="rounded-xl px-3.5 py-3 mb-4"
              style={{
                background: "rgba(209, 106, 74, 0.08)",
                border: `1px solid ${p.accent}`,
              }}
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle
                  className="h-4 w-4 flex-shrink-0 mt-0.5"
                  style={{ color: p.accent }}
                />
                <div className="flex-1">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: p.ink }}
                  >
                    Email non vérifié
                  </p>
                  <p className="text-xs mt-1" style={{ color: p.ink2 }}>
                    Vous devez vérifier votre email avant de vous connecter.
                  </p>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendingVerification}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-50"
                    style={{
                      background: "transparent",
                      color: p.ink,
                      border: `1px solid ${p.line2}`,
                    }}
                  >
                    {resendingVerification ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Envoi...
                      </>
                    ) : (
                      "Renvoyer le lien"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {errorMessage && !emailNotVerified && (
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

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading || googleLoading}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 mb-4"
            style={{
              background: p.bg2,
              color: p.ink,
              border: `1px solid ${p.line2}`,
            }}
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <GoogleG />
            )}
            Continuer avec Google
          </button>

          <div className="relative my-4">
            <div
              className="absolute inset-0 flex items-center"
              aria-hidden="true"
            >
              <div
                className="w-full"
                style={{ borderTop: `1px solid ${p.line}` }}
              />
            </div>
            <div className="relative flex justify-center">
              <span
                className="px-3 text-xs"
                style={{ background: p.card, color: p.ink2 }}
              >
                ou par email
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="email"
                className="text-xs font-semibold mb-1.5 block"
                style={{ color: p.ink2 }}
              >
                Email
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
                  disabled={isLoading || googleLoading}
                  className="w-full text-sm rounded-xl pl-9 pr-3.5 py-2.5 outline-none focus:ring-2 focus:ring-offset-1"
                  style={{
                    background: p.bg2,
                    border: `1px solid ${p.line2}`,
                    color: p.ink,
                  }}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-xs font-semibold mb-1.5 block"
                style={{ color: p.ink2 }}
              >
                Mot de passe
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
                  disabled={isLoading || googleLoading}
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
              <Link
                href="/mot-de-passe-oublie"
                className="inline-block mt-2 text-xs hover:opacity-70"
                style={{ color: p.accent }}
              >
                Mot de passe oublié ?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading || googleLoading}
              className="mt-2 inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: p.ink, color: p.bg }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connexion...
                </>
              ) : (
                "Se connecter"
              )}
            </button>

            <p
              className="text-xs text-center mt-3"
              style={{ color: p.ink2 }}
            >
              Pas encore de compte ?{" "}
              <Link
                href={`/inscription?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                className="underline font-semibold"
                style={{ color: p.ink }}
              >
                S&apos;inscrire
              </Link>
            </p>
          </form>
        </div>

        {/* Right: CTA */}
        <div className="lg:pt-4 order-1 lg:order-2">
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
            Rejoignez la communauté
          </div>

          <h2
            className={`${serifClass} text-3xl md:text-5xl font-medium leading-[1.05]`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Votre famille,{" "}
            <em className="italic" style={{ color: p.accent }}>
              mieux conseillée
            </em>
            .
          </h2>

          <p
            className="mt-6 text-base md:text-lg leading-relaxed max-w-md"
            style={{ color: p.ink2 }}
          >
            Créez votre compte pour sauvegarder vos favoris, suivre les
            réactions des enfants, et recevoir des recommandations adaptées à
            chaque membre du foyer.
          </p>

          <ul className="mt-8 space-y-3 max-w-md">
            {[
              {
                icon: <Heart className="w-4 h-4" />,
                text: "Sauvegardez vos favoris",
              },
              {
                icon: <Star className="w-4 h-4" />,
                text: "Partagez vos avis",
              },
              {
                icon: <Users className="w-4 h-4" />,
                text: "Suivez les réactions des enfants",
              },
            ].map((it, i) => (
              <li key={i} className="flex items-center gap-3">
                <span
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0"
                  style={{ background: p.bg2, color: p.accent2 }}
                >
                  {it.icon}
                </span>
                <span className="text-sm" style={{ color: p.ink }}>
                  {it.text}
                </span>
              </li>
            ))}
          </ul>

          <Link
            href={`/inscription?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="inline-flex items-center justify-center gap-2 mt-8 px-5 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: p.ink, color: p.bg }}
          >
            Créer un compte gratuit
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export default function ConnexionPage() {
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
      <ConnexionForm />
    </Suspense>
  )
}
