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
import { SensitivitySlider } from "@/components/ui/SensitivitySlider"
import { TopicAvoider } from "@/components/ui/TopicAvoider"
import Link from "next/link"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

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

  const p = APERCU_PALETTE
  const serifClass = "font-serif"

  if (status === "loading" || loading) {
    return (
      <div
        className="container mx-auto px-4 py-12 max-w-3xl"
        style={{ background: p.bg }}
      >
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: p.accent }} />
        </div>
      </div>
    )
  }

  if (!session?.user) {
    redirect("/connexion")
  }

  const sections: Array<{
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
    iconColor: string
    title: string
    description: string
    content: React.ReactNode
  }> = [
    {
      icon: Shield,
      iconColor: p.accent,
      title: "Tolérance au contenu",
      description:
        "Ces paramètres s'appliquent par défaut à tous les membres. Chaque membre peut personnaliser ses propres préférences.",
      content: settings ? (
        <div className="space-y-6">
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
            label="Contenu sexuel / Nudité"
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
        </div>
      ) : null,
    },
    {
      icon: Sparkles,
      iconColor: p.accent2,
      title: "Contenu préféré",
      description:
        "Indiquez l'importance que vous accordez à ces éléments positifs",
      content: settings ? (
        <div className="space-y-6">
          <SensitivitySlider
            label="Messages positifs"
            icon={<Sparkles className="h-4 w-4" />}
            value={settings.defaultPreferPositiveMessages}
            onChange={(v) =>
              updateSetting("defaultPreferPositiveMessages", v)
            }
            type="preference"
          />
          <SensitivitySlider
            label="Modèles de comportement"
            icon={<Users className="h-4 w-4" />}
            value={settings.defaultPreferRoleModels}
            onChange={(v) => updateSetting("defaultPreferRoleModels", v)}
            type="preference"
          />
          <SensitivitySlider
            label="Contenu éducatif"
            icon={<GraduationCap className="h-4 w-4" />}
            value={settings.defaultPreferEducational}
            onChange={(v) => updateSetting("defaultPreferEducational", v)}
            type="preference"
          />
        </div>
      ) : null,
    },
    {
      icon: AlertCircle,
      iconColor: p.accent,
      title: "Thèmes à éviter",
      description:
        "Ces thèmes seront exclus des recommandations pour toute la famille",
      content: settings ? (
        <TopicAvoider
          topics={settings.blockedTopics}
          onChange={(topics) => updateSetting("blockedTopics", topics)}
        />
      ) : null,
    },
    {
      icon: Tv,
      iconColor: p.accent2,
      title: "Plateformes disponibles",
      description:
        "Sélectionnez les services de streaming auxquels vous êtes abonnés",
      content: settings ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PLATFORMS.map((platform) => {
              const isSelected = settings.availablePlatforms.includes(
                platform.id
              )
              return (
                <button
                  key={platform.id}
                  onClick={() => togglePlatform(platform.id)}
                  className="p-3 rounded-lg border-2 transition-all text-sm font-medium"
                  style={{
                    background: isSelected ? p.bg2 : "transparent",
                    color: isSelected ? p.accent : p.ink,
                    borderColor: isSelected ? p.accent : p.line2,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${platform.color}`}
                    />
                    {platform.label}
                  </div>
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-xs" style={{ color: p.ink2 }}>
            Les recommandations privilégieront les contenus disponibles sur vos
            plateformes
          </p>
        </>
      ) : null,
    },
  ]

  return (
    <div
      className="flex flex-col flex-1"
      style={{ background: p.bg, color: p.ink }}
    >
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/profil"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full transition-opacity hover:opacity-80"
            style={{
              background: "transparent",
              color: p.ink,
              border: `1px solid ${p.line2}`,
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1
              className={`${serifClass} text-2xl md:text-3xl font-medium`}
              style={{ color: p.ink, letterSpacing: "-0.02em" }}
            >
              Paramètres de la{" "}
              <em className="italic" style={{ color: p.accent }}>
                famille
              </em>
            </h1>
            <p className="text-sm mt-1" style={{ color: p.ink2 }}>
              Définissez les préférences par défaut pour tous les membres
            </p>
          </div>
        </div>

        {error && (
          <div
            className="rounded-xl p-4 mb-6 flex items-center gap-3"
            style={{
              background: "rgba(209, 106, 74, 0.12)",
              border: `1px solid ${p.accent}`,
            }}
          >
            <AlertCircle
              className="h-5 w-5 flex-shrink-0"
              style={{ color: p.accent }}
            />
            <p style={{ color: p.ink }}>{error}</p>
          </div>
        )}

        {settings && (
          <div className="space-y-5">
            {sections.map((section) => (
              <div
                key={section.title}
                className="rounded-2xl p-6"
                style={{
                  background: p.card,
                  border: `1px solid ${p.line}`,
                }}
              >
                <div className="mb-5">
                  <h2
                    className={`${serifClass} text-lg md:text-xl font-medium flex items-center gap-2`}
                    style={{ color: p.ink, letterSpacing: "-0.02em" }}
                  >
                    <section.icon
                      className="h-5 w-5"
                      style={{ color: section.iconColor }}
                    />
                    {section.title}
                  </h2>
                  <p className="text-sm mt-1" style={{ color: p.ink2 }}>
                    {section.description}
                  </p>
                </div>
                {section.content}
              </div>
            ))}

            <div className="sticky bottom-4 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  background: p.ink,
                  color: p.bg,
                  boxShadow: `0 4px 12px ${p.line2}`,
                }}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved ? (
                  <Check className="h-4 w-4" />
                ) : null}
                {saved ? "Enregistré !" : "Enregistrer les paramètres"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
