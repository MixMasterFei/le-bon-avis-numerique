import { notFound } from "next/navigation"
import { parseMediaRouteId } from "@/lib/media-route"
import { isPureInteger, lookupMedia } from "./media-data"

/**
 * Answers a real 404 for a fiche that does not exist.
 *
 * The page already calls notFound(), but it renders inside loading.tsx's
 * Suspense boundary: by then the 200 status line and the skeleton have been
 * streamed, so a missing fiche went out as « 200 + noindex » (a soft 404 —
 * eight of them in Search Console in Nov 2026). This layout sits ABOVE that
 * boundary, so its notFound() lands before the first byte and sets the status.
 *
 * Same lookup as the page (cached per request, so no extra query). Two cases
 * are left to the page on purpose:
 * - a pure numeric id with a type prefix, which the page may still resolve
 *   from the external catalogues;
 * - a database failure: that throws (a 5xx Google retries), never a 404 that
 *   would tell it to drop the fiche.
 */
export default async function MediaFicheLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { type, id: rawId } = parseMediaRouteId(id)
  const { media, failed, error } = await lookupMedia(rawId, type)
  if (failed) throw error
  if (!media && !(type && isPureInteger(rawId))) notFound()
  return children
}
