"use client"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Loader2, Mail, Lock, Eye, EyeOff, Shield, ArrowRight, Heart, Star, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

function ConnexionForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/"
  const error = searchParams.get("error")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isAdminLogin, setIsAdminLogin] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(
    error === "CredentialsSignin" ? "Email ou mot de passe incorrect" : null
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setErrorMessage("Email ou mot de passe incorrect")
      } else {
        const redirectUrl = isAdminLogin ? "/admin" : callbackUrl
        router.push(redirectUrl)
        router.refresh()
      }
    } catch {
      setErrorMessage("Une erreur est survenue")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    await signIn("google", { callbackUrl })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-8 lg:py-12">
        <div className="max-w-5xl mx-auto">
          <Card className="overflow-hidden shadow-xl">
            <div className="grid lg:grid-cols-2">
              {/* Left side - Login Form */}
              <div className="p-8 lg:p-12">
                <div className="mb-8">
                  <Link href="/" className="inline-flex items-center gap-2 mb-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-600 to-green-700 text-white font-bold text-lg">
                      BS
                    </div>
                    <span className="font-semibold text-gray-900">Le Bon Sens</span>
                  </Link>
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
                    Connexion
                  </h1>
                  <p className="text-gray-600">
                    Connectez-vous pour acceder a vos favoris et recommandations
                  </p>
                </div>

                {errorMessage && (
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
                    <Link href="/mot-de-passe-oublie" className="text-sm text-green-600 hover:underline">
                      Mot de passe oublie ?
                    </Link>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="adminLogin"
                      checked={isAdminLogin}
                      onChange={(e) => setIsAdminLogin(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      disabled={isLoading || googleLoading}
                    />
                    <label htmlFor="adminLogin" className="flex items-center text-sm text-gray-600 cursor-pointer">
                      <Shield className="h-4 w-4 mr-1 text-amber-600" />
                      Connexion administrateur
                    </label>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-base bg-green-600 hover:bg-green-700"
                    disabled={isLoading || googleLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Connexion...
                      </>
                    ) : isAdminLogin ? (
                      <>
                        <Shield className="mr-2 h-5 w-5" />
                        Connexion Admin
                      </>
                    ) : (
                      "Se connecter"
                    )}
                  </Button>
                </form>
              </div>

              {/* Right side - CTA to Register */}
              <div className="bg-gradient-to-br from-green-600 to-green-700 p-8 lg:p-12 text-white flex flex-col justify-center">
                <h2 className="text-2xl lg:text-3xl font-bold mb-4">
                  Devenez Membre
                </h2>
                <p className="text-green-100 mb-8 text-lg">
                  Acces illimite aux critiques d&apos;experts, recommandations personnalisees par age et bien plus encore !
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
                        <p className="text-green-200 text-sm">3 enfants - 4, 8 et 12 ans</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Heart className="h-4 w-4 text-red-300" />
                        <span>42 favoris sauvegardes</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Star className="h-4 w-4 text-yellow-300" />
                        <span>12 avis partages</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-blue-300" />
                        <span>Reactions des enfants suivies</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-8">
                  <p className="text-sm text-green-100">
                    Nous respectons votre vie privee.
                  </p>
                  <Link href="/confidentialite" className="text-sm text-white underline hover:no-underline">
                    Voir notre politique de confidentialite
                  </Link>
                </div>

                <Link href="/inscription">
                  <Button
                    variant="outline"
                    className="w-full h-12 text-base border-2 border-white text-white bg-transparent hover:bg-white hover:text-green-700"
                  >
                    Creer un compte
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
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      }
    >
      <ConnexionForm />
    </Suspense>
  )
}
