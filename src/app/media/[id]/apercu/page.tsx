import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { isAdmin } from "@/lib/auth"
import { mediaV3Enabled } from "@/lib/media-v3-flag"
import { getDashboardMedia } from "@/lib/media-dashboard-data"
import { parseMediaRouteId, toMediaRouteId } from "@/lib/media-route"
import { shouldHideContentAnalysis } from "@/lib/release-status"
import { FicheDataProvider } from "@/components/media/FicheDataContext"
import { MediaDashboard } from "@/components/media-v3/MediaDashboard"
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
  const hideAnalysis = shouldHideContentAnalysis({
    releaseDate: media.releaseDate,
    isProvisional: media.isProvisional,
    releaseStatus: media.releaseStatus,
  })

  return (
    <FicheDataProvider mediaId={media.id} mediaType={media.type}>
      <MediaDashboard media={media} dbId={media.id} hideAnalysis={hideAnalysis} />
      <MediaV3Toggle variant="dashboard" routeId={routeId} />
    </FicheDataProvider>
  )
}
