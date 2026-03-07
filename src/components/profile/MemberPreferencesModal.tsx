"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { SensitivitySlider } from "@/components/ui/SensitivitySlider"
import { TopicAvoider } from "@/components/ui/TopicAvoider"
import {
  Loader2,
  Check,
  Shield,
  Sparkles,
  Heart,
  Skull,
  Ghost,
  MessageCircle,
  Wine,
  Users,
  GraduationCap,
} from "lucide-react"

interface MemberPreferences {
  id: string
  name: string
  favoriteGenres: string[]
  dislikedGenres: string[]
  sensitivityViolence: number
  sensitivityScary: number
  sensitivitySexual: number
  sensitivityLanguage: number
  sensitivitySubstances: number
  preferPositiveMessages: number
  preferRoleModels: number
  preferEducational: number
  avoidTopics: string[]
  useCustomSettings: boolean
}

interface MemberPreferencesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberId: string
  memberName: string
  onSaved?: () => void
}

const AVAILABLE_GENRES = [
  "Animation",
  "Aventure",
  "Comedie",
  "Fantastique",
  "Science-Fiction",
  "Famille",
  "Action",
  "Documentaire",
  "Musical",
  "Drame",
  "Romance",
  "Thriller",
  "Horreur",
]

export function MemberPreferencesModal({
  open,
  onOpenChange,
  memberId,
  memberName,
  onSaved,
}: MemberPreferencesModalProps) {
  const [preferences, setPreferences] = useState<MemberPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"sensitivity" | "genres" | "topics">("sensitivity")

  useEffect(() => {
    const fetchPreferences = async () => {
      if (!open || !memberId) return

      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/user/family/${memberId}/preferences`)
        if (res.ok) {
          const data = await res.json()
          setPreferences(data.member)
        } else {
          setError("Erreur lors du chargement")
        }
      } catch {
        setError("Erreur de connexion")
      } finally {
        setLoading(false)
      }
    }

    fetchPreferences()
  }, [open, memberId])

  const handleSave = async () => {
    if (!preferences) return

    setSaving(true)
    setSaved(false)
    setError(null)

    try {
      const res = await fetch(`/api/user/family/${memberId}/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...preferences, useCustomSettings: true }),
      })

      if (res.ok) {
        setSaved(true)
        onSaved?.()
        setTimeout(() => {
          onOpenChange(false)
          setSaved(false)
        }, 1500)
      } else {
        setError("Erreur lors de la sauvegarde")
      }
    } catch {
      setError("Erreur de connexion")
    } finally {
      setSaving(false)
    }
  }

  const updatePreference = <K extends keyof MemberPreferences>(
    key: K,
    value: MemberPreferences[K]
  ) => {
    if (!preferences) return
    setPreferences({ ...preferences, [key]: value })
  }

  const toggleGenre = (genre: string, type: "favorite" | "disliked") => {
    if (!preferences) return

    if (type === "favorite") {
      const newFavorites = preferences.favoriteGenres.includes(genre)
        ? preferences.favoriteGenres.filter(g => g !== genre)
        : [...preferences.favoriteGenres, genre]
      // Remove from disliked if adding to favorites
      const newDisliked = preferences.dislikedGenres.filter(g => g !== genre)
      setPreferences({
        ...preferences,
        favoriteGenres: newFavorites,
        dislikedGenres: newDisliked,
      })
    } else {
      const newDisliked = preferences.dislikedGenres.includes(genre)
        ? preferences.dislikedGenres.filter(g => g !== genre)
        : [...preferences.dislikedGenres, genre]
      // Remove from favorites if adding to disliked
      const newFavorites = preferences.favoriteGenres.filter(g => g !== genre)
      setPreferences({
        ...preferences,
        favoriteGenres: newFavorites,
        dislikedGenres: newDisliked,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preferences de {memberName}</DialogTitle>
          <DialogDescription>
            Personnalisez les filtres et recommandations pour ce membre de la famille
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error && !preferences ? (
          <div className="text-center py-12 text-red-500">{error}</div>
        ) : preferences ? (
          <div className="space-y-6">
            {/* Info note */}
            <div className="p-3 bg-violet-50 rounded-lg">
              <p className="text-sm text-violet-700">
                Personnalisez les préférences de <strong>{memberName}</strong>. Ces réglages seront utilisés pour filtrer et recommander du contenu adapté.
              </p>
            </div>

            {/* Tab navigation */}
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab("sensitivity")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "sensitivity"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Shield className="h-4 w-4 inline mr-2" />
                Sensibilite
              </button>
              <button
                onClick={() => setActiveTab("genres")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "genres"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Heart className="h-4 w-4 inline mr-2" />
                Genres
              </button>
              <button
                onClick={() => setActiveTab("topics")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "topics"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Sparkles className="h-4 w-4 inline mr-2" />
                Themes
              </button>
            </div>

            {/* Sensitivity tab */}
            {activeTab === "sensitivity" && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-gray-700">Tolerance au contenu</h3>
                  <SensitivitySlider
                    label="Violence"
                    icon={<Skull className="h-4 w-4" />}
                    value={preferences.sensitivityViolence}
                    onChange={(v) => updatePreference("sensitivityViolence", v)}
                    type="sensitivity"
                  />
                  <SensitivitySlider
                    label="Contenu effrayant"
                    icon={<Ghost className="h-4 w-4" />}
                    value={preferences.sensitivityScary}
                    onChange={(v) => updatePreference("sensitivityScary", v)}
                    type="sensitivity"
                  />
                  <SensitivitySlider
                    label="Contenu sexuel"
                    icon={<Heart className="h-4 w-4" />}
                    value={preferences.sensitivitySexual}
                    onChange={(v) => updatePreference("sensitivitySexual", v)}
                    type="sensitivity"
                  />
                  <SensitivitySlider
                    label="Langage grossier"
                    icon={<MessageCircle className="h-4 w-4" />}
                    value={preferences.sensitivityLanguage}
                    onChange={(v) => updatePreference("sensitivityLanguage", v)}
                    type="sensitivity"
                  />
                  <SensitivitySlider
                    label="Drogues / Alcool"
                    icon={<Wine className="h-4 w-4" />}
                    value={preferences.sensitivitySubstances}
                    onChange={(v) => updatePreference("sensitivitySubstances", v)}
                    type="sensitivity"
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-gray-700">Contenu prefere</h3>
                  <SensitivitySlider
                    label="Messages positifs"
                    icon={<Sparkles className="h-4 w-4" />}
                    value={preferences.preferPositiveMessages}
                    onChange={(v) => updatePreference("preferPositiveMessages", v)}
                    type="preference"
                  />
                  <SensitivitySlider
                    label="Modeles de comportement"
                    icon={<Users className="h-4 w-4" />}
                    value={preferences.preferRoleModels}
                    onChange={(v) => updatePreference("preferRoleModels", v)}
                    type="preference"
                  />
                  <SensitivitySlider
                    label="Contenu educatif"
                    icon={<GraduationCap className="h-4 w-4" />}
                    value={preferences.preferEducational}
                    onChange={(v) => updatePreference("preferEducational", v)}
                    type="preference"
                  />
                </div>
              </div>
            )}

            {/* Genres tab */}
            {activeTab === "genres" && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-sm text-gray-700 mb-3">
                    Genres preferes
                    <span className="text-xs text-gray-400 ml-2">
                      ({preferences.favoriteGenres.length} sélectionné{preferences.favoriteGenres.length > 1 ? "s" : ""})
                    </span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_GENRES.map(genre => (
                      <button
                        key={genre}
                        onClick={() => toggleGenre(genre, "favorite")}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                          preferences.favoriteGenres.includes(genre)
                            ? "bg-green-500 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {preferences.favoriteGenres.includes(genre) && "♥ "}
                        {genre}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-sm text-gray-700 mb-3">
                    Genres a eviter
                    <span className="text-xs text-gray-400 ml-2">
                      ({preferences.dislikedGenres.length} sélectionné{preferences.dislikedGenres.length > 1 ? "s" : ""})
                    </span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_GENRES.map(genre => (
                      <button
                        key={genre}
                        onClick={() => toggleGenre(genre, "disliked")}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                          preferences.dislikedGenres.includes(genre)
                            ? "bg-red-500 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {preferences.dislikedGenres.includes(genre) && "✕ "}
                        {genre}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Topics tab */}
            {activeTab === "topics" && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Ajoutez des themes ou sujets specifiques que {memberName} devrait eviter
                </p>
                <TopicAvoider
                  topics={preferences.avoidTopics}
                  onChange={(topics) => updatePreference("avoidTopics", topics)}
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || !preferences}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : saved ? (
              <Check className="h-4 w-4 mr-2" />
            ) : null}
            {saved ? "Enregistré !" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
