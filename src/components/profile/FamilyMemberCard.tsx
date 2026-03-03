"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Sparkles, Sliders, User, MoreVertical, Edit2, Trash2, Heart, BarChart3 } from "lucide-react"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { CompletionMeter } from "./CompletionMeter"
import { MemberPreferencesModal } from "./MemberPreferencesModal"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { SafeImage } from "@/components/ui/SafeImage"
import { toMediaRouteId } from "@/lib/media-route"
import type { MediaType } from "@/lib/types"

interface FamilyMemberCardMember {
  id: string
  name: string
  birthYear: number | null
  avatarEmoji: string
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  favoriteGenres?: string[]
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
  _count: { reactions: number }
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
}

interface TopRec {
  id: string
  title: string
  type: string
  posterUrl: string | null
  matchScore: number
}

interface FamilyMemberCardProps {
  member: FamilyMemberCardMember
  onEdit: () => void
  onDelete: () => void
}

const SENSITIVITY_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Libre", color: "bg-emerald-200" },
  1: { label: "Modéré", color: "bg-amber-200" },
  2: { label: "Sensible", color: "bg-orange-200" },
  3: { label: "Strict", color: "bg-red-200" },
}

export function FamilyMemberCard({ member, onEdit, onDelete }: FamilyMemberCardProps) {
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [topRec, setTopRec] = useState<TopRec | null>(null)

  const currentYear = new Date().getFullYear()
  const age = member.birthYear ? currentYear - member.birthYear : null
  const lovedCount = member.reactions.filter((r) => r.reaction === "LOVED").length

  // Aggregate sensitivity (average of 5 values)
  const avgSensitivity = Math.round(
    ((member.sensitivityViolence ?? 2) +
      (member.sensitivityScary ?? 2) +
      (member.sensitivitySexual ?? 3) +
      (member.sensitivityLanguage ?? 2) +
      (member.sensitivitySubstances ?? 2)) / 5
  )
  const sensitivityInfo = SENSITIVITY_LABELS[avgSensitivity] ?? SENSITIVITY_LABELS[2]

  // Completion percentage (quick calc matching CompletionMeter logic)
  const completionPercent = [
    member.birthYear !== null ? 10 : 0,
    (member.avatarStyle != null || member.avatarEmoji !== "👧") ? 5 : 0,
    (member.useCustomSettings && (member.favoriteGenres?.length ?? 0) > 0) ? 25 : 0,
    [member.sensitivityViolence, member.sensitivityScary, member.sensitivitySexual, member.sensitivityLanguage, member.sensitivitySubstances]
      .some((v, i) => v !== [2, 2, 3, 2, 2][i]) ? 15 : 0,
    (member.avoidTopics?.length ?? 0) > 0 ? 5 : 0,
    member._count.reactions >= 3 ? 15 : 0,
    member._count.reactions >= 5 ? 10 : 0,
    (member.interests?.length ?? 0) > 0 ? 15 : 0,
  ].reduce((a, b) => a + b, 0)

  const ringColor = completionPercent >= 80 ? "green" : completionPercent >= 50 ? "amber" : "red"

  // Lazy-load top recommendation
  useEffect(() => {
    if (member._count.reactions < 1) return
    const controller = new AbortController()
    fetch(`/api/recommendations?familyMemberId=${member.id}&limit=1`, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.recommendations?.[0]) {
          const rec = data.recommendations[0]
          setTopRec({
            id: rec.id,
            title: rec.title,
            type: rec.type ?? "MOVIE",
            posterUrl: rec.posterUrl,
            matchScore: rec.matchScore ?? rec.score ?? 0,
          })
        }
      })
      .catch(() => {})
    return () => controller.abort()
  }, [member.id, member._count.reactions])

  return (
    <>
      <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-1">
        {/* Context menu */}
        <div className="absolute top-3 right-3 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="h-3.5 w-3.5 mr-2" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <CardContent className="p-5">
          {/* Header: Avatar + Name + Age */}
          <div className="flex flex-col items-center text-center mb-4">
            <MemberAvatar
              avatarStyle={member.avatarStyle}
              avatarSeed={member.avatarSeed}
              avatarOptions={member.avatarOptions}
              avatarEmoji={member.avatarEmoji}
              name={member.name}
              size={64}
              ring={ringColor as "green" | "amber" | "red"}
            />
            <h3 className="font-bold text-gray-900 mt-2">{member.name}</h3>
            {age && (
              <span className="text-xs text-gray-500">{age} ans</span>
            )}
          </div>

          {/* Completion bar (compact) */}
          <CompletionMeter
            member={{
              birthYear: member.birthYear,
              avatarEmoji: member.avatarEmoji,
              avatarStyle: member.avatarStyle,
              useCustomSettings: member.useCustomSettings ?? false,
              favoriteGenres: member.favoriteGenres ?? [],
              sensitivityViolence: member.sensitivityViolence ?? 2,
              sensitivityScary: member.sensitivityScary ?? 2,
              sensitivitySexual: member.sensitivitySexual ?? 3,
              sensitivityLanguage: member.sensitivityLanguage ?? 2,
              sensitivitySubstances: member.sensitivitySubstances ?? 2,
              avoidTopics: member.avoidTopics ?? [],
              interests: member.interests ?? [],
            }}
            reactionCount={member._count.reactions}
            compact
          />

          {/* Preferences at a glance */}
          <div className="mt-3 space-y-2">
            {/* Favorite genres */}
            {(member.favoriteGenres?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1">
                {member.favoriteGenres!.slice(0, 3).map((genre) => (
                  <Badge key={genre} variant="secondary" className="text-[10px] px-1.5 py-0 bg-violet-100 text-violet-700">
                    {genre}
                  </Badge>
                ))}
                {member.favoriteGenres!.length > 3 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-500">
                    +{member.favoriteGenres!.length - 3}
                  </Badge>
                )}
              </div>
            )}

            {/* Sensitivity indicator */}
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[0, 1, 2, 3].map((level) => (
                  <div
                    key={level}
                    className={cn(
                      "w-2.5 h-2.5 rounded-full",
                      level <= avgSensitivity ? sensitivityInfo.color : "bg-gray-200"
                    )}
                  />
                ))}
              </div>
              <span className="text-[10px] text-gray-500">{sensitivityInfo.label}</span>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              {member._count.reactions}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3 text-rose-400" />
              {lovedCount}
            </span>
          </div>

          {/* Top recommendation (only show if score > 0) */}
          {topRec && topRec.matchScore > 0 && (
            <Link
              href={`/media/${toMediaRouteId(topRec.type as MediaType, topRec.id)}`}
              className="mt-3 flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {topRec.posterUrl ? (
                <SafeImage
                  src={topRec.posterUrl}
                  alt=""
                  width={24}
                  height={36}
                  className="rounded flex-shrink-0"
                />
              ) : (
                <div className="w-6 h-9 bg-gray-200 rounded flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-700 truncate">{topRec.title}</p>
                <p className="text-[10px] text-emerald-600">
                  {topRec.matchScore}% compatible
                </p>
              </div>
            </Link>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <Link href={`/profil/quiz/${member.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs gap-1">
                <Sparkles className="h-3 w-3" />
                Quiz
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs gap-1"
              onClick={() => setPrefsOpen(true)}
            >
              <Sliders className="h-3 w-3" />
              Préfs
            </Button>
            <Link href={`/profil/membres/${member.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs gap-1 text-violet-600 hover:text-violet-700 hover:bg-violet-50">
                <User className="h-3 w-3" />
                Coin
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Preferences Modal */}
      <MemberPreferencesModal
        open={prefsOpen}
        onOpenChange={setPrefsOpen}
        memberId={member.id}
        memberName={member.name}
      />
    </>
  )
}
