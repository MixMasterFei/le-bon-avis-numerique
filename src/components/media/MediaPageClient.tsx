"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ReviewModal } from "./ReviewModal"
import { MediaActions } from "./MediaActions"

interface MediaPageClientProps {
  mediaId: string
  mediaTitle: string
  showActions?: boolean
}

export function MediaPageClient({ mediaId, mediaTitle, showActions = false }: MediaPageClientProps) {
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
          onReviewClick={() => setReviewModalOpen(true)}
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
