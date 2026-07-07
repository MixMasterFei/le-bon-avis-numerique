"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ReviewModal } from "./ReviewModal"
import { MediaActions } from "./MediaActions"

interface MediaPageClientProps {
  mediaId: string
  mediaTitle: string
  showActions?: boolean
  /** Written avis count — lets the actions row surface "Avis (N)" jumping to
   *  the feedback section (see OPEN_FAMILY_FEEDBACK_EVENT). */
  reviewCount?: number
}

/** Fired by the top "Avis (N)" pill; DashboardFamilyFeedback listens, opens
 *  itself on the right tab and scrolls into view. */
export const OPEN_FAMILY_FEEDBACK_EVENT = "totem:open-family-feedback"

export function MediaPageClient({
  mediaId,
  mediaTitle,
  showActions = false,
  reviewCount = 0,
}: MediaPageClientProps) {
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const router = useRouter()

  const handleReviewSuccess = () => {
    router.refresh()
  }

  return (
    <>
      {showActions && (
        <MediaActions
          mediaId={mediaId}
          mediaTitle={mediaTitle}
          onReviewClick={() => setReviewModalOpen(true)}
          reviewCount={reviewCount}
          onSeeReviews={() => window.dispatchEvent(new CustomEvent(OPEN_FAMILY_FEEDBACK_EVENT))}
          className="mb-6"
        />
      )}
      <ReviewModal
        open={reviewModalOpen}
        onOpenChange={setReviewModalOpen}
        mediaId={mediaId}
        mediaTitle={mediaTitle}
        onSuccess={handleReviewSuccess}
      />
    </>
  )
}
