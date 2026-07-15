"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Sparkles, Sliders, User, MoreVertical, Edit2, Trash2, Heart, BarChart3 } from "lucide-react"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { CompletionMeter } from "./CompletionMeter"
import { MemberPreferencesModal } from "./MemberPreferencesModal"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatAgeFromBirthYear } from "@/lib/utils"
import { SafeImage } from "@/components/ui/SafeImage"
import { toMediaRouteId } from "@/lib/media-route"
import type { MediaType } from "@/lib/types"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { getCompletionPercent } from "@/lib/profile-completion"
import { familyFitLabelFromScore } from "@/lib/family-fit-display"

const SAGE = "#5C8A5C"

interface FamilyMemberCardMember {
  id: string
  name: string
  birthYear: number | null
  birthMonth: number | null
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

// Non-judgmental wording (was Libre/Modéré/Sensible/Strict): the schema
// defaults average 2.2, so every untouched profile rounded to "Sensible" —
// which read as the site pronouncing a verdict on the child. "Équilibré" is
// the accurate name for the default/middle band, and profiles that were
// never tuned get a distinct "Réglages par défaut" state instead of any
// label at all (see sensitivityInfo below).
const SENSITIVITY_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Très ouvert", color: "#B8D89A" },
  1: { label: "Ouvert", color: "#F8D775" },
  2: { label: "Équilibré", color: "#E8A87C" },
  3: { label: "Prudent", color: "#D16A4A" },
}

export function FamilyMemberCard({ member, onEdit, onDelete }: FamilyMemberCardProps) {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [topRec, setTopRec] = useState<TopRec | null>(null)

  const lovedCount = member.reactions.filter((r) => r.reaction === "LOVED").length

  const avgSensitivity = Math.round(
    ((member.sensitivityViolence ?? 2) +
      (member.sensitivityScary ?? 2) +
      (member.sensitivitySexual ?? 3) +
      (member.sensitivityLanguage ?? 2) +
      (member.sensitivitySubstances ?? 2)) / 5
  )
  // A profile that was never tuned (no quiz, no custom settings) shows a
  // neutral "default settings" chip — we don't pronounce on a child whose
  // parents haven't told us anything yet.
  const isTuned = member.useCustomSettings ?? false
  const sensitivityInfo = isTuned
    ? (SENSITIVITY_LABELS[avgSensitivity] ?? SENSITIVITY_LABELS[2])
    : { label: "Réglages par défaut", color: p.line2 }

  const completionPercent = getCompletionPercent(
    {
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
    },
    member._count.reactions,
  )

  const ringColor: "green" | "amber" | "red" =
    completionPercent >= 80 ? "green" : completionPercent >= 50 ? "amber" : "red"

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
      <div
        className="group relative overflow-hidden transition-all duration-200 hover:-translate-y-1 h-full flex flex-col rounded-2xl"
        style={{
          background: p.card,
          border: `1px solid ${p.line}`,
          boxShadow: `0 2px 8px ${p.line}`,
        }}
      >
        <div className="absolute top-3 right-3 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-7 w-7 p-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity rounded-md inline-flex items-center justify-center"
                style={{ color: p.ink2 }}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="h-3.5 w-3.5 mr-2" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                style={{ color: p.accent }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="p-5 flex flex-col flex-1">
          <div className="flex flex-col items-center text-center mb-4">
            <MemberAvatar
              avatarStyle={member.avatarStyle}
              avatarSeed={member.avatarSeed}
              avatarOptions={member.avatarOptions}
              avatarEmoji={member.avatarEmoji}
              name={member.name}
              size={64}
              ring={ringColor}
            />
            <h3
              className={`${serifClass} font-medium mt-2 text-lg`}
              style={{ color: p.ink, letterSpacing: "-0.02em" }}
            >
              {member.name}
            </h3>
            {member.birthYear && (
              <span className="text-xs" style={{ color: p.ink2 }}>
                {formatAgeFromBirthYear(member.birthYear, member.birthMonth)}
              </span>
            )}
          </div>

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

          <div className="mt-3 space-y-2">
            {(member.favoriteGenres?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1">
                {member.favoriteGenres!.slice(0, 3).map((genre) => (
                  <span
                    key={genre}
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: p.bg2, color: p.ink }}
                  >
                    {genre}
                  </span>
                ))}
                {member.favoriteGenres!.length > 3 && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: p.bg2, color: p.ink2 }}
                  >
                    +{member.favoriteGenres!.length - 3}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[0, 1, 2, 3].map((level) => (
                  <div
                    key={level}
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background:
                        level <= avgSensitivity
                          ? sensitivityInfo.color
                          : p.bg2,
                    }}
                  />
                ))}
              </div>
              <span className="text-[10px]" style={{ color: p.ink2 }}>
                {sensitivityInfo.label}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mt-3 text-xs" style={{ color: p.ink2 }}>
            <span className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              {member._count.reactions}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" style={{ color: p.accent }} />
              {lovedCount}
            </span>
          </div>

          {topRec && topRec.matchScore > 0 && (
            <Link
              href={`/media/${toMediaRouteId(topRec.type as MediaType, topRec.id)}`}
              className="mt-3 flex items-center gap-2 p-2 rounded-lg transition-colors hover:opacity-80"
              style={{ background: p.bg2 }}
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
                <div
                  className="w-6 h-9 rounded flex-shrink-0"
                  style={{ background: p.placeholder }}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate" style={{ color: p.ink }}>
                  {topRec.title}
                </p>
                <p className="text-[10px]" style={{ color: SAGE }}>
                  {familyFitLabelFromScore(topRec.matchScore)}
                </p>
              </div>
            </Link>
          )}

          <div className="flex gap-2 mt-auto pt-4">
            <Link href={`/profil/quiz/${member.id}`} className="flex-1">
              <button
                className="w-full text-xs inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-full font-semibold transition-opacity hover:opacity-80"
                style={{
                  background: "transparent",
                  color: p.ink,
                  border: `1px solid ${p.line2}`,
                }}
              >
                <Sparkles className="h-3 w-3" />
                Quiz
              </button>
            </Link>
            <button
              className="flex-1 text-xs inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-full font-semibold transition-opacity hover:opacity-80"
              style={{
                background: "transparent",
                color: p.ink,
                border: `1px solid ${p.line2}`,
              }}
              onClick={() => setPrefsOpen(true)}
            >
              <Sliders className="h-3 w-3" />
              Préfs
            </button>
            <Link href={`/profil/membres/${member.id}`} className="flex-1">
              <button
                className="w-full text-xs inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-full font-semibold transition-opacity hover:opacity-80"
                style={{
                  background: p.bg2,
                  color: p.accent,
                  border: `1px solid ${p.line}`,
                }}
              >
                <User className="h-3 w-3" />
                Coin
              </button>
            </Link>
          </div>
        </div>
      </div>

      <MemberPreferencesModal
        open={prefsOpen}
        onOpenChange={setPrefsOpen}
        memberId={member.id}
        memberName={member.name}
      />
    </>
  )
}
