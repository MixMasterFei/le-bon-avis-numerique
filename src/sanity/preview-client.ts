import { createClient } from "@sanity/client"
import { projectId, dataset, apiVersion } from "./env"

/**
 * Server-only Sanity client that can read DRAFT documents.
 *
 * Drafts (ids prefixed with `drafts.`) are invisible to the public CDN client.
 * This client uses the write token (read access) with the CDN disabled so the
 * admin blog preview can render staged posts before they are published.
 *
 * Returns null when no token is configured — callers must handle that and show
 * a message instead of crashing. Never import this into a client component.
 */
const token = process.env.SANITY_API_WRITE_TOKEN

export const sanityPreviewClient = token
  ? createClient({ projectId, dataset, apiVersion, token, useCdn: false })
  : null
