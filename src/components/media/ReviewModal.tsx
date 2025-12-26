"use client"

import { useState } from "react"
import { Star, X, User, GraduationCap, Baby } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface ReviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mediaId: string
  mediaTitle: string
  onSuccess?: () => void
}

type Role = "PARENT" | "KID" | "EDUCATOR"

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
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [role, setRole] = useState<Role>("PARENT")
  const [ageSuggestion, setAgeSuggestion] = useState<number | null>(null)
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Donner mon avis</DialogTitle>
          <p className="text-sm text-muted-foreground">{mediaTitle}</p>
        </DialogHeader>

        <div className="space-y-6 py-4">
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

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment" className="text-base font-medium">
              Mon commentaire (optionnel)
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Partagez votre expérience avec ce contenu..."
              rows={4}
              className="resize-none"
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
              {isSubmitting ? "Envoi..." : "Publier mon avis"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
