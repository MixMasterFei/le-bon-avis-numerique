"use client"

import { useSession } from "next-auth/react"
import { ReportCorrectionModal } from "./ReportCorrectionModal"

interface ReportCorrectionButtonProps {
  mediaId: string
  mediaTitle: string
}

export function ReportCorrectionButton({ mediaId, mediaTitle }: ReportCorrectionButtonProps) {
  const { data: session } = useSession()

  return (
    <div className="flex justify-center">
      <ReportCorrectionModal
        mediaId={mediaId}
        mediaTitle={mediaTitle}
        isLoggedIn={!!session?.user}
      />
    </div>
  )
}
