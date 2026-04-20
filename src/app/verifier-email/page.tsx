"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Check, X, Loader2, Mail } from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

const SAGE = "#5C8A5C"

type Status = "loading" | "success" | "error" | "no-token"

function VerifyEmailContent() {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  const [status, setStatus] = useState<Status>("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!token) {
      queueMicrotask(() => setStatus("no-token"))
      return
    }
    async function verifyEmail() {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })
        const data = await res.json()
        if (res.ok) {
          setStatus("success")
          setMessage(data.message)
        } else {
          setStatus("error")
          setMessage(data.error || "Une erreur est survenue")
        }
      } catch {
        setStatus("error")
        setMessage("Erreur de connexion au serveur")
      }
    }
    verifyEmail()
  }, [token])

  const wrapper = (children: React.ReactNode) => (
    <section
      className="flex-1 flex items-center justify-center py-12 px-4"
      style={{ background: p.bg, color: p.ink }}
    >
      <div
        className="w-full max-w-md rounded-3xl p-6 md:p-8 text-center"
        style={{ background: p.card, border: `1px solid ${p.line}` }}
      >
        {children}
      </div>
    </section>
  )

  if (status === "loading") {
    return wrapper(
      <div className="flex flex-col items-center gap-4 py-6">
        <Loader2
          className="h-10 w-10 animate-spin"
          style={{ color: p.accent }}
        />
        <p className="text-base" style={{ color: p.ink2 }}>
          Vérification en cours...
        </p>
      </div>
    )
  }

  if (status === "no-token") {
    return wrapper(
      <>
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5"
          style={{ background: p.bg2, color: p.accent }}
        >
          <Mail className="h-6 w-6" />
        </div>
        <h1
          className={`${serifClass} text-2xl md:text-3xl font-medium mb-2`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          Vérification d&apos;email
        </h1>
        <p className="text-sm mb-6" style={{ color: p.ink2 }}>
          Aucun token de vérification fourni. Connectez-vous pour demander un
          nouveau lien.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/connexion"
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: p.ink, color: p.bg }}
          >
            Se connecter
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
            style={{
              background: "transparent",
              color: p.ink,
              border: `1px solid ${p.line2}`,
            }}
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </>
    )
  }

  if (status === "success") {
    return wrapper(
      <>
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
          Email vérifié !
        </h1>
        <p className="text-sm mb-6" style={{ color: p.ink2 }}>
          {message ||
            "Votre compte est activé. Vous pouvez maintenant vous connecter."}
        </p>
        <button
          onClick={() => router.push("/connexion")}
          className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: p.ink, color: p.bg }}
        >
          Se connecter
        </button>
      </>
    )
  }

  return wrapper(
    <>
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
        Échec de la vérification
      </h1>
      <p className="text-sm mb-2" style={{ color: p.ink2 }}>
        {message}
      </p>
      <p className="text-xs mb-6" style={{ color: p.ink2 }}>
        Le lien est peut-être expiré ou a déjà été utilisé.
      </p>
      <ResendVerificationForm />
      <Link
        href="/"
        className="mt-4 inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
        style={{
          background: "transparent",
          color: p.ink,
          border: `1px solid ${p.line2}`,
        }}
      >
        Retour à l&apos;accueil
      </Link>
    </>
  )
}

function ResendVerificationForm() {
  const p = APERCU_PALETTE
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setSending(true)
    setError("")
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok) {
        setSent(true)
      } else {
        setError(data.error || "Erreur lors de l'envoi")
      }
    } catch {
      setError("Erreur de connexion")
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div
        className="rounded-xl px-3.5 py-2.5 text-sm mt-2"
        style={{
          background: "rgba(92, 138, 92, 0.12)",
          border: `1px solid ${SAGE}`,
          color: p.ink,
        }}
      >
        Si un compte existe avec cet email, un nouveau lien de vérification a
        été envoyé.
      </div>
    )
  }

  return (
    <form onSubmit={handleResend} className="flex flex-col gap-2 mt-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="votre@email.com"
        className="w-full text-sm rounded-xl px-3.5 py-2.5 outline-none"
        style={{
          background: p.bg2,
          border: `1px solid ${p.line2}`,
          color: p.ink,
        }}
        required
      />
      {error && (
        <p className="text-xs" style={{ color: p.accent }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: p.ink, color: p.bg }}
      >
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Envoi...
          </>
        ) : (
          "Renvoyer le lien"
        )}
      </button>
    </form>
  )
}

export default function VerifyEmailPage() {
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
      <VerifyEmailContent />
    </Suspense>
  )
}
