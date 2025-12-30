"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!token) {
      setStatus("no-token")
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

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
              <p className="text-lg text-gray-600">Vérification en cours...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === "no-token") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-amber-100 rounded-full w-fit">
              <Mail className="h-8 w-8 text-amber-600" />
            </div>
            <CardTitle>Vérification d&apos;email</CardTitle>
            <CardDescription>
              Aucun token de vérification fourni
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Si vous avez besoin de vérifier votre email, demandez un nouveau lien de vérification.
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild>
                <Link href="/connexion">Se connecter</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">Retour à l&apos;accueil</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-green-100 rounded-full w-fit">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-green-700">Email vérifié !</CardTitle>
            <CardDescription>
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Votre compte est maintenant activé. Vous pouvez vous connecter et profiter de toutes les fonctionnalités.
            </p>
            <Button onClick={() => router.push("/connexion")} className="w-full">
              Se connecter
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-red-100 rounded-full w-fit">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-red-700">Échec de la vérification</CardTitle>
          <CardDescription>
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            Le lien de vérification est peut-être expiré ou a déjà été utilisé.
          </p>
          <ResendVerificationForm />
          <Button variant="outline" asChild className="w-full">
            <Link href="/">Retour à l&apos;accueil</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function ResendVerificationForm() {
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
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-green-700 text-sm">
          Si un compte existe avec cet email, un nouveau lien de vérification a été envoyé.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleResend} className="space-y-3">
      <p className="text-sm text-gray-500">Entrez votre email pour recevoir un nouveau lien :</p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="votre@email.com"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={sending} className="w-full">
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Envoi...
          </>
        ) : (
          "Renvoyer le lien"
        )}
      </Button>
    </form>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                <p className="text-lg text-gray-600">Chargement...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}
