import { prisma } from "@/lib/prisma"

/**
 * Write the denormalised platform columns WITHOUT bumping `updatedAt`.
 *
 * MediaItem.updatedAt is `@updatedAt`, so any `prisma.mediaItem.update()` moves
 * it — and sitemap.ts publishes it verbatim as each fiche's `lastModified`. A
 * streaming catch-up over the ~9 000 titles last verified in April/May would
 * therefore announce 9 000 freshly-modified pages to Google in one pass, when
 * nothing a reader sees has changed but a platform badge. On a site already
 * fighting crawler burn that is worse than the stale badge it fixes, and it
 * teaches Google that our lastmod means nothing.
 *
 * Prisma applies `@updatedAt` client-side, so a raw UPDATE is the documented
 * way to opt out. `streamingCheckedAt` is the honest cursor for "when did we
 * last check this" and is what the rotation reads.
 *
 * Editorial writes (synopsis, age, title, enrichment) must keep going through
 * the normal client — those ARE content changes and SHOULD move lastmod.
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
