"use client"

import { useState, useEffect } from "react"
import { Star, User, GraduationCap, Baby, Users, Loader2 } from "lucide-react"
import { getMemberAge } from "@/lib/age-utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { cn } from "@/lib/utils"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { useSession } from "next-auth/react"

interface ReviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mediaId: string
  mediaTitle: string
  onSuccess?: () => void
}

type Role = "PARENT" | "KID" | "EDUCATOR"

interface FamilyMember {
  id: string
  name: string
  avatarEmoji: string
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  birthYear?: number | null
  birthMonth?: number | null
}

const roleOptions: { value: Role; label: string; icon: typeof User }[] = [
  { value: "PARENT", label: "Parent", icon: User },
  { value: "KID", label: "Enfant", icon: Baby },
  { value: "EDUCATOR", label: "Éducateur", icon: GraduationCap },
]

const ageOptions = [
  { value: 2, label: "2+" },
  { value: 4, label: "4+" },
  { value: 6, label: "6+" },
  { value: 8, label: "8+" },
  { value: 10, label: "10+" },
  { value: 12, label: "12+" },
  { value: 14, label: "14+" },
  { value: 16, label: "16+" },
  { value: 18, label: "18+" },
]

export function ReviewModal({
  open,
  onOpenChange,
  mediaId,
  mediaTitle,
  onSuccess,
}: ReviewModalProps) {
  const { data: session } = useSession()
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [role, setRole] = useState<Role>("PARENT")
  const [ageSuggestion, setAgeSuggestion] = useState<number | null>(null)
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Family member selection
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [selectedFamilyMember, setSelectedFamilyMember] = useState<string | null>(null)
  const [, setLoadingFamily] = useState(false)

  // Load family members when modal opens
  useEffect(() => {
    if (open && session?.user) {
      loadFamilyMembers()
    }
  }, [open, session])

  const loadFamilyMembers = async () => {
    setLoadingFamily(true)
    try {
      const res = await fetch("/api/user/family")
      if (res.ok) {
        const data = await res.json()
        setFamilyMembers(data.members || [])
      }
    } catch {
      // Silent fail - family members are optional
    } finally {
      setLoadingFamily(false)
    }
  }

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Veuillez donner une note")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/user/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId,
          rating,
          role,
          ageSuggestion,
          comment: comment.trim() || null,
          familyMemberId: selectedFamilyMember,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Erreur lors de l'envoi")
      }

      // Reset form
      setRating(0)
      setRole("PARENT")
      setAgeSuggestion(null)
      setComment("")
      setSelectedFamilyMember(null)
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get display info for reviewer
  const getReviewerDisplay = () => {
    if (selectedFamilyMember) {
      const member = familyMembers.find(m => m.id === selectedFamilyMember)
      if (member) {
        return { name: member.name, member }
      }
    }
    return { name: session?.user?.name || "Vous", member: null }
  }

  const reviewerDisplay = getReviewerDisplay()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Donner mon avis</DialogTitle>
          <p className="text-sm text-muted-foreground">{mediaTitle}</p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Who is reviewing? - Only show if family members exist */}
          {familyMembers.length > 0 && (
            <div className="space-y-2">
              <Label className="text-base font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Qui donne cet avis ?
              </Label>
              <div className="flex flex-wrap gap-2">
                {/* Account owner option */}
                <button
                  type="button"
                  onClick={() => setSelectedFamilyMember(null)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-full border transition-colors text-sm",
                    selectedFamilyMember === null
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-input"
                  )}
                >
                  <span className="text-lg">👤</span>
                  <span>{session?.user?.name || "Moi"}</span>
                </button>

                {/* Family members */}
                {familyMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedFamilyMember(member.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-full border transition-colors text-sm",
                      selectedFamilyMember === member.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-input"
                    )}
                  >
                    <MemberAvatar
                      avatarStyle={member.avatarStyle ?? null}
                      avatarSeed={member.avatarSeed ?? null}
                      avatarOptions={member.avatarOptions ?? null}
                      avatarEmoji={member.avatarEmoji ?? null}
                      name={member.name}
                      size={20}
                    />
                    <span>{member.name}</span>
                    {member.birthYear && (
                      <span className="text-xs opacity-70">
                        ({getMemberAge(member.birthYear, member.birthMonth)} ans)
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                L&apos;avis sera publié au nom de : {reviewerDisplay.member && <MemberAvatar
                  avatarStyle={reviewerDisplay.member.avatarStyle ?? null}
                  avatarSeed={reviewerDisplay.member.avatarSeed ?? null}
                  avatarOptions={reviewerDisplay.member.avatarOptions ?? null}
                  avatarEmoji={reviewerDisplay.member.avatarEmoji ?? null}
                  name={reviewerDisplay.member.name}
                  size={16}
                  className="inline-block align-middle"
                />} <strong>{reviewerDisplay.name}</strong>
              </p>
            </div>
          )}

          {/* Rating */}
          <div className="space-y-2">
            <Label className="text-base font-medium">Ma note *</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHoveredRating(value)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1 focus:outline-none focus:ring-2 focus:ring-primary rounded"
                >
                  <Star
                    className={cn(
                      "h-8 w-8 transition-colors",
                      (hoveredRating || rating) >= value
                        ? "fill-amber-400 text-amber-400"
                        : "text-gray-300"
                    )}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-2 text-lg font-medium">{rating}/5</span>
              )}
            </div>
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label className="text-base font-medium">Je suis</Label>
            <div className="flex flex-wrap gap-2">
              {roleOptions.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full border transition-colors",
                      role === option.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-input"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Age Suggestion */}
          <div className="space-y-2">
            <Label className="text-base font-medium">
              Âge minimum recommandé
            </Label>
            <p className="text-sm text-muted-foreground">
              Selon vous, à partir de quel âge ce contenu est-il approprié ?
            </p>
            <div className="flex flex-wrap gap-2">
              {ageOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setAgeSuggestion(
                      ageSuggestion === option.value ? null : option.value
                    )
                  }
                  className={cn(
                    "px-4 py-2 rounded-full border transition-colors",
                    ageSuggestion === option.value
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-background hover:bg-muted border-input"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comment with Rich Text Editor */}
          <div className="space-y-2">
            <Label className="text-base font-medium">
              Mon commentaire (optionnel)
            </Label>
            <RichTextEditor
              value={comment}
              onChange={setComment}
              placeholder="Partagez votre expérience avec ce contenu..."
              rows={4}
              maxLength={2000}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi...
                </>
              ) : (
                "Publier mon avis"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
