"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { MessageSquarePlus } from "lucide-react"
import { ReviewCardWithReport } from "./ReviewCardWithReport"
import { ReviewModal } from "./ReviewModal"
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
  /** When provided, the empty state becomes an actionable "be the first" CTA
   *  (review modal when logged in, sign-in link otherwise). */
  mediaId?: string
  mediaTitle?: string
}

export function ReviewsSection({ reviews, mediaId, mediaTitle }: ReviewsSectionProps) {
  const p = APERCU_PALETTE
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [reviewModalOpen, setReviewModalOpen] = useState(false)

  if (reviews.length === 0) {
    const canCta = !!mediaId && !!mediaTitle
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{
          background: p.card,
          border: `1px solid ${p.line}`,
          color: p.ink2,
        }}
      >
        <p>Aucun avis pour le moment.</p>
        {canCta ? (
          session?.user ? (
            <>
              <button
                type="button"
                onClick={() => setReviewModalOpen(true)}
                className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: p.accent }}
              >
                <MessageSquarePlus className="h-4 w-4" />
                Soyez le premier à donner votre avis
              </button>
              <ReviewModal
                open={reviewModalOpen}
                onOpenChange={setReviewModalOpen}
                mediaId={mediaId}
                mediaTitle={mediaTitle}
                onSuccess={() => router.refresh()}
              />
            </>
          ) : (
            <Link
              href={`/connexion?callbackUrl=${encodeURIComponent(pathname)}`}
              className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: p.accent }}
            >
              <MessageSquarePlus className="h-4 w-4" />
              Soyez le premier à donner votre avis
            </Link>
          )
        ) : (
          <p className="mt-1">Soyez le premier à partager votre expérience !</p>
        )}
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
