"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import {
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  Film,
  Gamepad2,
  BookOpen,
  CheckCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function InscriptionPage() {
  // Form state
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  // Newsletter preferences
  const [newsletterWeekly, setNewsletterWeekly] = useState<boolean | null>(null)
  const [newsletterMission, setNewsletterMission] = useState<boolean | null>(null)
  const [newsletterUpdates, setNewsletterUpdates] = useState<boolean | null>(null)

  // Terms
  const [acceptTerms, setAcceptTerms] = useState(false)

  // Loading & errors
  const [isLoading, setIsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [registrationSuccess, setRegistrationSuccess] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState("")

  // Password validation
  const passwordChecks = {
    length: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  }
  const passwordValid = Object.values(passwordChecks).every(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    // Validate all required fields
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage("Le prénom et le nom sont requis")
      setIsLoading(false)
      return
    }

    if (!passwordValid) {
      setErrorMessage("Le mot de passe ne respecte pas les critères requis")
      setIsLoading(false)
      return
    }

    if (newsletterWeekly === null || newsletterMission === null || newsletterUpdates === null) {
      setErrorMessage("Veuillez répondre à toutes les questions sur les emails")
      setIsLoading(false)
      return
    }

    if (!acceptTerms) {
      setErrorMessage("Vous devez accepter les conditions d'utilisation")
      setIsLoading(false)
      return
    }

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

      // Show success message - user needs to verify email
      setRegisteredEmail(email)
      setRegistrationSuccess(true)
    } catch {
      setErrorMessage("Une erreur est survenue")
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    await signIn("google", { callbackUrl: "/chez-vous" })
  }

  // Show success screen after registration
  if (registrationSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-blue-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-4 bg-emerald-100 rounded-full w-fit">
              <CheckCircle className="h-10 w-10 text-emerald-600" />
            </div>
            <CardTitle className="text-teal-700 text-2xl">Compte créé avec succès !</CardTitle>
            <CardDescription className="text-base">
              Un email de vérification a été envoyé à <strong>{registeredEmail}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 mb-2">Prochaines étapes :</h3>
              <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
                <li>Ouvrez votre boîte de réception</li>
                <li>Cliquez sur le lien de vérification</li>
                <li>Connectez-vous à votre compte</li>
              </ol>
            </div>

            <p className="text-sm text-gray-500 text-center">
              Vous ne trouvez pas l&apos;email ? Vérifiez vos spams ou{" "}
              <Link href="/connexion" className="text-emerald-600 hover:underline">
                connectez-vous pour renvoyer le lien
              </Link>
              .
            </p>

            <Button asChild className="w-full bg-emerald-600 hover:bg-teal-700">
              <Link href="/connexion">Aller à la page de connexion</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-8 lg:py-12">
        <div className="max-w-5xl mx-auto">
          <Card className="overflow-hidden shadow-xl">
            <div className="grid lg:grid-cols-2">
              {/* Left side - Illustration & Benefits */}
              <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-8 lg:p-12 text-white flex flex-col justify-center order-2 lg:order-1">
                <div className="mb-8">
                  <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-4xl mb-6 mx-auto lg:mx-0">
                    👋
                  </div>
                  <h2 className="text-2xl lg:text-3xl font-bold mb-4 text-center lg:text-left">
                    Bienvenue !
                  </h2>
                  <p className="text-emerald-100 text-lg text-center lg:text-left">
                    Informez-vous. Inspirez-vous. Partagez vos avis. Avec un compte gratuit, sauvegardez vos critiques, ajoutez vos propres notes et bien plus.
                  </p>
                </div>

                {/* Benefits */}
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3 bg-white/10 rounded-xl p-4">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                      <Film className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-medium">Films & Séries</p>
                      <p className="text-sm text-emerald-200">Critiques détaillées par âge</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 rounded-xl p-4">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                      <Gamepad2 className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-medium">Jeux Vidéo</p>
                      <p className="text-sm text-emerald-200">Analyses des contenus sensibles</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 rounded-xl p-4">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                      <BookOpen className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-medium">Livres</p>
                      <p className="text-sm text-emerald-200">Recommandations personnalisées</p>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-emerald-200 text-center lg:text-left">
                  Déjà un compte ?{" "}
                  <Link href="/connexion" className="text-white underline hover:no-underline font-medium">
                    Se connecter
                  </Link>
                </p>
              </div>

              {/* Right side - Form */}
              <div className="p-8 lg:p-12 order-1 lg:order-2">
                <div className="mb-6">
                  <Link href="/" className="inline-flex items-center gap-2 mb-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-pink-500 text-white font-bold text-lg">
                      BA
                    </div>
                    <span className="font-semibold text-gray-900">Le Bon Avis</span>
                  </Link>
                </div>

                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
                  Créer votre compte gratuit
                </h1>
                <p className="text-gray-600 mb-6">
                  Déjà un compte ?{" "}
                  <Link href="/connexion" className="text-emerald-600 hover:underline font-medium">
                    Se connecter
                  </Link>
                </p>

                {/* Google Sign Up */}
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
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  )}
                  S&apos;inscrire avec Google
                </Button>

                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">ou par email</span>
                  </div>
                </div>

                {errorMessage && (
                  <div className="mb-6 p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                    {errorMessage}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Name fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Prénom <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="h-11"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Nom <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="h-11"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Adresse email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-11"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Mot de passe <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 h-11"
                        required
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Au moins 8 caractères avec une majuscule, une minuscule et un chiffre
                    </p>
                  </div>

                  {/* Password validation indicators */}
                  {password.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className={`flex items-center gap-1 ${passwordChecks.length ? "text-emerald-600" : "text-gray-400"}`}>
                        <Check className="h-3 w-3" /> 8 caractères min.
                      </div>
                      <div className={`flex items-center gap-1 ${passwordChecks.hasUppercase ? "text-emerald-600" : "text-gray-400"}`}>
                        <Check className="h-3 w-3" /> Une majuscule
                      </div>
                      <div className={`flex items-center gap-1 ${passwordChecks.hasLowercase ? "text-emerald-600" : "text-gray-400"}`}>
                        <Check className="h-3 w-3" /> Une minuscule
                      </div>
                      <div className={`flex items-center gap-1 ${passwordChecks.hasNumber ? "text-emerald-600" : "text-gray-400"}`}>
                        <Check className="h-3 w-3" /> Un chiffre
                      </div>
                    </div>
                  )}

                  {/* Newsletter preferences */}
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">
                        Recevoir les emails &quot;Soiree Cine en Famille&quot; chaque semaine. <span className="text-red-500">*</span>
                      </p>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="newsletterWeekly"
                            checked={newsletterWeekly === true}
                            onChange={() => setNewsletterWeekly(true)}
                            className="h-4 w-4 text-emerald-600"
                          />
                          <span className="text-sm">Oui</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="newsletterWeekly"
                            checked={newsletterWeekly === false}
                            onChange={() => setNewsletterWeekly(false)}
                            className="h-4 w-4 text-emerald-600"
                          />
                          <span className="text-sm">Non</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">
                        Recevoir des emails sur notre mission pour un numérique plus sûr pour les enfants. <span className="text-red-500">*</span>
                      </p>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="newsletterMission"
                            checked={newsletterMission === true}
                            onChange={() => setNewsletterMission(true)}
                            className="h-4 w-4 text-emerald-600"
                          />
                          <span className="text-sm">Oui</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="newsletterMission"
                            checked={newsletterMission === false}
                            onChange={() => setNewsletterMission(false)}
                            className="h-4 w-4 text-emerald-600"
                          />
                          <span className="text-sm">Non</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">
                        Recevoir des actualités et mises à jour périodiques. <span className="text-red-500">*</span>
                      </p>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="newsletterUpdates"
                            checked={newsletterUpdates === true}
                            onChange={() => setNewsletterUpdates(true)}
                            className="h-4 w-4 text-emerald-600"
                          />
                          <span className="text-sm">Oui</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="newsletterUpdates"
                            checked={newsletterUpdates === false}
                            onChange={() => setNewsletterUpdates(false)}
                            className="h-4 w-4 text-emerald-600"
                          />
                          <span className="text-sm">Non</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Terms */}
                  <div className="pt-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptTerms}
                        onChange={(e) => setAcceptTerms(e.target.checked)}
                        className="h-5 w-5 mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-600">
                        J&apos;accepte les{" "}
                        <Link href="/mentions-legales" className="text-emerald-600 hover:underline">
                          conditions d&apos;utilisation
                        </Link>{" "}
                        et la{" "}
                        <Link href="/confidentialite" className="text-emerald-600 hover:underline">
                          politique de confidentialité
                        </Link>
                        . <span className="text-red-500">*</span>
                      </span>
                    </label>
                  </div>

                  {/* Submit */}
                  <Button
                    type="submit"
                    className="w-full h-12 text-base bg-emerald-600 hover:bg-teal-700"
                    disabled={isLoading || googleLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Création en cours...
                      </>
                    ) : (
                      "Rejoindre"
                    )}
                  </Button>

                  {/* Privacy note */}
                  <p className="text-xs text-gray-500 text-center">
                    Nous respectons votre vie privée. À l&apos;exception de votre pseudo public,
                    nous ne partagerons jamais vos informations sans votre autorisation.{" "}
                    <Link href="/confidentialite" className="text-emerald-600 hover:underline">
                      En savoir plus sur notre politique de confidentialité
                    </Link>
                  </p>
                </form>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
