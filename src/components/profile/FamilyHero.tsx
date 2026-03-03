"use client"

import { Star, Heart, Bookmark, MessageCircle, Edit2 } from "lucide-react"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FamilyHeroProps {
  user: {
    name?: string | null
    image?: string | null
    avatarStyle?: string | null
    avatarSeed?: string | null
    avatarOptions?: Record<string, unknown> | null
  }
  stats: {
    reviews: number
    favorites: number
    watchlist: number
    reactions: number
    memberSince: string
  } | null
  members: Array<{
    id: string
    name: string
    avatarEmoji: string
    avatarStyle?: string | null
    avatarSeed?: string | null
    avatarOptions?: Record<string, unknown> | null
  }>
  onEditProfile: () => void
  onMemberClick?: (memberId: string) => void
}

const STAT_ITEMS = [
  { key: "reviews" as const, label: "Avis", icon: Star, color: "text-amber-500" },
  { key: "favorites" as const, label: "Favoris", icon: Heart, color: "text-rose-500" },
  { key: "watchlist" as const, label: "À voir", icon: Bookmark, color: "text-blue-500" },
  { key: "reactions" as const, label: "Réactions", icon: MessageCircle, color: "text-emerald-500" },
]

export function FamilyHero({ user, stats, members, onEditProfile, onMemberClick }: FamilyHeroProps) {
  const memberSinceYear = stats?.memberSince
    ? new Date(stats.memberSince).getFullYear()
    : null

  return (
    <div className="rounded-2xl bg-gradient-to-br from-violet-50 via-indigo-50 to-purple-50 border border-violet-100/50 overflow-hidden">
      <div className="p-6 sm:p-8">
        {/* Top row: Avatar + Name + Edit */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <MemberAvatar
              avatarStyle={user.avatarStyle}
              avatarSeed={user.avatarSeed}
              avatarOptions={user.avatarOptions}
              avatarEmoji={user.image}
              name={user.name}
              size={72}
              className="ring-4 ring-white shadow-md"
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                {user.name || "Mon foyer"}
              </h1>
              {memberSinceYear && (
                <p className="text-sm text-gray-500 mt-0.5">
                  Membre depuis {memberSinceYear}
                </p>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onEditProfile} className="flex-shrink-0">
            <Edit2 className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Modifier</span>
          </Button>
        </div>

        {/* Stats ribbon */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 mt-6">
            {STAT_ITEMS.map(({ key, label, icon: Icon, color }) => (
              <div key={key} className="text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Icon className={cn("h-4 w-4", color)} />
                  <span className="text-lg sm:text-xl font-bold text-gray-900">
                    {stats[key]}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Family faces row */}
        {members.length > 0 && (
          <div className="mt-6 pt-5 border-t border-violet-100/50">
            <p className="text-xs font-medium text-gray-500 mb-3">Mon foyer</p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => onMemberClick?.(member.id)}
                  className="flex flex-col items-center gap-1.5 group flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-lg p-1"
                >
                  <MemberAvatar
                    avatarStyle={member.avatarStyle}
                    avatarSeed={member.avatarSeed}
                    avatarOptions={member.avatarOptions}
                    avatarEmoji={member.avatarEmoji}
                    name={member.name}
                    size={40}
                    className="transition-transform group-hover:scale-110"
                  />
                  <span className="text-xs text-gray-600 group-hover:text-violet-600 transition-colors max-w-[60px] truncate">
                    {member.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
