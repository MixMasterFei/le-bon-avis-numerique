"use client"

import { useState, useEffect } from "react"
import { Loader2, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface UserMetricsModalProps {
  open: boolean
  onClose: () => void
  mediaId: string
  mediaTitle: string
  onSubmit?: () => void
}

interface MetricConfig {
  key: string
  label: string
  description: string
  isPositive?: boolean
}

const METRICS: MetricConfig[] = [
  {
    key: "violence",
    label: "Violence",
    description: "Violence physique ou verbale (0 = aucune, 5 = extreme)",
  },
  {
    key: "sexNudity",
    label: "Sexe/Nudite",
    description: "Contenu sexuel ou nudite (0 = aucun, 5 = explicite)",
  },
  {
    key: "language",
    label: "Langage",
    description: "Langage grossier ou inapproprie (0 = aucun, 5 = constant)",
  },
  {
    key: "consumerism",
    label: "Consumerisme",
    description: "Messages commerciaux ou materialistes (0 = aucun, 5 = omni-present)",
  },
  {
    key: "substanceUse",
    label: "Substances",
    description: "Alcool, tabac ou drogues (0 = aucun, 5 = encourage)",
  },
  {
    key: "positiveMessages",
    label: "Messages positifs",
    description: "Valeurs positives transmises (0 = aucun, 5 = excellent)",
    isPositive: true,
  },
  {
    key: "roleModels",
    label: "Modèles positifs",
    description: "Bons exemples de comportement (0 = aucun, 5 = excellent)",
    isPositive: true,
  },
]

export function UserMetricsModal({
  open,
  onClose,
  mediaId,
  mediaTitle,
  onSubmit,
}: UserMetricsModalProps) {
  const [values, setValues] = useState<Record<string, number>>({
    violence: 0,
    sexNudity: 0,
    language: 0,
    consumerism: 0,
    substanceUse: 0,
    positiveMessages: 0,
    roleModels: 0,
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasExisting, setHasExisting] = useState(false)

  // Load existing user metrics
  useEffect(() => {
    const fetchExisting = async () => {
      if (!open) return

      setLoading(true)
      try {
        const res = await fetch(`/api/user/content-metrics?mediaId=${mediaId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.hasSubmitted && data.metrics) {
            setValues({
              violence: data.metrics.violence,
              sexNudity: data.metrics.sexNudity,
              language: data.metrics.language,
              consumerism: data.metrics.consumerism,
              substanceUse: data.metrics.substanceUse,
              positiveMessages: data.metrics.positiveMessages,
              roleModels: data.metrics.roleModels,
            })
            setHasExisting(true)
          }
        }
      } catch (err) {
        console.error("Failed to fetch existing metrics:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchExisting()
  }, [open, mediaId])

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/user/content-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId,
          ...values,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        onSubmit?.()
        onClose()
      } else {
        setError(data.error || "Erreur lors de l'enregistrement")
      }
    } catch (err) {
      setError("Erreur de connexion")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setError(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Evaluer le contenu</DialogTitle>
          <DialogDescription>
            {hasExisting
              ? `Modifier votre evaluation de "${mediaTitle}"`
              : `Evaluer "${mediaTitle}" pour aider les autres parents`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <TooltipProvider>
              {METRICS.map((metric) => (
                <div key={metric.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">{metric.label}</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{metric.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span
                      className={`text-sm font-bold ${
                        metric.isPositive
                          ? values[metric.key] >= 3
                            ? "text-green-600"
                            : "text-gray-500"
                          : values[metric.key] >= 3
                          ? "text-red-600"
                          : values[metric.key] >= 2
                          ? "text-orange-500"
                          : "text-green-600"
                      }`}
                    >
                      {values[metric.key]}
                    </span>
                  </div>
                  <Slider
                    value={[values[metric.key]]}
                    onValueChange={([value]) =>
                      setValues((prev) => ({ ...prev, [metric.key]: value }))
                    }
                    min={0}
                    max={5}
                    step={1}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>0</span>
                    <span>5</span>
                  </div>
                </div>
              ))}
            </TooltipProvider>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : hasExisting ? (
                  "Mettre a jour"
                ) : (
                  "Envoyer"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
