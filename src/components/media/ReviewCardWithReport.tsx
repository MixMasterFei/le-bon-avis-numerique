"use client"

import { useState } from "react"
import Image from "next/image"
import { Star, User, GraduationCap, Baby, Flag, MoreVertical, Trash2, Pencil, Users, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { ReportModal } from "./ReportModal"
import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { renderFormattedText } from "@/components/ui/rich-text-editor"

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

interface ReviewCardWithReportProps {
  review: Review
  className?: string
  onDeleted?: () => void
  onUpdated?: () => void
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function ReviewCardWithReport({ review, className, onDeleted, onUpdated }: ReviewCardWithReportProps) {
  const Icon = roleIcons[review.role]
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedComment, setEditedComment] = useState(review.comment)
  const [isSaving, setIsSaving] = useState(false)

  const isOwnReview = session?.user?.id === review.user?.id
  const isAdmin = (session?.user as any)?.role === "ADMIN" || (session?.user as any)?.role === "MODERATOR"
  const canDelete = isOwnReview || isAdmin
  const canEdit = isOwnReview

  const handleReportClick = () => {
    if (!session?.user) {
      router.push(`/connexion?callbackUrl=${encodeURIComponent(pathname)}`)
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
        router.refresh()
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

  const handleEditClick = () => {
    setEditedComment(review.comment)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedComment(review.comment)
  }

  const handleSaveEdit = async () => {
    if (!editedComment.trim()) {
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`/api/user/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: review.id,
          comment: editedComment.trim(),
        }),
      })

      if (res.ok) {
        setIsEditing(false)
        onUpdated?.()
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || "Erreur lors de la modification")
      }
    } catch (error) {
      console.error("Failed to update review:", error)
      alert("Erreur lors de la modification")
    } finally {
      setIsSaving(false)
    }
  }

  // Get display name
  const displayName = review.familyMember?.name || review.user?.name || "Anonyme"
  const userImage = review.user?.image

  return (
    <>
      <Card className={cn("", className)}>
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Avatar */}
              <div className="flex items-center gap-1.5">
                {review.familyMember ? (
                  <MemberAvatar
                    avatarStyle={(review.familyMember as any).avatarStyle ?? null}
                    avatarSeed={(review.familyMember as any).avatarSeed ?? null}
                    avatarOptions={((review.familyMember as any).avatarOptions as Record<string, unknown>) ?? null}
                    avatarEmoji={review.familyMember.avatarEmoji ?? null}
                    name={review.familyMember.name}
                    size={20}
                  />
                ) : userImage ? (
                  <div className="relative w-6 h-6 rounded-full overflow-hidden">
                    <Image src={userImage} alt={displayName} fill className="object-cover" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-gray-500" />
                  </div>
                )}

                {/* Show family icon if this is a family member */}
                {review.familyMember && (
                  <span title="Membre de la famille">
                    <Users className="h-3 w-3 text-gray-400" />
                  </span>
                )}
              </div>

              {/* Name and role */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">
                  {displayName}
                  {isOwnReview && <span className="text-primary ml-1 font-normal">(vous)</span>}
                </span>
                <Badge className={cn("gap-1 text-xs", roleColors[review.role])}>
                  <Icon className="h-3 w-3" />
                  {roleLabels[review.role]}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Stars */}
              <div className="flex items-center gap-0.5">
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

              {/* Actions — inline for own reviews, dropdown for others */}
              <div className="flex items-center gap-1">
                {isOwnReview && canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEditClick}
                    className="h-8 px-2 text-gray-500 hover:text-blue-600 gap-1"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="text-xs">Modifier</span>
                  </Button>
                )}
                {isOwnReview && canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteClick}
                    disabled={isDeleting}
                    className="h-8 px-2 text-gray-500 hover:text-red-600 gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="text-xs">{isDeleting ? "..." : "Supprimer"}</span>
                  </Button>
                )}
                {!isOwnReview && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white">
                      {canDelete && (
                        <>
                          <DropdownMenuItem
                            onClick={handleDeleteClick}
                            disabled={isDeleting}
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {isDeleting ? "Suppression..." : "Supprimer"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem
                        onClick={handleReportClick}
                        className="text-orange-600 focus:text-orange-600 focus:bg-orange-50"
                      >
                        <Flag className="h-4 w-4 mr-2" />
                        Signaler
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>

          {/* Comment - Edit mode or display mode */}
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editedComment}
                onChange={(e) => setEditedComment(e.target.value)}
                placeholder="Votre commentaire..."
                rows={3}
                className="resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                  Annuler
                </Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={isSaving || !editedComment.trim()}>
                  {isSaving ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </div>
          ) : review.comment ? (
            <p
              className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: renderFormattedText(review.comment) }}
            />
          ) : null}

          {/* Footer with date and edited indicator */}
          <div className="flex items-center justify-between pt-2 border-t text-sm">
            <div className="flex items-center gap-3 text-gray-400 text-xs">
              {review.createdAt && (
                <span>{formatDate(review.createdAt)}</span>
              )}
              {review.editedAt && (
                <span className="flex items-center gap-1 italic">
                  <Clock className="h-3 w-3" />
                  modifié le {formatDate(review.editedAt)}
                </span>
              )}
            </div>

            {/* Age Suggestion */}
            {review.ageSuggestion > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Âge :</span>
                <span className="font-semibold text-primary">{review.ageSuggestion}+</span>
              </div>
            )}
          </div>
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
