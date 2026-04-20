"use client"

import { ReviewCardWithReport } from "./ReviewCardWithReport"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

interface Review {
  id: string
  role: "PARENT" | "KID" | "EDUCATOR"
  rating: number
  ageSuggestion: number
  comment: string
  createdAt?: string
  editedAt?: string | null
  user?: {
    id: string
    name: string | null
    image: string | null
  }
  familyMember?: {
    id: string
    name: string
    avatarEmoji: string
  } | null
}

interface ReviewsSectionProps {
  reviews: Review[]
}

export function ReviewsSection({ reviews }: ReviewsSectionProps) {
  const p = APERCU_PALETTE
  if (reviews.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{
          background: p.card,
          border: `1px solid ${p.line}`,
          color: p.ink2,
        }}
      >
        Aucun avis pour le moment. Soyez le premier à partager votre
        expérience !
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <ReviewCardWithReport key={review.id} review={review} />
      ))}
    </div>
  )
}
