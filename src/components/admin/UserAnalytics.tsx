"use client"

import { User, Star, MessageSquare } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { adminSerifClass } from "./shared/admin-ui"

interface Contributor {
  user: {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
  reviewCount: number
}

interface RecentReview {
  id: string
  rating: number
  comment?: string | null
  createdAt: string | Date
  user?: {
    id: string
    name?: string | null
    email?: string | null
  } | null
  media: {
    id: string
    title: string
    type: string
  }
}

interface UserAnalyticsProps {
  topContributors: Contributor[]
  recentReviews: RecentReview[]
  variant?: "default" | "apercu"
}

function RankBadge({ index, isApercu }: { index: number; isApercu: boolean }) {
  const p = APERCU_PALETTE
  if (isApercu) {
    const style =
      index === 0
        ? { background: "rgba(198,138,62,0.18)", color: "#8A5A20" }
        : { background: p.bg2, color: p.ink2 }
    return (
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
        style={style}
      >
        {index + 1}
      </span>
    )
  }
  const cls =
    index === 0
      ? "bg-yellow-100 text-yellow-700"
      : index === 1
        ? "bg-gray-100 text-gray-700"
        : index === 2
          ? "bg-amber-100 text-amber-700"
          : "bg-gray-50 text-gray-500"
  return (
    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${cls}`}>
      {index + 1}
    </span>
  )
}

export function UserAnalytics({
  topContributors,
  recentReviews,
  variant = "default",
}: UserAnalyticsProps) {
  const p = APERCU_PALETTE
  const isApercu = variant === "apercu"

  const contributorsBlock = (
    <>
      {topContributors.length === 0 ? (
        <p className="text-center py-4 text-sm" style={isApercu ? { color: p.ink2 } : undefined}>
          Aucun contributeur
        </p>
      ) : (
        <div className="space-y-2">
          {topContributors.slice(0, 5).map((contributor, index) => (
            <div key={contributor.user.id} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <RankBadge index={index} isApercu={isApercu} />
                <span
                  className="text-sm font-medium truncate max-w-[150px]"
                  style={isApercu ? { color: p.ink } : undefined}
                >
                  {contributor.user.name ||
                    contributor.user.email?.split("@")[0] ||
                    "Anonyme"}
                </span>
              </div>
              <span className="text-sm" style={isApercu ? { color: p.ink2 } : undefined}>
                {contributor.reviewCount} avis
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )

  const reviewsBlock = (
    <>
      {recentReviews.length === 0 ? (
        <p className="text-center py-4 text-sm" style={isApercu ? { color: p.ink2 } : undefined}>
          Aucun avis récent
        </p>
      ) : (
        <div>
          {recentReviews.slice(0, 5).map((review, idx) => (
            <div
              key={review.id}
              className="py-2"
              style={isApercu && idx > 0 ? { borderTop: `1px solid ${p.line}` } : undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" style={isApercu ? { color: p.ink } : undefined}>
                    {review.media.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-3 w-3 ${
                            star <= review.rating
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs" style={isApercu ? { color: p.ink2 } : undefined}>
                      par {review.user?.name || "Anonyme"}
                    </span>
                  </div>
                </div>
                <span className="text-xs whitespace-nowrap" style={isApercu ? { color: p.ink2 } : undefined}>
                  {formatDistanceToNow(new Date(review.createdAt), {
                    addSuffix: true,
                    locale: fr,
                  })}
                </span>
              </div>
              {review.comment && (
                <p className="text-xs mt-1 line-clamp-1" style={isApercu ? { color: p.ink2 } : undefined}>
                  {review.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )

  if (isApercu) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl p-4" style={{ background: p.bg2, border: `1px solid ${p.line}` }}>
          <h3 className={`${adminSerifClass} text-base font-medium mb-3 flex items-center gap-2`} style={{ color: p.ink }}>
            <User className="h-4 w-4" style={{ color: p.accent }} />
            Top contributeurs
          </h3>
          {contributorsBlock}
        </div>
        <div className="rounded-2xl p-4" style={{ background: p.bg2, border: `1px solid ${p.line}` }}>
          <h3 className={`${adminSerifClass} text-base font-medium mb-3 flex items-center gap-2`} style={{ color: p.ink }}>
            <MessageSquare className="h-4 w-4" style={{ color: p.accent }} />
            Avis récents
          </h3>
          {reviewsBlock}
        </div>
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-blue-500" />
            Top contributeurs
          </CardTitle>
        </CardHeader>
        <CardContent>{contributorsBlock}</CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
            Avis récents
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 px-4">{reviewsBlock}</CardContent>
      </Card>
    </div>
  )
}
