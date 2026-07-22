import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { isAdmin } from "@/lib/auth"
import { mediaV3Enabled } from "@/lib/media-v3-flag"
import { getDashboardMedia } from "@/lib/media-dashboard-data"
import { parseMediaRouteId, toMediaRouteId } from "@/lib/media-route"
import { contentAnalysisHiddenReason } from "@/lib/release-status"
import { buildQuickAnswer } from "@/lib/quick-answer"
import { FicheDataProvider } from "@/components/media/FicheDataContext"
import { MediaDashboard } from "@/components/media-v3/MediaDashboard"
import { DashboardBreadcrumb } from "@/components/media-v3/DashboardBreadcrumb"
import { MediaV3Toggle } from "@/components/media-v3/MediaV3Toggle"

// Admin preview surface: reads auth() (dynamic) and must never be indexed.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Fiche — aperçu dashboard",
  robots: { index: false, follow: false },
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function MediaDashboardPage({ params }: PageProps) {
  const { id } = await params
  const { id: rawId } = parseMediaRouteId(id)

  // Gate: admins now, everyone once MEDIA_V3_PUBLIC flips on. Non-eligible
  // viewers just get the classic fiche.
  if (!mediaV3Enabled(await isAdmin())) {
    redirect(`/media/${id}`)
  }

  const media = await getDashboardMedia(rawId)
  // Off-catalog titles (external/mock) aren't supported by the preview — send
  // them to the classic fiche, which handles those sources.
  if (!media) {
    redirect(`/media/${id}`)
  }

  const routeId = toMediaRouteId(media.type, media.id)
  const hiddenReason = contentAnalysisHiddenReason({
    releaseDate: media.releaseDate,
    isProvisional: media.isProvisional,
    releaseStatus: media.releaseStatus,
  })
  const hideAnalysis = hiddenReason !== null

  // Preview parity: same quick answer + breadcrumb as the public dashboard
  // branch in /media/[id]/page.tsx, so what admins preview is what ships.
  const quickAnswer = buildQuickAnswer({
    title: media.title,
    type: media.type,
    expertAgeRec: media.expertAgeRec,
    contentMetrics: media.metrics ?? {
      violence: 0,
      sexNudity: 0,
      language: 0,
      consumerism: 0,
      substanceUse: 0,
      positiveMessages: 0,
      roleModels: 0,
    },
    hideContentAnalysis: hideAnalysis,
    hiddenReason,
  })

  return (
    <FicheDataProvider mediaId={media.id} mediaType={media.type}>
      <MediaDashboard
        media={media}
        dbId={media.id}
        hideAnalysis={hideAnalysis}
        hiddenReason={hiddenReason}
        quickAnswer={{ question: quickAnswer.question, answer: quickAnswer.answer }}
        breadcrumb={<DashboardBreadcrumb type={media.type} title={media.title} />}
      />
      <MediaV3Toggle variant="dashboard" routeId={routeId} />
    </FicheDataProvider>
  )
}
