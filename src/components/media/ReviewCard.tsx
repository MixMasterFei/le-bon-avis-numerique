import { Star, User, GraduationCap, Baby } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const roleIcons = {
  PARENT: User,
  KID: Baby,
  EDUCATOR: GraduationCap,
}

const roleLabels = {
  PARENT: "Parent",
  KID: "Enfant",
  EDUCATOR: "Éducateur",
}

const roleColors = {
  PARENT: "bg-blue-100 text-blue-700",
  KID: "bg-pink-100 text-pink-700",
  EDUCATOR: "bg-purple-100 text-purple-700",
}

interface Review {
  id: string
  role: "PARENT" | "KID" | "EDUCATOR"
  rating: number
  ageSuggestion: number
  comment: string
}

interface ReviewCardProps {
  review: Review
  className?: string
}

export function ReviewCard({ review, className }: ReviewCardProps) {
  const Icon = roleIcons[review.role]

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Badge className={cn("gap-1", roleColors[review.role])}>
            <Icon className="h-3 w-3" />
            {roleLabels[review.role]}
          </Badge>

          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "h-4 w-4",
                  i < review.rating
                    ? "fill-amber-400 text-amber-400"
                    : "text-gray-300"
                )}
              />
            ))}
          </div>
        </div>

        {/* Comment */}
        <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>

        {/* Age Suggestion */}
        <div className="flex items-center justify-between pt-2 border-t text-sm">
          <span className="text-gray-500">Âge recommandé :</span>
          <span className="font-semibold text-primary">{review.ageSuggestion}+ ans</span>
        </div>
      </CardContent>
    </Card>
  )
}

interface ReviewSummaryProps {
  reviews: Review[]
  className?: string
}

export function ReviewSummary({ reviews, className }: ReviewSummaryProps) {
  const parentReviews = reviews.filter((r) => r.role === "PARENT")
  const kidReviews = reviews.filter((r) => r.role === "KID")
  const educatorReviews = reviews.filter((r) => r.role === "EDUCATOR")

  const getAvgAge = (revs: Review[]) =>
    revs.length > 0
      ? revs.reduce((acc, r) => acc + r.ageSuggestion, 0) / revs.length
      : null

  const parentAvg = getAvgAge(parentReviews)
  const kidAvg = getAvgAge(kidReviews)

  return (
    <div className={cn("flex flex-wrap gap-6", className)}>
      {parentAvg !== null && (
        <div className="text-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-full bg-blue-100 text-blue-700 font-bold text-xl mx-auto mb-2">
            {Math.round(parentAvg)}+
          </div>
          <p className="text-xs text-gray-600 font-medium">Parents disent</p>
        </div>
      )}

      {kidAvg !== null && (
        <div className="text-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-full bg-pink-100 text-pink-700 font-bold text-xl mx-auto mb-2">
            {Math.round(kidAvg)}+
          </div>
          <p className="text-xs text-gray-600 font-medium">Enfants disent</p>
        </div>
      )}

      <div className="text-xs text-gray-500 flex items-end pb-2">
        {reviews.length} avis au total
      </div>
    </div>
  )
}

