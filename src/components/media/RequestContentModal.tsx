"use client"

import { useState } from "react"
import { Loader2, Film, Tv, Gamepad2, BookOpen, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface RequestContentModalProps {
  open: boolean
  onClose: () => void
  defaultTitle?: string
  defaultType?: "MOVIE" | "TV" | "GAME" | "BOOK" | "APP"
  externalId?: string
}

export function RequestContentModal({
  open,
  onClose,
  defaultTitle = "",
  defaultType = "MOVIE",
  externalId,
}: RequestContentModalProps) {
  const [title, setTitle] = useState(defaultTitle)
  const [mediaType, setMediaType] = useState(defaultType)
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Veuillez entrer un titre")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/content-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          mediaType,
          externalId: externalId || undefined,
          description: description.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => {
          setSuccess(false)
          setTitle("")
          setDescription("")
          onClose()
        }, 2000)
      } else {
        setError(data.error || "Erreur lors de l'envoi")
      }
    } catch {
      setError("Erreur de connexion")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setError(null)
    setSuccess(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Demander un contenu</DialogTitle>
          <DialogDescription>
            Demandez l'ajout d'un film, serie ou jeu a notre catalogue
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-lg font-medium text-green-700">Demande envoyee !</p>
            <p className="text-sm text-gray-500 mt-2">
              Notre equipe examinera votre demande.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Media Type */}
            <div className="space-y-2">
              <Label>Type de contenu</Label>
              <Select
                value={mediaType}
                onValueChange={(v) => setMediaType(v as typeof mediaType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MOVIE">
                    <div className="flex items-center gap-2">
                      <Film className="h-4 w-4" />
                      Film
                    </div>
                  </SelectItem>
                  <SelectItem value="TV">
                    <div className="flex items-center gap-2">
                      <Tv className="h-4 w-4" />
                      Serie
                    </div>
                  </SelectItem>
                  <SelectItem value="GAME">
                    <div className="flex items-center gap-2">
                      <Gamepad2 className="h-4 w-4" />
                      Jeu video
                    </div>
                  </SelectItem>
                  <SelectItem value="BOOK">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Livre
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Titre *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Le Roi Lion"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Informations supplementaires</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Annee de sortie, realisateur, plateforme... (optionnel)"
                rows={3}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !title.trim()}
                className="flex-1"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
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
