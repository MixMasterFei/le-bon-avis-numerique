"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import {
  Users,
  Heart,
  ThumbsUp,
  Meh,
  Ghost,
  Frown,
  Baby,
  UserX,
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface FamilyMemberWithReaction {
  id: string
  name: string
  birthYear: number | null
  avatarEmoji: string
  reaction: {
    id: string
    reaction: string
    note: string | null
  } | null
}

interface FamilyReactionsProps {
  mediaId: string
  mediaTitle: string
}

const REACTIONS: {
  value: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgColor: string
  selectedBg: string
  ringColor: string
}[] = [
  { value: "LOVED", label: "Adoré", icon: Heart, color: "text-red-500", bgColor: "bg-red-50 hover:bg-red-100", selectedBg: "bg-red-100", ringColor: "ring-red-400" },
  { value: "LIKED", label: "Bien aimé", icon: ThumbsUp, color: "text-green-500", bgColor: "bg-green-50 hover:bg-green-100", selectedBg: "bg-green-100", ringColor: "ring-green-400" },
  { value: "OK", label: "Bof", icon: Meh, color: "text-yellow-500", bgColor: "bg-yellow-50 hover:bg-yellow-100", selectedBg: "bg-yellow-100", ringColor: "ring-yellow-400" },
  { value: "SCARED", label: "A eu peur", icon: Ghost, color: "text-purple-500", bgColor: "bg-purple-50 hover:bg-purple-100", selectedBg: "bg-purple-100", ringColor: "ring-purple-400" },
  { value: "BORED", label: "S'est ennuyé", icon: Frown, color: "text-gray-500", bgColor: "bg-gray-50 hover:bg-gray-100", selectedBg: "bg-gray-200", ringColor: "ring-gray-400" },
  { value: "TOO_YOUNG", label: "Trop jeune", icon: Baby, color: "text-blue-500", bgColor: "bg-blue-50 hover:bg-blue-100", selectedBg: "bg-blue-100", ringColor: "ring-blue-400" },
  { value: "TOO_OLD", label: "Pas intéressé", icon: UserX, color: "text-orange-500", bgColor: "bg-orange-50 hover:bg-orange-100", selectedBg: "bg-orange-100", ringColor: "ring-orange-400" },
]

export function FamilyReactions({ mediaId, mediaTitle }: FamilyReactionsProps) {
  const { data: session, status } = useSession()
  const [members, setMembers] = useState<FamilyMemberWithReaction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReactions = async () => {
    try {
      const res = await fetch(`/api/user/reaction?mediaId=${mediaId}`)
      if (!res.ok) throw new Error("Erreur")
      const data = await res.json()
      setMembers(data.familyMembers)
    } catch {
      setError("Erreur lors du chargement")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchReactions()
    } else {
      setLoading(false)
    }
  }, [session, mediaId])

  const handleReaction = async (memberId: string, reactionValue: string) => {
    const member = members.find((m) => m.id === memberId)
    if (!member) return

    // If clicking same reaction, remove it
    if (member.reaction?.reaction === reactionValue) {
      setSaving(memberId)
      // Optimistic update - remove reaction immediately
      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, reaction: null } : m
      ))
      try {
        const res = await fetch(`/api/user/reaction?familyMemberId=${memberId}&mediaId=${mediaId}`, {
          method: "DELETE",
        })
        if (!res.ok) throw new Error("Delete failed")
      } catch {
        setError("Erreur lors de la suppression")
        await fetchReactions() // Revert on error
      } finally {
        setSaving(null)
      }
      return
    }

    // Save new reaction
    setSaving(memberId)
    // Optimistic update - show reaction immediately
    setMembers(prev => prev.map(m =>
      m.id === memberId
        ? { ...m, reaction: { id: "temp", reaction: reactionValue, note: null } }
        : m
    ))
    try {
      const res = await fetch("/api/user/reaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyMemberId: memberId,
          mediaId,
          reaction: reactionValue,
        }),
      })
      if (!res.ok) throw new Error("Save failed")
      // Fetch to get the real ID
      await fetchReactions()
    } catch {
      setError("Erreur lors de l'enregistrement")
      await fetchReactions() // Revert on error
    } finally {
      setSaving(null)
    }
  }

  // Not logged in
  if (status === "unauthenticated") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Réactions de la famille
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-3">
            Connectez-vous pour enregistrer les réactions de votre famille à ce contenu.
          </p>
          <Button asChild size="sm">
            <Link href="/connexion">Se connecter</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Loading
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  // No family members
  if (members.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Réactions de la famille
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-3">
            Ajoutez les membres de votre famille pour enregistrer leurs réactions.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/profil">
              <Plus className="h-4 w-4 mr-1" />
              Ajouter un membre
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Show reactions with members who have reacted
  const membersWithReactions = members.filter((m) => m.reaction)
  const membersWithoutReactions = members.filter((m) => !m.reaction)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Réactions de la famille
          </CardTitle>
          {members.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-xs"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Réduire
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Ajouter réaction
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {/* Show existing reactions */}
        {membersWithReactions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {membersWithReactions.map((member) => {
              const reactionInfo = REACTIONS.find((r) => r.value === member.reaction?.reaction)
              const Icon = reactionInfo?.icon || Heart
              return (
                <div
                  key={member.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg ${reactionInfo?.bgColor || "bg-gray-50"}`}
                >
                  <span className="text-lg">{member.avatarEmoji}</span>
                  <span className="text-sm font-medium">{member.name}</span>
                  <Icon className={`h-4 w-4 ${reactionInfo?.color || "text-gray-400"}`} />
                  <span className="text-xs text-gray-500">{reactionInfo?.label}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Expanded view to add reactions */}
        {expanded && (
          <div className="space-y-4 pt-2 border-t">
            {members.map((member) => (
              <div key={member.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{member.avatarEmoji}</span>
                  <span className="font-medium text-sm">{member.name}</span>
                  {member.birthYear && (
                    <span className="text-xs text-gray-400">
                      ({new Date().getFullYear() - member.birthYear} ans)
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {REACTIONS.map((reaction) => {
                    const Icon = reaction.icon
                    const isSelected = member.reaction?.reaction === reaction.value
                    const isLoading = saving === member.id

                    return (
                      <button
                        key={reaction.value}
                        onClick={() => handleReaction(member.id, reaction.value)}
                        disabled={isLoading}
                        className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-all ${
                          isSelected
                            ? `${reaction.selectedBg} ring-2 ring-offset-1 ${reaction.ringColor}`
                            : "bg-gray-50 hover:bg-gray-100"
                        } ${isLoading ? "opacity-50" : ""}`}
                      >
                        {isLoading && saving === member.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Icon className={`h-3.5 w-3.5 ${isSelected ? reaction.color : "text-gray-400"}`} />
                        )}
                        <span className={isSelected ? `font-medium ${reaction.color}` : ""}>{reaction.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Show prompt if no reactions yet */}
        {membersWithReactions.length === 0 && !expanded && (
          <p className="text-sm text-gray-500">
            Cliquez sur &quot;Ajouter réaction&quot; pour noter comment vos enfants ont réagi à ce contenu.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
