"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { Loader2, Check, Plus, Sparkles, Film, ListOrdered } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatAgeFromBirthYear } from "@/lib/utils"
import { FamilyHero } from "@/components/profile/FamilyHero"
import { FamilyMemberCard } from "@/components/profile/FamilyMemberCard"
import { AccountSettings } from "@/components/profile/AccountSettings"
import { AvatarPicker, defaultAvatarValue, type AvatarValue } from "@/components/ui/AvatarPicker"
import { FamilyRecommendationsSection } from "@/components/chez-vous/FamilyRecommendationsSection"
import { FamilyMovieNightSection } from "@/components/chez-vous/FamilyMovieNightSection"
import { UserListsPreview } from "@/components/chez-vous/UserListsPreview"

interface UserStats {
  reviews: number
  favorites: number
  watchlist: number
  familyMembers: number
  reactions: number
  memberSince: string
}

interface FamilyMemberData {
  id: string
  name: string
  birthYear: number | null
  birthMonth: number | null
  avatarEmoji: string
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  favoriteGenres?: string[]
  dislikedGenres?: string[]
  sensitivityViolence?: number
  sensitivityScary?: number
  sensitivitySexual?: number
  sensitivityLanguage?: number
  sensitivitySubstances?: number
  preferPositiveMessages?: number
  preferRoleModels?: number
  preferEducational?: number
  interests?: string[]
  avoidTopics?: string[]
  useCustomSettings?: boolean
  createdAt: string
  updatedAt: string
  reactions: Array<{
    id: string
    reaction: string
    media: {
      id: string
      title: string
      posterUrl: string | null
      type: string
      expertAgeRec: number | null
    }
  }>
  _count: {
    reactions: number
  }
}

export default function ProfilPage() {
  const { data: session, status, update } = useSession()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [, setLoadingStats] = useState(true)
  const [members, setMembers] = useState<FamilyMemberData[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)

  // User avatar state (fetched from DB, not session)
  const [userAvatar, setUserAvatar] = useState<{ style?: string | null; seed?: string | null; options?: Record<string, unknown> | null }>({})

  // Profile edit state
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [profileName, setProfileName] = useState("")
  const [profileAvatarValue, setProfileAvatarValue] = useState<AvatarValue>(defaultAvatarValue())
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  // Member edit/add state
  const [memberDialogOpen, setMemberDialogOpen] = useState(false)
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [memberName, setMemberName] = useState("")
  const [memberBirthYear, setMemberBirthYear] = useState("")
  const [memberBirthMonth, setMemberBirthMonth] = useState("")
  const [memberAvatarValue, setMemberAvatarValue] = useState<AvatarValue>(defaultAvatarValue())
  const [savingMember, setSavingMember] = useState(false)

  const router = useRouter()
  const memberRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const userId = session?.user?.id

  // Fetch stats (once on mount)
  useEffect(() => {
    if (!userId) return
    fetch("/api/user/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setStats(data) })
      .catch(() => {})
      .finally(() => setLoadingStats(false))
  }, [userId])

  // Fetch family members
  const fetchMembers = async () => {
    try {
      const res = await fetch("/api/user/family")
      if (res.ok) {
        const data = await res.json()
        setMembers(data.familyMembers ?? [])
      }
    } catch (err) {
      console.error("Failed to fetch members:", err)
    } finally {
      setLoadingMembers(false)
    }
  }

  useEffect(() => {
    if (userId) fetchMembers()
  }, [userId])

  // Fetch user profile (avatar + name) from DB
  useEffect(() => {
    if (!userId) return
    if (session?.user?.name) queueMicrotask(() => setProfileName(session.user.name!))
    fetch("/api/user/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.user) {
          setUserAvatar({
            style: data.user.avatarStyle,
            seed: data.user.avatarSeed,
            options: data.user.avatarOptions,
          })
          if (data.user.avatarStyle && data.user.avatarSeed) {
            setProfileAvatarValue({
              style: data.user.avatarStyle,
              seed: data.user.avatarSeed,
              options: data.user.avatarOptions ?? undefined,
            })
          }
        }
      })
      .catch(() => {})
  }, [userId, session?.user?.name])

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="animate-pulse space-y-6">
          <div className="h-48 bg-gray-200 rounded-2xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="h-72 bg-gray-200 rounded-xl" />
            <div className="h-72 bg-gray-200 rounded-xl" />
            <div className="h-72 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    router.replace("/connexion")
    return (
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="animate-pulse space-y-6">
          <div className="h-48 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    )
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    setProfileSaved(false)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName,
          avatarStyle: profileAvatarValue.style,
          avatarSeed: profileAvatarValue.seed,
          avatarOptions: profileAvatarValue.options ?? null,
        }),
      })
      if (res.ok) {
        setProfileSaved(true)
        setUserAvatar({
          style: profileAvatarValue.style,
          seed: profileAvatarValue.seed,
          options: profileAvatarValue.options ?? null,
        })
        // Update session name without full page reload
        if (profileName !== session.user.name) {
          update()
        }
        setTimeout(() => {
          setEditProfileOpen(false)
          setProfileSaved(false)
        }, 1000)
      }
    } catch (err) {
      console.error("Failed to save profile:", err)
    } finally {
      setSavingProfile(false)
    }
  }

  const handleMemberClick = (memberId: string) => {
    const el = memberRefs.current[memberId]
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }

  const handleDeleteMember = async (id: string) => {
    if (!confirm("Supprimer ce membre de la famille ?")) return
    try {
      const res = await fetch(`/api/user/family/${id}`, { method: "DELETE" })
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== id))
      }
    } catch (err) {
      console.error("Error deleting member:", err)
    }
  }

  const openAddMemberDialog = () => {
    setEditingMemberId(null)
    setMemberName("")
    setMemberBirthYear("")
    setMemberBirthMonth("")
    setMemberAvatarValue(defaultAvatarValue())
    setMemberDialogOpen(true)
  }

  const openEditMemberDialog = (member: FamilyMemberData) => {
    setEditingMemberId(member.id)
    setMemberName(member.name)
    setMemberBirthYear(member.birthYear?.toString() || "")
    setMemberBirthMonth(member.birthMonth?.toString() || "")
    if (member.avatarStyle && member.avatarSeed) {
      setMemberAvatarValue({
        style: member.avatarStyle,
        seed: member.avatarSeed,
        options: member.avatarOptions ?? undefined,
      })
    } else {
      setMemberAvatarValue(defaultAvatarValue())
    }
    setMemberDialogOpen(true)
  }

  const handleSaveMember = async () => {
    if (!memberName.trim()) return
    setSavingMember(true)
    try {
      const url = editingMemberId
        ? `/api/user/family/${editingMemberId}`
        : "/api/user/family"
      const method = editingMemberId ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: memberName.trim(),
          birthYear: memberBirthYear || undefined,
          birthMonth: memberBirthMonth || undefined,
          avatarStyle: memberAvatarValue.style,
          avatarSeed: memberAvatarValue.seed,
          avatarOptions: memberAvatarValue.options ?? null,
        }),
      })

      if (res.ok) {
        await fetchMembers()
        setMemberDialogOpen(false)
      }
    } catch (err) {
      console.error("Error saving member:", err)
    } finally {
      setSavingMember(false)
    }
  }

  const currentYear = new Date().getFullYear()

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12 max-w-6xl space-y-8">
      {/* ================================================================ */}
      {/* ZONE A: Family Identity Hero                                     */}
      {/* ================================================================ */}
      <FamilyHero
        user={{
          name: session.user.name,
          image: session.user.image,
          avatarStyle: userAvatar.style ?? null,
          avatarSeed: userAvatar.seed ?? null,
          avatarOptions: userAvatar.options ?? null,
        }}
        stats={stats}
        members={members.map((m) => ({
          id: m.id,
          name: m.name,
          avatarEmoji: m.avatarEmoji,
          avatarStyle: m.avatarStyle,
          avatarSeed: m.avatarSeed,
          avatarOptions: m.avatarOptions,
        }))}
        onEditProfile={() => setEditProfileOpen(true)}
        onMemberClick={handleMemberClick}
      />

      {/* Edit Profile Dialog */}
      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Modifier le profil</DialogTitle>
            <DialogDescription>
              Personnalisez votre profil familial
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Name + Email first (always visible) */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profileName">Nom d&apos;affichage</Label>
                <Input
                  id="profileName"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Votre nom ou pseudo"
                  autoFocus
                />
                <p className="text-xs text-gray-400">
                  Affiché sur vos avis et commentaires
                </p>
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
              </div>
            </div>

            {/* Avatar */}
            <div className="space-y-2">
              <Label>Avatar</Label>
              <AvatarPicker value={profileAvatarValue} onChange={setProfileAvatarValue} />
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

      {/* ================================================================ */}
      {/* ZONE B: Family Members (Card Grid)                               */}
      {/* ================================================================ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Mon foyer</h2>
          <Button onClick={openAddMemberDialog} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Ajouter
          </Button>
        </div>

        {loadingMembers ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-72 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : members.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {members.map((member) => (
              <div
                key={member.id}
                ref={(el) => { memberRefs.current[member.id] = el }}
              >
                <FamilyMemberCard
                  member={member}
                  onEdit={() => openEditMemberDialog(member)}
                  onDelete={() => handleDeleteMember(member.id)}
                />
              </div>
            ))}

            {/* Add member card */}
            <button
              onClick={openAddMemberDialog}
              className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-violet-300 hover:bg-violet-50/30 transition-all min-h-[200px] group"
            >
              <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-violet-100 flex items-center justify-center transition-colors">
                <Plus className="h-6 w-6 text-gray-400 group-hover:text-violet-500 transition-colors" />
              </div>
              <span className="text-sm text-gray-500 group-hover:text-violet-600 transition-colors">
                Ajouter un membre
              </span>
            </button>
          </div>
        ) : (
          <button
            onClick={openAddMemberDialog}
            className="w-full text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-300 hover:bg-violet-50/30 transition-all"
          >
            <Plus className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Ajoutez les membres de votre foyer</p>
            <p className="text-gray-400 text-sm mt-1">
              Pour recevoir des recommandations personnalisées
            </p>
          </button>
        )}
      </section>

      {/* Member Add/Edit Dialog */}
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>
              {editingMemberId ? "Modifier le membre" : "Nouveau membre"}
            </DialogTitle>
            <DialogDescription>
              {editingMemberId
                ? "Modifiez le nom, l'avatar ou l'année de naissance"
                : "Ajoutez un membre de votre foyer pour des recommandations personnalisées"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="memberName">Prénom</Label>
                <Input
                  id="memberName"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Ex: Emma"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="memberBirthYear">Naissance</Label>
                <div className="flex gap-2">
                  <select
                    id="memberBirthMonth"
                    value={memberBirthMonth}
                    onChange={(e) => setMemberBirthMonth(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Mois</option>
                    {["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"].map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <Input
                    id="memberBirthYear"
                    type="number"
                    min="1920"
                    max={currentYear}
                    value={memberBirthYear}
                    onChange={(e) => setMemberBirthYear(e.target.value)}
                    placeholder="Année"
                    className="w-24"
                  />
                </div>
                {memberBirthYear && Number(memberBirthYear) >= 1920 && Number(memberBirthYear) <= currentYear && (
                  <p className="text-xs text-gray-400">
                    {formatAgeFromBirthYear(Number(memberBirthYear), memberBirthMonth ? Number(memberBirthMonth) : null)}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Avatar</Label>
              <AvatarPicker value={memberAvatarValue} onChange={setMemberAvatarValue} />
            </div>

            <p className="text-xs text-gray-400 text-center">
              Vous pourrez modifier cela à tout moment
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveMember}
              disabled={savingMember || !memberName.trim()}
            >
              {savingMember ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* ZONE C: Discovery Tabs                                            */}
      {/* ================================================================ */}
      <section>
        <Tabs defaultValue="recommendations">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="recommendations" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Recommandations</span>
              <span className="sm:hidden">Recos</span>
            </TabsTrigger>
            <TabsTrigger value="movienight" className="gap-1.5">
              <Film className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Soirée Ciné</span>
              <span className="sm:hidden">Ciné</span>
            </TabsTrigger>
            <TabsTrigger value="lists" className="gap-1.5">
              <ListOrdered className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mes listes</span>
              <span className="sm:hidden">Listes</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="recommendations" className="mt-4">
            <FamilyRecommendationsSection />
          </TabsContent>
          <TabsContent value="movienight" className="mt-4">
            <FamilyMovieNightSection />
          </TabsContent>
          <TabsContent value="lists" className="mt-4">
            <UserListsPreview />
          </TabsContent>
        </Tabs>
      </section>

      {/* ================================================================ */}
      {/* ZONE D: Account Settings (Collapsible)                            */}
      {/* ================================================================ */}
      <AccountSettings />
    </div>
  )
}
