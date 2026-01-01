"use client"

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { useState, useEffect } from "react"
import {
  ArrowLeft,
  Shield,
  Heart,
  Tv,
  Loader2,
  Check,
  AlertCircle,
  Skull,
  Ghost,
  MessageCircle,
  Wine,
  Sparkles,
  Users,
  GraduationCap,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SensitivitySlider } from "@/components/ui/SensitivitySlider"
import { TopicAvoider } from "@/components/ui/TopicAvoider"
import Link from "next/link"

interface FamilySettings {
  id: string
  defaultSensitivityViolence: number
  defaultSensitivityScary: number
  defaultSensitivitySexual: number
  defaultSensitivityLanguage: number
  defaultSensitivitySubstances: number
  defaultPreferPositiveMessages: number
  defaultPreferRoleModels: number
  defaultPreferEducational: number
  blockedTopics: string[]
  availablePlatforms: string[]
}

const PLATFORMS = [
  { id: "Netflix", label: "Netflix", color: "bg-red-500" },
  { id: "Disney+", label: "Disney+", color: "bg-blue-600" },
  { id: "Prime Video", label: "Prime Video", color: "bg-sky-500" },
  { id: "Canal+", label: "Canal+", color: "bg-gray-800" },
  { id: "France TV", label: "France TV", color: "bg-blue-500" },
  { id: "Apple TV+", label: "Apple TV+", color: "bg-gray-500" },
  { id: "OCS", label: "OCS", color: "bg-orange-500" },
  { id: "Paramount+", label: "Paramount+", color: "bg-blue-700" },
]

export default function FamilySettingsPage() {
  const { data: session, status } = useSession()
  const [settings, setSettings] = useState<FamilySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/user/family-settings")
        if (res.ok) {
          const data = await res.json()
          setSettings(data.familySettings)
        } else {
          setError("Erreur lors du chargement des parametres")
        }
      } catch {
        setError("Erreur de connexion")
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchSettings()
    }
  }, [session])

  const handleSave = async () => {
    if (!settings) return

    setSaving(true)
    setSaved(false)
    setError(null)

    try {
      const res = await fetch("/api/user/family-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError("Erreur lors de la sauvegarde")
      }
    } catch {
      setError("Erreur de connexion")
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = <K extends keyof FamilySettings>(key: K, value: FamilySettings[K]) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
  }

  const togglePlatform = (platform: string) => {
    if (!settings) return
    const platforms = settings.availablePlatforms.includes(platform)
      ? settings.availablePlatforms.filter(p => p !== platform)
      : [...settings.availablePlatforms, platform]
    updateSetting("availablePlatforms", platforms)
  }

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!session?.user) {
    redirect("/connexion")
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/profil">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Parametres de la famille</h1>
          <p className="text-gray-600">
            Definissez les preferences par defaut pour tous les membres
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {settings && (
        <div className="space-y-6">
          {/* Sensitivity Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Tolerance au contenu
              </CardTitle>
              <CardDescription>
                Ces parametres s&apos;appliquent par defaut a tous les membres de votre famille.
                Chaque membre peut personnaliser ses propres preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SensitivitySlider
                label="Violence"
                icon={<Skull className="h-4 w-4" />}
                value={settings.defaultSensitivityViolence}
                onChange={(v) => updateSetting("defaultSensitivityViolence", v)}
                type="sensitivity"
              />

              <SensitivitySlider
                label="Contenu effrayant"
                icon={<Ghost className="h-4 w-4" />}
                value={settings.defaultSensitivityScary}
                onChange={(v) => updateSetting("defaultSensitivityScary", v)}
                type="sensitivity"
              />

              <SensitivitySlider
                label="Contenu sexuel / Nudite"
                icon={<Heart className="h-4 w-4" />}
                value={settings.defaultSensitivitySexual}
                onChange={(v) => updateSetting("defaultSensitivitySexual", v)}
                type="sensitivity"
              />

              <SensitivitySlider
                label="Langage grossier"
                icon={<MessageCircle className="h-4 w-4" />}
                value={settings.defaultSensitivityLanguage}
                onChange={(v) => updateSetting("defaultSensitivityLanguage", v)}
                type="sensitivity"
              />

              <SensitivitySlider
                label="Drogues / Alcool"
                icon={<Wine className="h-4 w-4" />}
                value={settings.defaultSensitivitySubstances}
                onChange={(v) => updateSetting("defaultSensitivitySubstances", v)}
                type="sensitivity"
              />
            </CardContent>
          </Card>

          {/* Positive Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Contenu prefere
              </CardTitle>
              <CardDescription>
                Indiquez l&apos;importance que vous accordez a ces elements positifs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SensitivitySlider
                label="Messages positifs"
                icon={<Sparkles className="h-4 w-4" />}
                value={settings.defaultPreferPositiveMessages}
                onChange={(v) => updateSetting("defaultPreferPositiveMessages", v)}
                type="preference"
              />

              <SensitivitySlider
                label="Modeles de comportement"
                icon={<Users className="h-4 w-4" />}
                value={settings.defaultPreferRoleModels}
                onChange={(v) => updateSetting("defaultPreferRoleModels", v)}
                type="preference"
              />

              <SensitivitySlider
                label="Contenu educatif"
                icon={<GraduationCap className="h-4 w-4" />}
                value={settings.defaultPreferEducational}
                onChange={(v) => updateSetting("defaultPreferEducational", v)}
                type="preference"
              />
            </CardContent>
          </Card>

          {/* Blocked Topics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Themes a eviter
              </CardTitle>
              <CardDescription>
                Ces themes seront exclus des recommandations pour toute la famille
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TopicAvoider
                topics={settings.blockedTopics}
                onChange={(topics) => updateSetting("blockedTopics", topics)}
              />
            </CardContent>
          </Card>

          {/* Streaming Platforms */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tv className="h-5 w-5 text-blue-500" />
                Plateformes disponibles
              </CardTitle>
              <CardDescription>
                Selectionnez les services de streaming auxquels vous etes abonnes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PLATFORMS.map((platform) => {
                  const isSelected = settings.availablePlatforms.includes(platform.id)
                  return (
                    <button
                      key={platform.id}
                      onClick={() => togglePlatform(platform.id)}
                      className={`
                        p-3 rounded-lg border-2 transition-all text-sm font-medium
                        ${isSelected
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${platform.color}`} />
                        {platform.label}
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Les recommandations privilegieront les contenus disponibles sur vos plateformes
              </p>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="sticky bottom-4 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              size="lg"
              className="shadow-lg"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : saved ? (
                <Check className="h-4 w-4 mr-2" />
              ) : null}
              {saved ? "Enregistre!" : "Enregistrer les parametres"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
