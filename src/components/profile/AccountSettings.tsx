"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, Eye, EyeOff, AlertTriangle, Loader2, Settings } from "lucide-react"
import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
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
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

export function AccountSettings() {
  const p = APERCU_PALETTE
  const [isOpen, setIsOpen] = useState(false)
  const { settings, updateSettings } = useSettings()
  const router = useRouter()

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left transition-colors hover:opacity-80"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4" style={{ color: p.ink2 }} />
          <span className="font-medium" style={{ color: p.ink }}>
            Paramètres du compte
          </span>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
          style={{ color: p.ink2 }}
        />
      </button>

      {isOpen && (
        <div className="pt-0 pb-5 px-5 space-y-4">
          <div
            className="flex items-center justify-between py-3"
            style={{ borderBottom: `1px solid ${p.line}` }}
          >
            <div>
              <p className="font-medium flex items-center gap-2 text-sm" style={{ color: p.ink }}>
                {settings.blur18Plus ? (
                  <EyeOff className="h-4 w-4" style={{ color: p.ink2 }} />
                ) : (
                  <Eye className="h-4 w-4" style={{ color: p.ink2 }} />
                )}
                Flouter les contenus sensibles
              </p>
              <p className="text-xs mt-0.5" style={{ color: p.ink2 }}>
                Les affiches des contenus violents ou réservés aux 16+ seront
                floutées
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.blur18Plus}
              onClick={() => updateSettings({ blur18Plus: !settings.blur18Plus })}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none"
              style={{
                background: settings.blur18Plus ? p.ink : p.bg2,
              }}
            >
              <span
                className="pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-lg ring-0 transition duration-200 ease-in-out"
                style={{
                  background: p.card,
                  transform: settings.blur18Plus
                    ? "translateX(1.25rem)"
                    : "translateX(0)",
                }}
              />
            </button>
          </div>

          <div
            className="flex items-center justify-between py-3"
            style={{ borderBottom: `1px solid ${p.line}` }}
          >
            <div>
              <p className="font-medium text-sm" style={{ color: p.ink }}>
                Gestion des cookies
              </p>
              <p className="text-xs mt-0.5" style={{ color: p.ink2 }}>
                Modifier vos préférences de cookies
              </p>
            </div>
            <Link
              href="/cookies"
              className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
              style={{
                background: "transparent",
                color: p.ink,
                border: `1px solid ${p.line2}`,
              }}
            >
              Gérer
            </Link>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-sm" style={{ color: p.accent }}>
                Supprimer mon compte
              </p>
              <p className="text-xs mt-0.5" style={{ color: p.ink2 }}>
                Cette action est irréversible
              </p>
            </div>
            <Dialog
              open={deleteDialogOpen}
              onOpenChange={(open) => {
                setDeleteDialogOpen(open)
                if (!open) {
                  setDeleteConfirmText("")
                  setDeleteError("")
                }
              }}
            >
              <DialogTrigger asChild>
                <button
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{
                    background: "transparent",
                    color: p.accent,
                    border: `1px solid ${p.accent}`,
                  }}
                >
                  Supprimer
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle
                    className="flex items-center gap-2"
                    style={{ color: p.accent }}
                  >
                    <AlertTriangle className="h-5 w-5" />
                    Supprimer votre compte
                  </DialogTitle>
                  <DialogDescription>
                    Cette action est <strong>définitive et irréversible</strong>.
                    Toutes vos données seront supprimées :
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <ul
                    className="text-sm space-y-1 list-disc list-inside"
                    style={{ color: p.ink2 }}
                  >
                    <li>Votre profil et informations personnelles</li>
                    <li>Vos membres de famille et leurs réactions</li>
                    <li>Vos favoris et liste à voir</li>
                    <li>Tous vos avis et commentaires</li>
                  </ul>
                  <div
                    className="rounded-lg p-3"
                    style={{
                      background: "rgba(209, 106, 74, 0.08)",
                      border: `1px solid ${p.accent}`,
                    }}
                  >
                    <p className="text-sm" style={{ color: p.ink }}>
                      Pour confirmer, tapez{" "}
                      <strong>SUPPRIMER</strong> ci-dessous :
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
                    <p className="text-sm" style={{ color: p.accent }}>
                      {deleteError}
                    </p>
                  )}
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <button
                    onClick={() => setDeleteDialogOpen(false)}
                    disabled={deleting}
                    className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{
                      background: "transparent",
                      color: p.ink,
                      border: `1px solid ${p.line2}`,
                    }}
                  >
                    Annuler
                  </button>
                  <button
                    disabled={deleteConfirmText !== "SUPPRIMER" || deleting}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ background: p.accent, color: "#fff" }}
                    onClick={async () => {
                      setDeleting(true)
                      setDeleteError("")
                      try {
                        const res = await fetch("/api/user/delete", {
                          method: "DELETE",
                        })
                        if (res.ok) {
                          await signOut({ redirect: false })
                          router.push("/?deleted=true")
                        } else {
                          const data = await res.json()
                          setDeleteError(
                            data.error || "Erreur lors de la suppression"
                          )
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
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}
    </div>
  )
}
