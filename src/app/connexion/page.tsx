"use client"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowRight, Heart, Star, Users, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

function ConnexionForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/chez-vous"
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
    error === "CredentialsSignin" ? "Email ou mot de passe incorrect" : null
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
        // Check if the error is about email not verified
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
      setErrorMessage("Entrez votre email pour renvoyer le lien de vérification")
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-8 lg:py-12">
        <div className="max-w-5xl mx-auto">
          <Card className="overflow-hidden shadow-xl">
            <div className="grid lg:grid-cols-2">
              {/* Left side - Login Form */}
              <div className="p-8 lg:p-12">
                <div className="mb-8">
                  <Link href="/" className="inline-flex items-center gap-2 mb-6">
                    <Image src="/logo-icon.png" alt="Totem Avisé" width={36} height={36} />
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg uppercase tracking-tight text-gray-900" style={{ fontFamily: "var(--font-anton)" }}>Totem</span>
                      <span className="text-xl uppercase text-gray-900" style={{ fontFamily: "var(--font-edunline)" }}>Avisé</span>
                    </div>
                  </Link>
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
                    Connexion
                  </h1>
                  <p className="text-gray-600">
                    Connectez-vous pour accéder à vos favoris et recommandations
                  </p>
                </div>

                {verificationSent && (
                  <div className="mb-6 p-4 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p>Un nouveau lien de vérification a été envoyé à votre adresse email.</p>
                    <p className="text-xs mt-1 text-emerald-500">Vérifiez également vos spams.</p>
                  </div>
                )}

                {emailNotVerified && !verificationSent && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-amber-800 font-medium">Email non vérifié</p>
                        <p className="text-sm text-amber-600 mt-1">
                          Vous devez vérifier votre email avant de pouvoir vous connecter.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-100"
                          onClick={handleResendVerification}
                          disabled={resendingVerification}
                        >
                          {resendingVerification ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                              Envoi...
                            </>
                          ) : (
                            "Renvoyer le lien de vérification"
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {errorMessage && !emailNotVerified && (
                  <div className="mb-6 p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                    {errorMessage}
                  </div>
                )}

                {/* Google Sign In - Primary option */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 text-base mb-6 border-2 hover:bg-gray-50"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || googleLoading}
                >
                  {googleLoading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
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
                  )}
                  Continuer avec Google
                </Button>

                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">ou par email</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium text-gray-700">
                      Email ou nom d&apos;utilisateur <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="vous@exemple.fr"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-11"
                        required
                        disabled={isLoading || googleLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium text-gray-700">
                      Mot de passe <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 h-11"
                        required
                        disabled={isLoading || googleLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Link href="/mot-de-passe-oublie" className="text-sm text-emerald-600 hover:underline">
                      Mot de passe oublié ?
                    </Link>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-base bg-emerald-600 hover:bg-teal-700"
                    disabled={isLoading || googleLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Connexion...
                      </>
                    ) : (
                      "Se connecter"
                    )}
                  </Button>
                </form>
              </div>

              {/* Right side - CTA to Register */}
              <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-8 lg:p-12 text-white flex flex-col justify-center">
                <h2 className="text-2xl lg:text-3xl font-bold mb-4">
                  Devenez Membre
                </h2>
                <p className="text-emerald-100 mb-8 text-lg">
                  Accès illimité aux critiques d&apos;experts, recommandations personnalisées par âge et bien plus encore !
                </p>

                {/* Feature illustration */}
                <div className="relative mb-8">
                  <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl">
                        👨‍👩‍👧‍👦
                      </div>
                      <div>
                        <p className="font-semibold text-lg">Famille Martin</p>
                        <p className="text-emerald-200 text-sm">3 enfants - 4, 8 et 12 ans</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Heart className="h-4 w-4 text-red-300" />
                        <span>42 favoris sauvegardés</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Star className="h-4 w-4 text-yellow-300" />
                        <span>12 avis partagés</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-blue-300" />
                        <span>Réactions des enfants suivies</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-8">
                  <p className="text-sm text-emerald-100">
                    Nous respectons votre vie privée.
                  </p>
                  <Link href="/confidentialite" className="text-sm text-white underline hover:no-underline">
                    Voir notre politique de confidentialité
                  </Link>
                </div>

                <Link href="/inscription">
                  <Button
                    variant="outline"
                    className="w-full h-12 text-base border-2 border-white text-white bg-transparent hover:bg-white hover:text-teal-700"
                  >
                    Créer un compte
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function ConnexionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <ConnexionForm />
    </Suspense>
  )
}
