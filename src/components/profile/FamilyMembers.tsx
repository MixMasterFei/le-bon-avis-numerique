"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Heart,
  ThumbsUp,
  Meh,
  Ghost,
  Frown,
  Baby,
  UserX,
  X,
  Check,
  Film,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

interface MediaReaction {
  id: string
  reaction: string
  media: {
    id: string
    title: string
    posterUrl: string | null
    type: string
    expertAgeRec: number | null
  }
}

interface FamilyMember {
  id: string
  name: string
  birthYear: number | null
  avatarEmoji: string
  reactions: MediaReaction[]
  _count: {
    reactions: number
  }
}

const EMOJI_OPTIONS = ["👧", "👦", "👶", "🧒", "👩", "👨", "🧑", "👴", "👵"]

const REACTION_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  LOVED: { label: "Adoré", icon: Heart, color: "text-red-500" },
  LIKED: { label: "Bien aimé", icon: ThumbsUp, color: "text-green-500" },
  OK: { label: "Bof", icon: Meh, color: "text-yellow-500" },
  SCARED: { label: "A eu peur", icon: Ghost, color: "text-purple-500" },
  BORED: { label: "S'est ennuyé", icon: Frown, color: "text-gray-500" },
  TOO_YOUNG: { label: "Trop jeune", icon: Baby, color: "text-blue-500" },
  TOO_OLD: { label: "Pas intéressé", icon: UserX, color: "text-orange-500" },
}

export function FamilyMembers() {
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    birthYear: "",
    avatarEmoji: "👧",
  })
  const [saving, setSaving] = useState(false)

  const fetchMembers = async () => {
    try {
      const res = await fetch("/api/user/family")
      if (!res.ok) throw new Error("Erreur lors du chargement")
      const data = await res.json()
      setMembers(data.familyMembers)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMembers()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = editingId
        ? `/api/user/family/${editingId}`
        : "/api/user/family"
      const method = editingId ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erreur")
      }

      await fetchMembers()
      setShowAddForm(false)
      setEditingId(null)
      setFormData({ name: "", birthYear: "", avatarEmoji: "👧" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (member: FamilyMember) => {
    setFormData({
      name: member.name,
      birthYear: member.birthYear?.toString() || "",
      avatarEmoji: member.avatarEmoji,
    })
    setEditingId(member.id)
    setShowAddForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce membre de la famille ?")) return

    try {
      const res = await fetch(`/api/user/family/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Erreur lors de la suppression")
      await fetchMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur")
    }
  }

  const cancelForm = () => {
    setShowAddForm(false)
    setEditingId(null)
    setFormData({ name: "", birthYear: "", avatarEmoji: "👧" })
  }

  const currentYear = new Date().getFullYear()

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Ma famille
            </CardTitle>
            <CardDescription>
              Ajoutez les membres de votre famille pour enregistrer leurs réactions aux films
            </CardDescription>
          </div>
          {!showAddForm && (
            <Button onClick={() => setShowAddForm(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Add/Edit Form */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium mb-4">
              {editingId ? "Modifier le membre" : "Nouveau membre"}
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Prénom</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Emma"
                  required
                />
              </div>

              <div>
                <Label htmlFor="birthYear">Année de naissance (optionnel)</Label>
                <Input
                  id="birthYear"
                  type="number"
                  min="1920"
                  max={currentYear}
                  value={formData.birthYear}
                  onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })}
                  placeholder="Ex: 2015"
                />
              </div>
            </div>

            <div className="mt-4">
              <Label>Avatar</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setFormData({ ...formData, avatarEmoji: emoji })}
                    className={`w-10 h-10 text-xl rounded-lg border-2 transition-all ${
                      formData.avatarEmoji === emoji
                        ? "border-primary bg-primary/10"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                {editingId ? "Enregistrer" : "Ajouter"}
              </Button>
              <Button type="button" variant="outline" onClick={cancelForm}>
                <X className="h-4 w-4 mr-1" />
                Annuler
              </Button>
            </div>
          </form>
        )}

        {/* Members List */}
        {members.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Aucun membre de famille</p>
            <p className="text-sm mt-1">
              Ajoutez vos enfants pour enregistrer leurs réactions aux films
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {members.map((member) => (
              <div
                key={member.id}
                className="p-4 border rounded-lg hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="text-3xl w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full">
                    {member.avatarEmoji}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{member.name}</h4>
                      {member.birthYear && (
                        <Badge variant="outline" className="text-xs">
                          {currentYear - member.birthYear} ans
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-gray-500 mt-0.5">
                      {member._count.reactions} réaction{member._count.reactions > 1 ? "s" : ""}
                    </p>

                    {/* Recent Reactions */}
                    {member.reactions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {member.reactions.slice(0, 4).map((reaction) => {
                          const info = REACTION_LABELS[reaction.reaction]
                          const Icon = info?.icon || Heart
                          return (
                            <Link
                              key={reaction.id}
                              href={`/media/${reaction.media.id}`}
                              className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded text-xs hover:bg-gray-100 transition-colors"
                            >
                              {reaction.media.posterUrl ? (
                                <Image
                                  src={reaction.media.posterUrl}
                                  alt=""
                                  width={16}
                                  height={24}
                                  className="rounded"
                                />
                              ) : (
                                <Film className="h-4 w-4 text-gray-400" />
                              )}
                              <span className="max-w-[100px] truncate">
                                {reaction.media.title}
                              </span>
                              <Icon className={`h-3 w-3 ${info?.color || "text-gray-400"}`} />
                            </Link>
                          )
                        })}
                        {member._count.reactions > 4 && (
                          <span className="text-xs text-gray-400 py-1">
                            +{member._count.reactions - 4} autres
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(member)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(member.id)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
