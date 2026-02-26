"use client"

import { useSession, signOut } from "next-auth/react"
import { redirect, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { User, Mail, Calendar, Shield, Star, Heart, Bookmark, Users, Loader2, Check, AlertTriangle, Camera, Eye, EyeOff } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FamilyMembers } from "@/components/profile/FamilyMembers"
import { useSettings } from "@/contexts/SettingsContext"
import Link from "next/link"

interface UserStats {
  reviews: number
  favorites: number
  watchlist: number
  familyMembers: number
  reactions: number
  memberSince: string
}

export default function ProfilPage() {
  const { data: session, status, update } = useSession()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  // Profile edit state
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [profileName, setProfileName] = useState("")
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  // Preset avatars for selection
  const avatarOptions = [
    "👨‍👩‍👧‍👦", "👨‍👩‍👦", "👩‍👧", "👨‍👦", "👪",
    "🧑", "👩", "👨", "👧", "👦",
    "🦸", "🦹", "🧙", "🧝", "🧚",
    "🐻", "🦊", "🐱", "🐶", "🦁",
  ]

  // Settings context
  const { settings, updateSettings } = useSettings()

  // Delete account state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const router = useRouter()

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/user/stats")
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err)
      } finally {
        setLoadingStats(false)
      }
    }

    if (session?.user) {
      fetchStats()
    }
  }, [session])

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!session?.user) {
    redirect("/connexion")
  }

  const isAdmin = session.user.role === "ADMIN"

  // Initialize profile data when session loads
  useEffect(() => {
    if (session?.user?.name) {
      setProfileName(session.user.name)
    }
    // Check if image is an emoji (avatar)
    if (session?.user?.image && !session.user.image.startsWith("http")) {
      setSelectedAvatar(session.user.image)
    }
  }, [session])

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    setProfileSaved(false)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName,
          image: selectedAvatar || undefined,
        }),
      })
      if (res.ok) {
        setProfileSaved(true)
        // Trigger session update to refresh the data in the JWT
        await update()
        setTimeout(() => {
          setEditProfileOpen(false)
          setProfileSaved(false)
        }, 1500)
      }
    } catch (err) {
      console.error("Failed to save profile:", err)
    } finally {
      setSavingProfile(false)
    }
  }

  const formatMemberSince = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      {/* Profile Header */}
      <Card className="mb-8">
        <CardContent className="p-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Avatar - emoji or image */}
            {session.user.image && !session.user.image.startsWith("http") ? (
              <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-5xl">
                {session.user.image}
              </div>
            ) : session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || "Profil"}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-12 w-12 text-primary" />
              </div>
            )}

            <div className="text-center sm:text-left flex-1">
              <div className="flex items-center gap-3 justify-center sm:justify-start">
                <h1 className="text-2xl font-bold text-gray-900">
                  {session.user.name || "Utilisateur"}
                </h1>
                {isAdmin && (
                  <Badge className="bg-purple-500">
                    <Shield className="h-3 w-3 mr-1" />
                    Admin
                  </Badge>
                )}
              </div>
              <p className="text-gray-600 flex items-center gap-2 justify-center sm:justify-start mt-1">
                <Mail className="h-4 w-4" />
                {session.user.email}
              </p>
              {stats && (
                <p className="text-sm text-gray-500 flex items-center gap-2 justify-center sm:justify-start mt-1">
                  <Calendar className="h-4 w-4" />
                  Membre depuis {formatMemberSince(stats.memberSince)}
                </p>
              )}
            </div>

            <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Modifier le profil</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Modifier le profil</DialogTitle>
                  <DialogDescription>
                    Modifiez les informations de votre profil
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  {/* Avatar Selection */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      Avatar
                    </Label>
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
                      {avatarOptions.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setSelectedAvatar(emoji)}
                          className={`w-10 h-10 rounded-full text-xl flex items-center justify-center transition-all hover:scale-110 ${
                            selectedAvatar === emoji
                              ? "bg-primary/20 ring-2 ring-primary"
                              : "bg-white hover:bg-gray-100"
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                      {/* Option to clear/use default */}
                      <button
                        type="button"
                        onClick={() => setSelectedAvatar(null)}
                        className={`w-10 h-10 rounded-full text-xs flex items-center justify-center transition-all hover:scale-110 ${
                          selectedAvatar === null
                            ? "bg-primary/20 ring-2 ring-primary"
                            : "bg-white hover:bg-gray-100 border-2 border-dashed border-gray-300"
                        }`}
                        title="Aucun avatar"
                      >
                        <User className="h-5 w-5 text-gray-400" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Choisissez un emoji comme avatar ou laissez vide pour afficher vos initiales
                    </p>
                  </div>

                  {/* Name */}
                  <div className="space-y-2">
                    <Label htmlFor="profileName">Nom d&apos;affichage</Label>
                    <Input
                      id="profileName"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="Votre nom ou pseudo"
                    />
                    <p className="text-xs text-gray-500">
                      Ce nom sera affiché sur vos avis et commentaires
                    </p>
                  </div>

                  {/* Email (read-only) */}
                  <div className="space-y-2">
                    <Label htmlFor="profileEmail">Email</Label>
                    <Input
                      id="profileEmail"
                      type="email"
                      value={session.user.email || ""}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-xs text-gray-500">
                      L&apos;email ne peut pas être modifié
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleSaveProfile}
                    disabled={savingProfile || profileSaved}
                  >
                    {savingProfile ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : profileSaved ? (
                      <Check className="h-4 w-4 mr-2" />
                    ) : null}
                    {profileSaved ? "Enregistré !" : "Enregistrer"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="inline-flex p-3 bg-amber-100 rounded-full mb-3">
              <Star className="h-6 w-6 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {loadingStats ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : stats?.reviews || 0}
            </p>
            <p className="text-sm text-gray-600">Avis</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="inline-flex p-3 bg-red-100 rounded-full mb-3">
              <Heart className="h-6 w-6 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {loadingStats ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : stats?.favorites || 0}
            </p>
            <p className="text-sm text-gray-600">Favoris</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="inline-flex p-3 bg-blue-100 rounded-full mb-3">
              <Bookmark className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {loadingStats ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : stats?.watchlist || 0}
            </p>
            <p className="text-sm text-gray-600">À voir</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="inline-flex p-3 bg-green-100 rounded-full mb-3">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {loadingStats ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : stats?.reactions || 0}
            </p>
            <p className="text-sm text-gray-600">Réactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Family Members */}
      <FamilyMembers />

      {/* Quick Links */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Mes listes</CardTitle>
          <CardDescription>Accédez à vos contenus sauvegardés</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <Link href="/mes-favoris">
              <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="p-3 bg-red-100 rounded-full">
                  <Heart className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="font-medium">Mes favoris</p>
                  <p className="text-sm text-gray-500">{stats?.favorites || 0} contenus</p>
                </div>
              </div>
            </Link>
            <Link href="/ma-liste">
              <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Bookmark className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">Ma liste à voir</p>
                  <p className="text-sm text-gray-500">{stats?.watchlist || 0} contenus</p>
                </div>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Paramètres du compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium flex items-center gap-2">
                {settings.blur18Plus ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-gray-500" />}
                Flouter les contenus sensibles
              </p>
              <p className="text-sm text-gray-500">Les affiches des contenus violents ou réservés aux 16+ seront floutées</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.blur18Plus}
              onClick={() => updateSettings({ blur18Plus: !settings.blur18Plus })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                settings.blur18Plus ? "bg-primary" : "bg-gray-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.blur18Plus ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Gestion des cookies</p>
              <p className="text-sm text-gray-500">Modifier vos préférences de cookies</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/cookies">Gérer</Link>
            </Button>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-red-600">Supprimer mon compte</p>
              <p className="text-sm text-gray-500">Cette action est irréversible</p>
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
                  <Button
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(false)}
                    disabled={deleting}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={deleteConfirmText !== "SUPPRIMER" || deleting}
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
      </Card>
    </div>
  )
}
