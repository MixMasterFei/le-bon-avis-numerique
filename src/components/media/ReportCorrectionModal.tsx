"use client"

import { useState } from "react"
import { AlertTriangle, Send, X, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"

interface ReportCorrectionModalProps {
  mediaId: string
  mediaTitle: string
  isLoggedIn: boolean
}

const CORRECTION_TYPES = [
  { value: "WRONG_INFO", label: "Information incorrecte", description: "Une information affichée est fausse" },
  { value: "MISSING_INFO", label: "Information manquante", description: "Il manque des informations importantes" },
  { value: "AGE_RATING", label: "Recommandation d'âge incorrecte", description: "L'âge recommandé ne semble pas adapté" },
  { value: "CONTENT_WARNING", label: "Avertissement de contenu manquant", description: "Un avertissement important manque" },
  { value: "BROKEN_LINK", label: "Lien ou image cassé", description: "Un lien ou une image ne fonctionne plus" },
  { value: "DUPLICATE", label: "Doublon", description: "Ce média existe déjà dans la base" },
  { value: "OTHER", label: "Autre", description: "Autre type de problème" },
]

const FIELD_OPTIONS = [
  { value: "title", label: "Titre" },
  { value: "synopsis", label: "Synopsis" },
  { value: "age_rating", label: "Recommandation d'âge" },
  { value: "release_date", label: "Date de sortie" },
  { value: "director", label: "Réalisateur" },
  { value: "genres", label: "Genres" },
  { value: "duration", label: "Durée" },
  { value: "poster", label: "Affiche/Image" },
  { value: "platforms", label: "Plateformes de streaming" },
  { value: "content_metrics", label: "Indicateurs de contenu" },
  { value: "other", label: "Autre" },
]

export function ReportCorrectionModal({ mediaId, mediaTitle, isLoggedIn }: ReportCorrectionModalProps) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState("")
  const [field, setField] = useState("")
  const [currentValue, setCurrentValue] = useState("")
  const [suggestedValue, setSuggestedValue] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!type) {
      setError("Veuillez sélectionner le type de correction")
      return
    }
    if (!description || description.trim().length < 10) {
      setError("Veuillez décrire le problème (minimum 10 caractères)")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId,
          type,
          field: field || null,
          currentValue: currentValue || null,
          suggestedValue: suggestedValue || null,
          description: description.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'envoi")
      }

      setSuccess(true)
      // Reset form after 3 seconds
      setTimeout(() => {
        setOpen(false)
        setSuccess(false)
        setType("")
        setField("")
        setCurrentValue("")
        setSuggestedValue("")
        setDescription("")
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi")
    } finally {
      setLoading(false)
    }
  }

  const selectedType = CORRECTION_TYPES.find(t => t.value === type)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-amber-600 border-amber-300 hover:bg-amber-50">
          <AlertTriangle className="h-4 w-4 mr-2" />
          Signaler une erreur
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Signaler une erreur
          </DialogTitle>
          <DialogDescription>
            Signalez une erreur ou une correction pour <strong>{mediaTitle}</strong>
          </DialogDescription>
        </DialogHeader>

        {!isLoggedIn ? (
          <div className="py-6 text-center">
            <p className="text-gray-600 mb-4">
              Vous devez être connecté pour signaler une erreur.
            </p>
            <Button asChild>
              <a href="/connexion">Se connecter</a>
            </Button>
          </div>
        ) : success ? (
          <div className="py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-700 mb-2">
              Merci pour votre signalement !
            </h3>
            <p className="text-gray-600">
              Notre équipe va examiner votre rapport et apporter les corrections nécessaires.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Type de correction */}
            <div className="space-y-2">
              <Label htmlFor="type">Type de problème *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez le type..." />
                </SelectTrigger>
                <SelectContent>
                  {CORRECTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedType && (
                <p className="text-xs text-gray-500">{selectedType.description}</p>
              )}
            </div>

            {/* Champ concerné (optionnel) */}
            {(type === "WRONG_INFO" || type === "MISSING_INFO") && (
              <div className="space-y-2">
                <Label htmlFor="field">Champ concerné</Label>
                <Select value={field} onValueChange={setField}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez le champ..." />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Valeur actuelle (optionnel) */}
            {type === "WRONG_INFO" && (
              <div className="space-y-2">
                <Label htmlFor="currentValue">Valeur actuelle (incorrecte)</Label>
                <Input
                  id="currentValue"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  placeholder="Ce qui est affiché actuellement..."
                />
              </div>
            )}

            {/* Valeur suggérée (optionnel) */}
            {(type === "WRONG_INFO" || type === "MISSING_INFO" || type === "AGE_RATING") && (
              <div className="space-y-2">
                <Label htmlFor="suggestedValue">
                  {type === "AGE_RATING" ? "Âge recommandé selon vous" : "Valeur correcte / Information à ajouter"}
                </Label>
                <Input
                  id="suggestedValue"
                  value={suggestedValue}
                  onChange={(e) => setSuggestedValue(e.target.value)}
                  placeholder={type === "AGE_RATING" ? "Ex: 8 ans" : "La valeur correcte..."}
                />
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description du problème *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez le problème en détail..."
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-gray-500">
                Minimum 10 caractères. Soyez aussi précis que possible.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  "Envoi en cours..."
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Envoyer le signalement
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
