"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Loader2,
  Heart,
  ThumbsUp,
  Meh,
  Ghost,
  Frown,
  Baby,
  UserX,
  Edit2,
  Check,
  X,
  Sparkles,
  Film,
  Shield,
  Star,
  BarChart3,
  Tag,
  AlertTriangle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { CompletionMeter } from "./CompletionMeter"
import { InterestsEditor } from "./InterestsEditor"
import { MediaSearchAdd } from "./MediaSearchAdd"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { AvatarPicker, defaultAvatarValue, type AvatarValue } from "@/components/ui/AvatarPicker"
import { toMediaRouteId } from "@/lib/media-route"
import type { MediaType } from "@/lib/types"
import { cn, formatAgeFromBirthYear } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Reaction {
  id: string
  reaction: string
  note: string | null
  createdAt: string
  media: {
    id: string
    title: string
    posterUrl: string | null
    type: string
    expertAgeRec: number | null
    genres: string[]
  }
}

interface MemberData {
  id: string
  name: string
  birthYear: number | null
  avatarEmoji: string
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  favoriteGenres: string[]
  dislikedGenres: string[]
  interests: string[]
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
  reactions: Reaction[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REACTION_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  LOVED: { label: "Adoré", icon: Heart, color: "text-red-500" },
  LIKED: { label: "Bien aimé", icon: ThumbsUp, color: "text-green-500" },
  OK: { label: "Bof", icon: Meh, color: "text-yellow-500" },
  SCARED: { label: "A eu peur", icon: Ghost, color: "text-purple-500" },
  BORED: { label: "S'est ennuyé", icon: Frown, color: "text-gray-500" },
  TOO_YOUNG: { label: "Trop jeune", icon: Baby, color: "text-blue-500" },
  TOO_OLD: { label: "Pas intéressé", icon: UserX, color: "text-orange-500" },
}

const TYPE_LABELS: Record<string, string> = {
  MOVIE: "Film",
  TV: "Série",
  GAME: "Jeu",
  BOOK: "Livre",
  APP: "App",
}

const SENSITIVITY_LABELS: Record<number, string> = {
  0: "Pas gêné(e)",
  1: "Un peu sensible",
  2: "Assez sensible",
  3: "Très sensible",
}

const PREFERENCE_LABELS: Record<number, string> = {
  0: "Indifférent",
  1: "Apprécié",
  2: "Important",
  3: "Essentiel",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MemberCornerProps {
  memberId: string
}

export function MemberCorner({ memberId }: MemberCornerProps) {
  const [member, setMember] = useState<MemberData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const [editBirthYear, setEditBirthYear] = useState("")
  const [editAvatar, setEditAvatar] = useState("")
  const [editAvatarValue, setEditAvatarValue] = useState<AvatarValue>(defaultAvatarValue())
  const [savingProfile, setSavingProfile] = useState(false)

  // Interests save state
  const [savingInterests, setSavingInterests] = useState(false)
  const [interestsSaved, setInterestsSaved] = useState(false)

  // Filter state for favorites tab
  const [typeFilter, setTypeFilter] = useState<string>("all")

  useEffect(() => {
    async function load() {
      try {
        const [memberRes, prefsRes] = await Promise.all([
          fetch(`/api/user/family/${memberId}`),
          fetch(`/api/user/family/${memberId}/preferences`),
        ])

        if (!memberRes.ok) {
          setError("Membre non trouvé")
          return
        }

        const memberData = await memberRes.json()
        const prefsData = prefsRes.ok ? await prefsRes.json() : null

        const fm = memberData.familyMember
        const prefs = prefsData?.member

        setMember({
          id: fm.id,
          name: fm.name,
          birthYear: fm.birthYear,
          avatarEmoji: fm.avatarEmoji,
          avatarStyle: fm.avatarStyle ?? null,
          avatarSeed: fm.avatarSeed ?? null,
          avatarOptions: fm.avatarOptions ?? null,
          favoriteGenres: prefs?.favoriteGenres ?? fm.favoriteGenres ?? [],
          dislikedGenres: prefs?.dislikedGenres ?? fm.dislikedGenres ?? [],
          interests: prefs?.interests ?? fm.interests ?? [],
          sensitivityViolence: prefs?.sensitivityViolence ?? 2,
          sensitivityScary: prefs?.sensitivityScary ?? 2,
          sensitivitySexual: prefs?.sensitivitySexual ?? 3,
          sensitivityLanguage: prefs?.sensitivityLanguage ?? 2,
          sensitivitySubstances: prefs?.sensitivitySubstances ?? 2,
          preferPositiveMessages: prefs?.preferPositiveMessages ?? 1,
          preferRoleModels: prefs?.preferRoleModels ?? 1,
          preferEducational: prefs?.preferEducational ?? 1,
          avoidTopics: prefs?.avoidTopics ?? [],
          useCustomSettings: prefs?.useCustomSettings ?? false,
          reactions: fm.reactions ?? [],
        })
      } catch {
        setError("Erreur de connexion")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [memberId])

  // ---------- Loading ----------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !member) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">{error || "Erreur inconnue"}</p>
        <Button asChild variant="outline">
          <Link href="/profil">Retour au profil</Link>
        </Button>
      </div>
    )
  }

  const memberAge = member.birthYear != null ? formatAgeFromBirthYear(member.birthYear) : null

  // ---------- Handlers ----------

  const startEditing = () => {
    setEditName(member.name)
    setEditBirthYear(member.birthYear?.toString() ?? "")
    setEditAvatar(member.avatarEmoji)
    if (member.avatarStyle && member.avatarSeed) {
      setEditAvatarValue({ style: member.avatarStyle, seed: member.avatarSeed, options: member.avatarOptions ?? undefined })
    } else {
      setEditAvatarValue(defaultAvatarValue())
    }
    setEditing(true)
  }

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await fetch(`/api/user/family/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim() || member.name,
          birthYear: editBirthYear ? parseInt(editBirthYear) : null,
          avatarEmoji: editAvatar,
          avatarStyle: editAvatarValue.style,
          avatarSeed: editAvatarValue.seed,
          avatarOptions: editAvatarValue.options ?? null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setMember((prev) => prev ? {
          ...prev,
          name: data.familyMember.name,
          birthYear: data.familyMember.birthYear,
          avatarEmoji: data.familyMember.avatarEmoji,
          avatarStyle: data.familyMember.avatarStyle ?? null,
          avatarSeed: data.familyMember.avatarSeed ?? null,
          avatarOptions: data.familyMember.avatarOptions ?? null,
        } : prev)
        setEditing(false)
      }
    } catch {
      // Silently fail
    } finally {
      setSavingProfile(false)
    }
  }

  const saveInterests = async (newInterests: string[]) => {
    setMember((prev) => prev ? { ...prev, interests: newInterests } : prev)
    setSavingInterests(true)
    setInterestsSaved(false)
    try {
      await fetch(`/api/user/family/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests: newInterests }),
      })
      setInterestsSaved(true)
      setTimeout(() => setInterestsSaved(false), 2000)
    } catch {
      // Silently fail
    } finally {
      setSavingInterests(false)
    }
  }

  const handleMediaAdded = (media: { id: string; title: string; posterUrl: string | null; type: string }) => {
    setMember((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        reactions: [
          {
            id: `temp-${Date.now()}`,
            reaction: "LOVED",
            note: null,
            createdAt: new Date().toISOString(),
            media: {
              id: media.id,
              title: media.title,
              posterUrl: media.posterUrl,
              type: media.type,
              expertAgeRec: null,
              genres: [],
            },
          },
          ...prev.reactions,
        ],
      }
    })
  }

  const removeReaction = async (mediaId: string) => {
    const prev = member.reactions
    setMember((m) => m ? { ...m, reactions: m.reactions.filter((r) => r.media.id !== mediaId) } : m)
    try {
      const res = await fetch(`/api/user/reaction?familyMemberId=${memberId}&mediaId=${mediaId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        setMember((m) => m ? { ...m, reactions: prev } : m)
      }
    } catch {
      setMember((m) => m ? { ...m, reactions: prev } : m)
    }
  }

  // ---------- Derived data ----------

  const existingMediaIds = new Set(member.reactions.map((r) => r.media.id))
  const lovedCount = member.reactions.filter((r) => r.reaction === "LOVED").length
  const filteredReactions = typeFilter === "all"
    ? member.reactions
    : member.reactions.filter((r) => r.media.type === typeFilter)

  const uniqueTypes = [...new Set(member.reactions.map((r) => r.media.type))]

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <MemberAvatar
          avatarStyle={member.avatarStyle}
          avatarSeed={member.avatarSeed}
          avatarOptions={member.avatarOptions}
          avatarEmoji={member.avatarEmoji}
          name={member.name}
          size={56}
        />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Le coin de {member.name}
          </h1>
          {memberAge != null && (
            <p className="text-sm text-gray-500">{memberAge}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="overview">Aperçu</TabsTrigger>
          <TabsTrigger value="favorites">Favoris</TabsTrigger>
          <TabsTrigger value="preferences">Préférences</TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* TAB: Overview                                                     */}
        {/* ================================================================ */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Identity card */}
          <Card>
            <CardContent className="p-5">
              {!editing ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MemberAvatar
                      avatarStyle={member.avatarStyle}
                      avatarSeed={member.avatarSeed}
                      avatarOptions={member.avatarOptions}
                      avatarEmoji={member.avatarEmoji}
                      name={member.name}
                      size={40}
                    />
                    <div>
                      <h3 className="font-semibold text-gray-900">{member.name}</h3>
                      <p className="text-sm text-gray-500">
                        {memberAge != null ? memberAge : "Âge non renseigné"}
                        {member.birthYear != null && ` (né en ${member.birthYear})`}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={startEditing}>
                    <Edit2 className="h-4 w-4 mr-1" />
                    Modifier
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Prénom</label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Année de naissance</label>
                      <Input
                        type="number"
                        value={editBirthYear}
                        onChange={(e) => setEditBirthYear(e.target.value)}
                        placeholder="ex: 2015"
                        min={1920}
                        max={new Date().getFullYear()}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Avatar</label>
                    <div className="mt-2">
                      <AvatarPicker value={editAvatarValue} onChange={setEditAvatarValue} />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                      Annuler
                    </Button>
                    <Button size="sm" onClick={saveProfile} disabled={savingProfile}>
                      {savingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                      Enregistrer
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Completion meter */}
          <Card>
            <CardContent className="p-5">
              <CompletionMeter member={member} reactionCount={member.reactions.length} />
            </CardContent>
          </Card>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <BarChart3 className="h-5 w-5 mx-auto text-gray-400 mb-1" />
                <p className="text-2xl font-bold text-gray-900">{member.reactions.length}</p>
                <p className="text-xs text-gray-500">Réactions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Heart className="h-5 w-5 mx-auto text-red-400 mb-1" />
                <p className="text-2xl font-bold text-gray-900">{lovedCount}</p>
                <p className="text-xs text-gray-500">Adorés</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Tag className="h-5 w-5 mx-auto text-violet-400 mb-1" />
                <p className="text-2xl font-bold text-gray-900">{member.favoriteGenres.length}</p>
                <p className="text-xs text-gray-500">Genres</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Sparkles className="h-5 w-5 mx-auto text-amber-400 mb-1" />
                {member.useCustomSettings && member.favoriteGenres.length > 0 ? (
                  <>
                    <p className="text-sm font-bold text-emerald-600">Complété</p>
                    <p className="text-xs text-gray-500">Quiz</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-amber-600">À faire</p>
                    <p className="text-xs text-gray-500">Quiz</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Interests */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Centres d&apos;intérêt</CardTitle>
                {savingInterests && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                {interestsSaved && <span className="text-xs text-emerald-600 flex items-center gap-1"><Check className="h-3 w-3" /> Enregistré</span>}
              </div>
            </CardHeader>
            <CardContent>
              <InterestsEditor
                interests={member.interests}
                onChange={saveInterests}
                memberName={member.name}
              />
            </CardContent>
          </Card>

          {/* Recent activity */}
          {member.reactions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Activité récente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {member.reactions.slice(0, 5).map((reaction) => {
                  const config = REACTION_LABELS[reaction.reaction]
                  const Icon = config?.icon || Meh
                  const routeId = toMediaRouteId(reaction.media.type as MediaType, reaction.media.id)

                  return (
                    <Link
                      key={reaction.id}
                      href={`/media/${routeId}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {reaction.media.posterUrl ? (
                        <img
                          src={reaction.media.posterUrl}
                          alt=""
                          className="w-8 h-12 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-12 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                          <Film className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{reaction.media.title}</p>
                        <p className="text-xs text-gray-400">
                          {TYPE_LABELS[reaction.media.type] || reaction.media.type}
                        </p>
                      </div>
                      <span className={cn("flex items-center gap-1 text-xs font-medium", config?.color)}>
                        <Icon className="h-3.5 w-3.5" />
                        {config?.label}
                      </span>
                    </Link>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB: Favorites                                                    */}
        {/* ================================================================ */}
        <TabsContent value="favorites" className="space-y-4 mt-4">
          {/* Search */}
          <MediaSearchAdd
            memberId={memberId}
            memberName={member.name}
            existingMediaIds={existingMediaIds}
            onAdded={handleMediaAdded}
          />

          {/* Type filter */}
          {uniqueTypes.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setTypeFilter("all")}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  typeFilter === "all"
                    ? "bg-violet-100 text-violet-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                Tous ({member.reactions.length})
              </button>
              {uniqueTypes.map((type) => {
                const count = member.reactions.filter((r) => r.media.type === type).length
                return (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                      typeFilter === type
                        ? "bg-violet-100 text-violet-700"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {TYPE_LABELS[type] || type}s ({count})
                  </button>
                )
              })}
            </div>
          )}

          {/* Media grid */}
          {filteredReactions.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredReactions.map((reaction) => {
                const config = REACTION_LABELS[reaction.reaction]
                const Icon = config?.icon || Meh
                const routeId = toMediaRouteId(reaction.media.type as MediaType, reaction.media.id)

                return (
                  <div key={reaction.id} className="group relative">
                    <Link href={`/media/${routeId}`}>
                      <div className="aspect-[2/3] rounded-xl overflow-hidden bg-gray-100 relative">
                        {reaction.media.posterUrl ? (
                          <img
                            src={reaction.media.posterUrl}
                            alt={reaction.media.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="h-8 w-8 text-gray-300" />
                          </div>
                        )}

                        {/* Reaction badge */}
                        <div className={cn(
                          "absolute top-2 right-2 p-1.5 rounded-full bg-white/90 shadow-sm",
                          config?.color
                        )}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>

                        {/* Hover overlay with remove button */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                      </div>
                    </Link>

                    {/* Remove button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeReaction(reaction.media.id)
                      }}
                      className="absolute top-2 left-2 p-1 rounded-full bg-white/90 shadow-sm text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Retirer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>

                    <p className="mt-1.5 text-xs font-medium text-gray-900 line-clamp-2">{reaction.media.title}</p>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Heart className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                Aucun favori pour le moment.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Utilisez la barre de recherche ci-dessus pour ajouter les films et séries que {member.name} a adorés !
              </p>
            </div>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB: Preferences                                                  */}
        {/* ================================================================ */}
        <TabsContent value="preferences" className="space-y-4 mt-4">
          {/* Quiz status */}
          <Card className={member.useCustomSettings && member.favoriteGenres.length > 0 ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className={cn(
                    "h-5 w-5",
                    member.useCustomSettings && member.favoriteGenres.length > 0 ? "text-emerald-600" : "text-amber-600"
                  )} />
                  <div>
                    <p className="font-medium text-gray-900">
                      {member.useCustomSettings && member.favoriteGenres.length > 0
                        ? "Quiz de préférences complété"
                        : "Quiz de préférences non complété"
                      }
                    </p>
                    <p className="text-xs text-gray-500">
                      {member.useCustomSettings && member.favoriteGenres.length > 0
                        ? "Les recommandations sont personnalisées"
                        : "Complétez le quiz pour de meilleures recommandations"
                      }
                    </p>
                  </div>
                </div>
                <Button asChild size="sm" variant={member.useCustomSettings && member.favoriteGenres.length > 0 ? "outline" : "default"}>
                  <Link href={`/profil/quiz/${memberId}`}>
                    {member.useCustomSettings && member.favoriteGenres.length > 0 ? "Refaire" : "Faire le quiz"}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sensitivity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-gray-400" />
                Sensibilité
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SensitivityRow label="Violence" value={member.sensitivityViolence} />
              <SensitivityRow label="Scènes effrayantes" value={member.sensitivityScary} />
              <SensitivityRow label="Contenu sexuel" value={member.sensitivitySexual} />
              <SensitivityRow label="Langage" value={member.sensitivityLanguage} />
              <SensitivityRow label="Substances" value={member.sensitivitySubstances} />
            </CardContent>
          </Card>

          {/* Positive content */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4 text-gray-400" />
                Contenu positif
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <PreferenceRow label="Messages positifs" value={member.preferPositiveMessages} />
              <PreferenceRow label="Bons modèles" value={member.preferRoleModels} />
              <PreferenceRow label="Éducatif" value={member.preferEducational} />
            </CardContent>
          </Card>

          {/* Genres */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Film className="h-4 w-4 text-gray-400" />
                Genres
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {member.favoriteGenres.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Préférés</p>
                  <div className="flex flex-wrap gap-1.5">
                    {member.favoriteGenres.map((g) => (
                      <Badge key={g} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{g}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {member.dislikedGenres.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">À éviter</p>
                  <div className="flex flex-wrap gap-1.5">
                    {member.dislikedGenres.map((g) => (
                      <Badge key={g} className="bg-red-100 text-red-700 hover:bg-red-100">{g}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {member.favoriteGenres.length === 0 && member.dislikedGenres.length === 0 && (
                <p className="text-sm text-gray-400">Aucun genre défini. Complétez le quiz pour personnaliser.</p>
              )}
            </CardContent>
          </Card>

          {/* Topics to avoid */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-gray-400" />
                Sujets à éviter
              </CardTitle>
            </CardHeader>
            <CardContent>
              {member.avoidTopics.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {member.avoidTopics.map((t) => (
                    <Badge key={t} className="bg-red-100 text-red-700 hover:bg-red-100">{t}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Aucun sujet à éviter défini.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SensitivityRow({ label, value }: { label: string; value: number }) {
  const colors = ["bg-emerald-200", "bg-amber-200", "bg-orange-200", "bg-red-200"]
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "w-4 h-2 rounded-full",
                i <= value ? colors[value] : "bg-gray-200"
              )}
            />
          ))}
        </div>
        <span className="text-xs text-gray-500 w-28 text-right">{SENSITIVITY_LABELS[value]}</span>
      </div>
    </div>
  )
}

function PreferenceRow({ label, value }: { label: string; value: number }) {
  const colors = ["bg-gray-200", "bg-blue-200", "bg-violet-200", "bg-violet-400"]
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "w-4 h-2 rounded-full",
                i <= value ? colors[value] : "bg-gray-200"
              )}
            />
          ))}
        </div>
        <span className="text-xs text-gray-500 w-28 text-right">{PREFERENCE_LABELS[value]}</span>
      </div>
    </div>
  )
}
