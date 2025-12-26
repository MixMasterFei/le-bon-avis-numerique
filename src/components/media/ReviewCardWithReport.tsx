"use client"

import { useState } from "react"
import { Star, User, GraduationCap, Baby, Flag, MoreVertical, Trash2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { ReportModal } from "./ReportModal"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

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
  user?: {
    id: string
    name: string | null
    image: string | null
  }
}

interface ReviewCardWithReportProps {
  review: Review
  className?: string
  onDeleted?: () => void
}

export function ReviewCardWithReport({ review, className, onDeleted }: ReviewCardWithReportProps) {
  const Icon = roleIcons[review.role]
  const { data: session } = useSession()
  const router = useRouter()
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isOwnReview = session?.user?.id === review.user?.id
  const isAdmin = (session?.user as any)?.role === "ADMIN" || (session?.user as any)?.role === "MODERATOR"
  const canDelete = isOwnReview || isAdmin

  const handleReportClick = () => {
    if (!session?.user) {
      router.push("/connexion")
      return
    }
    setReportModalOpen(true)
  }

  const handleDeleteClick = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet avis ?")) {
      return
    }

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/user/review?reviewId=${review.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        onDeleted?.()
        // Reload to refresh the reviews list
        window.location.reload()
      } else {
        const data = await res.json()
        alert(data.error || "Erreur lors de la suppression")
      }
    } catch (error) {
      console.error("Failed to delete review:", error)
      alert("Erreur lors de la suppression")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Card className={cn("", className)}>
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className={cn("gap-1", roleColors[review.role])}>
                <Icon className="h-3 w-3" />
                {roleLabels[review.role]}
              </Badge>
              {review.user?.name && (
                <span className="text-sm text-gray-500">
                  par {review.user.name}
                  {isOwnReview && <span className="text-primary ml-1">(vous)</span>}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
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

              {/* Actions dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canDelete && (
                    <>
                      <DropdownMenuItem
                        onClick={handleDeleteClick}
                        disabled={isDeleting}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {isDeleting ? "Suppression..." : "Supprimer"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {!isOwnReview && (
                    <DropdownMenuItem
                      onClick={handleReportClick}
                      className="text-orange-600 focus:text-orange-600"
                    >
                      <Flag className="h-4 w-4 mr-2" />
                      Signaler
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Comment */}
          {review.comment && (
            <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
          )}

          {/* Age Suggestion */}
          {review.ageSuggestion > 0 && (
            <div className="flex items-center justify-between pt-2 border-t text-sm">
              <span className="text-gray-500">Âge recommandé :</span>
              <span className="font-semibold text-primary">{review.ageSuggestion}+ ans</span>
            </div>
          )}
        </CardContent>
      </Card>

      <ReportModal
        open={reportModalOpen}
        onOpenChange={setReportModalOpen}
        reviewId={review.id}
      />
    </>
  )
}
