import { prisma } from "@/lib/prisma"
import { createNotification, NOTIFICATION_TYPES } from "@/lib/notifications"
import { toMediaRouteId } from "@/lib/media-route"
import type { MediaType } from "@/lib/types"

/**
 * Fires the "Prévenez-moi" alerts: for every subscription that hasn't been
 * notified yet and whose title has now reached its release date, drop a
 * MAJOR_RELEASE notification in the user's bell and stamp notifiedAt so it
 * never fires twice. Run daily.
 */
export async function runReleaseAlerts(): Promise<{ notified: number; scanned: number }> {
  const now = new Date()
  // Fire on the captured FR availability date (notifyAt), NOT the TMDB primary
  // MediaItem.releaseDate — which is often an earlier/foreign date and would
  // wrongly say "disponible" weeks before the French release.
  const due = await prisma.releaseAlert.findMany({
    where: {
      notifiedAt: null,
      notifyAt: { not: null, lte: now },
    },
    take: 1000,
    include: { media: { select: { id: true, title: true, type: true } } },
  })

  let notified = 0
  for (const alert of due) {
    try {
      const href = `/media/${toMediaRouteId(alert.media.type as MediaType, alert.media.id)}`
      await createNotification({
        userId: alert.userId,
        type: NOTIFICATION_TYPES.MAJOR_RELEASE,
        priority: "IMPORTANT",
        title: `${alert.media.title} est disponible`,
        body: "Le titre que vous suiviez vient de sortir — sa fiche est prête, avec l'âge conseillé.",
        href,
        metadata: { mediaId: alert.media.id },
      })
      await prisma.releaseAlert.update({ where: { id: alert.id }, data: { notifiedAt: now } })
      notified++
    } catch (e) {
      console.error("[release-alerts] failed for alert", alert.id, e)
    }
  }
  return { notified, scanned: due.length }
}
