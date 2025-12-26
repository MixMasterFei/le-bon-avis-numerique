"use client"

import { useState } from "react"
import { ReviewModal } from "./ReviewModal"
import { UserInteractionBar } from "./UserInteractionBar"

interface MediaPageClientProps {
  mediaId: string
  mediaTitle: string
}

export function MediaPageClient({ mediaId, mediaTitle }: MediaPageClientProps) {
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleReviewSuccess = () => {
    // Trigger a refresh - in a real app you'd refetch reviews
    setRefreshKey((prev) => prev + 1)
    // Optionally reload the page to show new review
    window.location.reload()
  }

  return (
    <>
      <UserInteractionBar
        mediaId={mediaId}
        onReviewClick={() => setReviewModalOpen(true)}
      />
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
