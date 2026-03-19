"use client"

import { User, Star, MessageSquare } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"

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
}

export function UserAnalytics({ topContributors, recentReviews }: UserAnalyticsProps) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Top Contributors */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-blue-500" />
            Top contributeurs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topContributors.length === 0 ? (
            <p className="text-gray-500 text-center py-4 text-sm">
              Aucun contributeur
            </p>
          ) : (
            <div className="space-y-2">
              {topContributors.slice(0, 5).map((contributor, index) => (
                <div
                  key={contributor.user.id}
                  className="flex items-center justify-between py-1"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0
                          ? "bg-yellow-100 text-yellow-700"
                          : index === 1
                          ? "bg-gray-100 text-gray-700"
                          : index === 2
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-50 text-gray-500"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium truncate max-w-[150px]">
                      {contributor.user.name ||
                        contributor.user.email?.split("@")[0] ||
                        "Anonyme"}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {contributor.reviewCount} avis
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Reviews */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
            Avis récents
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentReviews.length === 0 ? (
            <p className="text-gray-500 text-center py-4 text-sm px-4">
              Aucun avis récent
            </p>
          ) : (
            <div className="divide-y">
              {recentReviews.slice(0, 5).map((review) => (
                <div key={review.id} className="px-4 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
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
                        <span className="text-xs text-gray-400">
                          par {review.user?.name || "Anonyme"}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatDistanceToNow(new Date(review.createdAt), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                      {review.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
