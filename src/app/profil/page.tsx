"use client"

import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { Loader2, Check, Plus, Sparkles, Film, ListOrdered } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
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
  // Display family name ("Famille Dupont") — shown in the header + homepage
  // greeting. Empty = fall back to the account name.
  const [profileFamilyName, setProfileFamilyName] = useState("")
  const [profileAvatarValue, setProfileAvatarValue] = useState<AvatarValue>(defaultAvatarValue())
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  // Discovery tab state (bottom of page). The default is
  // "recommendations" but the URL `?tab=lists|movienight|recommendations`
  // can pre-select another, so direct links from the header dropdown
  // (e.g. "À lire plus tard") land on the right tab without an extra
  // click.
  const searchParams = useSearchParams()
  const initialTab: "recommendations" | "movienight" | "lists" = (() => {
    const t = searchParams?.get("tab")
    if (t === "lists" || t === "movienight" || t === "recommendations") return t
    return "recommendations"
  })()
  const [discoveryTab, setDiscoveryTab] = useState<
    "recommendations" | "movienight" | "lists"
  >(initialTab)

  // When user lands with ?tab=… (e.g. clicked "À lire plus tard" in
  // the header dropdown), scroll the discovery section into view so
  // they actually see what they came for instead of the family hero.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!searchParams?.get("tab")) return
    const el = document.getElementById("discovery")
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
    // Run once on mount with whatever ?tab is set; tab changes after
    // mount are user clicks and don't need scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          if (typeof data.user.familyName === "string") {
            setProfileFamilyName(data.user.familyName)
          }
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
          familyName: profileFamilyName.trim() || null,
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
        // Tell the header (and any other listener) about the new family name
        // immediately — no reload needed for « Famille X » to appear top-right.
        window.dispatchEvent(
          new CustomEvent("totem:profile-updated", {
            detail: { familyName: profileFamilyName.trim() || null },
          }),
        )
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
  const p = APERCU_PALETTE
  const serifClass = "font-serif"

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12 max-w-6xl space-y-8" style={{ color: p.ink }}>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            {/* Family display name */}
            <div className="space-y-2">
              <Label htmlFor="profileFamilyName">Nom de votre famille</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 shrink-0">Famille</span>
                <Input
                  id="profileFamilyName"
                  value={profileFamilyName}
                  onChange={(e) => setProfileFamilyName(e.target.value)}
                  placeholder="Dupont"
                  maxLength={60}
                />
              </div>
              <p className="text-xs text-gray-400">
                Affiché en haut du site et sur votre page d&apos;accueil («&nbsp;Bon retour,
                famille Dupont&nbsp;!&nbsp;»). Laissez vide pour utiliser votre nom d&apos;affichage.
              </p>
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
          <h2
            className={`${serifClass} text-2xl font-medium`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Mon{" "}
            <em className="italic" style={{ color: p.accent }}>
              foyer
            </em>
          </h2>
          <button
            onClick={openAddMemberDialog}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: p.ink, color: p.bg }}
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </button>
        </div>

        {loadingMembers ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-72 rounded-xl animate-pulse"
                style={{ background: p.placeholder }}
              />
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

            <button
              onClick={openAddMemberDialog}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl transition-all min-h-[200px] group hover:-translate-y-0.5"
              style={{
                border: `2px dashed ${p.line2}`,
                background: "transparent",
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
                style={{ background: p.bg2, color: p.accent }}
              >
                <Plus className="h-6 w-6" />
              </div>
              <span className="text-sm" style={{ color: p.ink2 }}>
                Ajouter un membre
              </span>
            </button>
          </div>
        ) : (
          <button
            onClick={openAddMemberDialog}
            className="w-full text-center py-12 rounded-xl transition-all hover:-translate-y-0.5"
            style={{
              background: p.card,
              border: `2px dashed ${p.line2}`,
            }}
          >
            <Plus
              className="h-10 w-10 mx-auto mb-3"
              style={{ color: p.accent }}
            />
            <p className="font-medium" style={{ color: p.ink }}>
              Ajoutez les membres de votre foyer
            </p>
            <p className="text-sm mt-1" style={{ color: p.ink2 }}>
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
      <section id="discovery" className="scroll-mt-20">
        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { key: "recommendations" as const, label: "Recommandations", short: "Recos", icon: Sparkles },
            { key: "movienight" as const, label: "Soirée Ciné", short: "Ciné", icon: Film },
            { key: "lists" as const, label: "Mes listes", short: "Listes", icon: ListOrdered },
          ].map((t) => {
            const isActive = discoveryTab === t.key
            const Icon = t.icon
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setDiscoveryTab(t.key)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors"
                style={{
                  background: isActive ? p.ink : p.card,
                  color: isActive ? p.bg : p.ink,
                  border: `1px solid ${isActive ? p.ink : p.line}`,
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.short}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-4">
          {discoveryTab === "recommendations" && <FamilyRecommendationsSection />}
          {discoveryTab === "movienight" && <FamilyMovieNightSection />}
          {discoveryTab === "lists" && <UserListsPreview />}
        </div>
      </section>

      {/* ================================================================ */}
      {/* ZONE D: Account Settings (Collapsible)                            */}
      {/* ================================================================ */}
      <AccountSettings />
    </div>
  )
}
