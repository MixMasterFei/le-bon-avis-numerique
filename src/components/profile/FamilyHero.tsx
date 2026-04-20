"use client"

import { Star, Heart, Bookmark, MessageCircle, Edit2 } from "lucide-react"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

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
  { key: "reviews" as const, label: "Avis", icon: Star },
  { key: "favorites" as const, label: "Favoris", icon: Heart },
  { key: "watchlist" as const, label: "À voir", icon: Bookmark },
  { key: "reactions" as const, label: "Réactions", icon: MessageCircle },
]

export function FamilyHero({
  user,
  stats,
  members,
  onEditProfile,
  onMemberClick,
}: FamilyHeroProps) {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const memberSinceYear = stats?.memberSince
    ? new Date(stats.memberSince).getFullYear()
    : null

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{ background: p.bg2, border: `1px solid ${p.line}` }}
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span
              className="inline-flex rounded-full"
              style={{ boxShadow: `0 0 0 4px ${p.card}, 0 4px 12px ${p.line}` }}
            >
              <MemberAvatar
                avatarStyle={user.avatarStyle}
                avatarSeed={user.avatarSeed}
                avatarOptions={user.avatarOptions}
                avatarEmoji={user.image}
                name={user.name}
                size={72}
              />
            </span>
            <div>
              <h1
                className={`${serifClass} text-2xl sm:text-3xl font-medium leading-[1.05]`}
                style={{ color: p.ink, letterSpacing: "-0.02em" }}
              >
                {user.name || "Mon foyer"}
              </h1>
              {memberSinceYear && (
                <p className="text-sm mt-1" style={{ color: p.ink2 }}>
                  Membre depuis {memberSinceYear}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onEditProfile}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
            style={{
              background: p.card,
              color: p.ink,
              border: `1px solid ${p.line2}`,
            }}
          >
            <Edit2 className="h-4 w-4" />
            <span className="hidden sm:inline">Modifier</span>
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {STAT_ITEMS.map(({ key, label, icon: Icon }) => (
              <div
                key={key}
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: p.card,
                  border: `1px solid ${p.line}`,
                }}
              >
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: p.bg2, color: p.accent }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p
                    className={`${serifClass} text-2xl font-medium leading-none`}
                    style={{ color: p.ink, letterSpacing: "-0.02em" }}
                  >
                    {stats[key]}
                  </p>
                  <p className="text-xs mt-1" style={{ color: p.ink2 }}>
                    {label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {members.length > 0 && (
          <div
            className="mt-6 pt-5 border-t"
            style={{ borderColor: p.line }}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-wide mb-3"
              style={{ color: p.accent }}
            >
              Mon foyer
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => onMemberClick?.(member.id)}
                  className="flex flex-col items-center gap-1.5 group flex-shrink-0 focus:outline-none rounded-lg p-1"
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
                  <span
                    className="text-xs transition-colors max-w-[60px] truncate"
                    style={{ color: p.ink2 }}
                  >
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
