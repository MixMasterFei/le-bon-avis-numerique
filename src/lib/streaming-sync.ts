import { prisma } from "@/lib/prisma"

/**
 * Write the denormalised platform columns WITHOUT bumping `updatedAt`.
 *
 * MediaItem.updatedAt is `@updatedAt`, so any `prisma.mediaItem.update()` moves
 * it. The public freshness signals (sitemap <lastmod>, JSON-LD dateModified,
 * « Fiche mise à jour le ») now read `contentUpdatedAt` instead — trigger-kept,
 * it only moves when the age, synopsis or analysis changes — but `updatedAt`
 * still orders internal queues (e.g. the recalibration sweep), and a streaming
 * catch-up over ~9 000 titles would make it mean "a platform badge changed"
 * everywhere. Bookkeeping writes stay out of it.
 *
 * Prisma applies `@updatedAt` client-side, so a raw UPDATE is the documented
 * way to opt out. `streamingCheckedAt` is the honest cursor for "when did we
 * last check this" and is what the rotation reads.
 *
 * Editorial writes (synopsis, age, title, enrichment) keep going through the
 * normal client — those ARE changes. Whether they move the public lastmod is
 * decided by the DB triggers on content_updated_at, whatever client wrote.
 */
export async function syncPlatforms(mediaId: string, platforms: string[]): Promise<void> {
  await prisma.$executeRaw`
    UPDATE media_items
    SET platforms = ${platforms}::text[],
        streaming_checked_at = now()
    WHERE id = ${mediaId}
  `
}

/** Same, for the "no offer at all" case: clears the badge, stamps the cursor. */
export async function clearPlatforms(mediaId: string): Promise<void> {
  await syncPlatforms(mediaId, [])
}

/**
 * Advance the rotation cursor only, leaving `platforms` untouched — for a title
 * TMDB answered about but that has no French offer to record. Same no-bump
 * reasoning: nothing a reader sees changed.
 */
export async function touchStreamingChecked(mediaId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE media_items SET streaming_checked_at = now() WHERE id = ${mediaId}
  `
}
