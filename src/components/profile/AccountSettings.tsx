"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, Eye, EyeOff, AlertTriangle, Loader2, Settings } from "lucide-react"
import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useSettings } from "@/contexts/SettingsContext"
import { cn } from "@/lib/utils"

export function AccountSettings() {
  const [isOpen, setIsOpen] = useState(false)
  const { settings, updateSettings } = useSettings()
  const router = useRouter()

  // Delete account state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  return (
    <Card className="border-gray-200/50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50/50 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-gray-400" />
          <span className="font-medium text-gray-700">Paramètres du compte</span>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <CardContent className="pt-0 pb-5 px-5 space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium flex items-center gap-2 text-sm">
                {settings.blur18Plus ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-gray-500" />}
                Flouter les contenus sensibles
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Les affiches des contenus violents ou réservés aux 16+ seront floutées</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.blur18Plus}
              onClick={() => updateSettings({ blur18Plus: !settings.blur18Plus })}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                settings.blur18Plus ? "bg-primary" : "bg-gray-200"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                  settings.blur18Plus ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium text-sm">Gestion des cookies</p>
              <p className="text-xs text-gray-500 mt-0.5">Modifier vos préférences de cookies</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/cookies">Gérer</Link>
            </Button>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-red-600 text-sm">Supprimer mon compte</p>
              <p className="text-xs text-gray-500 mt-0.5">Cette action est irréversible</p>
            </div>
            <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
              setDeleteDialogOpen(open)
              if (!open) {
                setDeleteConfirmText("")
                setDeleteError("")
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                  Supprimer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                    Supprimer votre compte
                  </DialogTitle>
                  <DialogDescription>
                    Cette action est <strong>définitive et irréversible</strong>. Toutes vos données seront supprimées :
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li>Votre profil et informations personnelles</li>
                    <li>Vos membres de famille et leurs réactions</li>
                    <li>Vos favoris et liste à voir</li>
                    <li>Tous vos avis et commentaires</li>
                  </ul>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">
                      Pour confirmer, tapez <strong>SUPPRIMER</strong> ci-dessous :
                    </p>
                    <Input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="SUPPRIMER"
                      className="mt-2"
                      disabled={deleting}
                    />
                  </div>
                  {deleteError && (
                    <p className="text-sm text-red-600">{deleteError}</p>
                  )}
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
                    Annuler
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={deleteConfirmText !== "SUPPRIMER" || deleting}
                    onClick={async () => {
                      setDeleting(true)
                      setDeleteError("")
                      try {
                        const res = await fetch("/api/user/delete", { method: "DELETE" })
                        if (res.ok) {
                          await signOut({ redirect: false })
                          router.push("/?deleted=true")
                        } else {
                          const data = await res.json()
                          setDeleteError(data.error || "Erreur lors de la suppression")
                        }
                      } catch {
                        setDeleteError("Erreur de connexion au serveur")
                      } finally {
                        setDeleting(false)
                      }
                    }}
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Suppression...
                      </>
                    ) : (
                      "Supprimer définitivement"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
