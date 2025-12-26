"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ReviewCardWithReport } from "./ReviewCardWithReport"

interface Review {
  id: string
  role: "PARENT" | "KID" | "EDUCATOR"
  rating: number
  ageSuggestion: number
  comment: string
  user?: {
    id: string
    name: string | null
    image: string | null
  }
}

interface ReviewsSectionProps {
  reviews: Review[]
}

export function ReviewsSection({ reviews }: ReviewsSectionProps) {
  if (reviews.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-500">
          Aucun avis pour le moment. Soyez le premier à partager votre expérience !
        </CardContent>
      </Card>
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
