"use client"

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { useState, useEffect } from "react"
import { User, Mail, Calendar, Shield, Star, Heart, Bookmark, Users, Loader2, Check, Bell, BellOff } from "lucide-react"
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
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  // Email notifications state
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [emailNewsletter, setEmailNewsletter] = useState(true)
  const [emailRecommendations, setEmailRecommendations] = useState(true)
  const [emailComments, setEmailComments] = useState(false)
  const [savingNotifications, setSavingNotifications] = useState(false)
  const [notificationsSaved, setNotificationsSaved] = useState(false)

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

  // Initialize profile name when session loads
  useEffect(() => {
    if (session?.user?.name) {
      setProfileName(session.user.name)
    }
  }, [session])

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    setProfileSaved(false)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileName }),
      })
      if (res.ok) {
        setProfileSaved(true)
        // Trigger session update to refresh the name in the JWT
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

  const handleSaveNotifications = async () => {
    setSavingNotifications(true)
    setNotificationsSaved(false)
    try {
      const res = await fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newsletter: emailNewsletter,
          recommendations: emailRecommendations,
          comments: emailComments,
        }),
      })
      if (res.ok) {
        setNotificationsSaved(true)
        setTimeout(() => {
          setNotificationsOpen(false)
          setNotificationsSaved(false)
        }, 1500)
      }
    } catch (err) {
      console.error("Failed to save notifications:", err)
    } finally {
      setSavingNotifications(false)
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
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || "Profil"}
                className="h-24 w-24 rounded-full"
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
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Modifier le profil</DialogTitle>
                  <DialogDescription>
                    Modifiez les informations de votre profil
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="profileName">Nom</Label>
                    <Input
                      id="profileName"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="Votre nom"
                    />
                  </div>
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
                      L&apos;email ne peut pas etre modifie
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
                    {profileSaved ? "Enregistre!" : "Enregistrer"}
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
            <p className="text-sm text-gray-600">A voir</p>
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
            <p className="text-sm text-gray-600">Reactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Family Members */}
      <FamilyMembers />

      {/* Quick Links */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Mes listes</CardTitle>
          <CardDescription>Accedez a vos contenus sauvegardes</CardDescription>
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
                  <p className="font-medium">Ma liste a voir</p>
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
          <CardTitle>Parametres du compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Notifications par email</p>
              <p className="text-sm text-gray-500">Recevoir les nouveautes et recommandations</p>
            </div>
            <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">Configurer</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Notifications par email</DialogTitle>
                  <DialogDescription>
                    Choisissez les emails que vous souhaitez recevoir
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Bell className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">Newsletter</p>
                        <p className="text-sm text-gray-500">Actualites et nouveautes du site</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailNewsletter}
                      onChange={(e) => setEmailNewsletter(e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Heart className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">Recommandations</p>
                        <p className="text-sm text-gray-500">Suggestions basees sur vos gouts</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailRecommendations}
                      onChange={(e) => setEmailRecommendations(e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">Commentaires</p>
                        <p className="text-sm text-gray-500">Reponses a vos avis</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailComments}
                      onChange={(e) => setEmailComments(e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </label>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleSaveNotifications}
                    disabled={savingNotifications || notificationsSaved}
                  >
                    {savingNotifications ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : notificationsSaved ? (
                      <Check className="h-4 w-4 mr-2" />
                    ) : null}
                    {notificationsSaved ? "Enregistre!" : "Enregistrer"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Gestion des cookies</p>
              <p className="text-sm text-gray-500">Modifier vos preferences de cookies</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/cookies">Gerer</Link>
            </Button>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-red-600">Supprimer mon compte</p>
              <p className="text-sm text-gray-500">Cette action est irreversible</p>
            </div>
            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
              Supprimer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
