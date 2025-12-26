"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"
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

interface ReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reviewId: string
  onSuccess?: () => void
}

type ReportReason = "INAPPROPRIATE" | "SPAM" | "HARASSMENT" | "MISINFORMATION" | "OTHER"

const reasonOptions: { value: ReportReason; label: string; description: string }[] = [
  {
    value: "INAPPROPRIATE",
    label: "Contenu inapproprié",
    description: "Langage vulgaire, contenu adulte, etc.",
  },
  {
    value: "SPAM",
    label: "Spam",
    description: "Publicité, contenu répétitif, hors sujet",
  },
  {
    value: "HARASSMENT",
    label: "Harcèlement",
    description: "Attaques personnelles, menaces, intimidation",
  },
  {
    value: "MISINFORMATION",
    label: "Désinformation",
    description: "Informations fausses ou trompeuses",
  },
  {
    value: "OTHER",
    label: "Autre",
    description: "Autre raison non listée",
  },
]

export function ReportModal({
  open,
  onOpenChange,
  reviewId,
  onSuccess,
}: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    if (!reason) {
      setError("Veuillez sélectionner une raison")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/user/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId,
          reason,
          details: details.trim() || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Erreur lors du signalement")
      }

      setSuccess(true)
      setTimeout(() => {
        setReason(null)
        setDetails("")
        setSuccess(false)
        onOpenChange(false)
        onSuccess?.()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du signalement")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Signaler ce commentaire
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              Signalement envoyé
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Merci pour votre signalement. Notre équipe va examiner ce commentaire.
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Reason selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">
                Pourquoi signalez-vous ce commentaire ? *
              </Label>
              <div className="space-y-2">
                {reasonOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setReason(option.value)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-colors",
                      reason === option.value
                        ? "bg-primary/10 border-primary"
                        : "bg-background hover:bg-muted border-input"
                    )}
                  >
                    <p className="font-medium">{option.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-2">
              <Label htmlFor="details" className="text-base font-medium">
                Détails supplémentaires (optionnel)
              </Label>
              <Textarea
                id="details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Décrivez le problème en détail..."
                rows={3}
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
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !reason}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {isSubmitting ? "Envoi..." : "Envoyer le signalement"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
