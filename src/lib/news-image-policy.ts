import type { Prisma } from "@prisma/client"

// Image hosts that reliably block browser hotlinking. Keeping them out
// of rendered news cards avoids noisy 403s and hydration-era image churn
// on /apercudecouverte-v3.
const BLOCKED_HOTLINK_IMAGE_HOSTS = ["cdn.sortiraparis.com"]

// French publishers whose RSS/OG images are editorially safe for V4
// FILM_TV and GAMES cards — prefer these over generic stock visuals.
// Names are normalized via normalizedPublisherName() below.
const TRUSTED_PUBLISHER_NORMALIZED = new Set([
  "allocine",
  "telerama",
  "numerama",
  "franceinfo",
  "20-minutes",
  "la-croix",
  "le-monde",
  "premiere",
  "pedagojeux",
  "nintendo-master",
  "jeuxvideo-com",
  "frandroid",
  "01net",
  "magicmaman",
  "parents-fr",
])

// Publishers whose RSS images are consistently generic mascot
// illustrations or off-topic stock visuals — they look out of place
// next to wire/agency photography in the news grid. resolveImage()
// returns null for these publishers, and the news-discover pipeline's
// "no image → drop story" rule does the rest.
//
// This is a curation choice, not a quality bug — re-enable a publisher
// by removing its name here. Keep names byte-identical to the
// `sourceName` set in src/lib/news-sources.ts.
const LOW_QUALITY_IMAGE_PUBLISHERS = new Set<string>([
  "Geek Junior",
])

export function imageHostFromUrl(url: string | undefined | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function isBlockedHotlinkImageUrl(url: string | undefined | null): boolean {
  const host = imageHostFromUrl(url)
  if (!host) return false
  return BLOCKED_HOTLINK_IMAGE_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))
}

export function isLowQualityImagePublisher(sourceName: string | undefined | null): boolean {
  if (!sourceName) return false
  return LOW_QUALITY_IMAGE_PUBLISHERS.has(sourceName)
}

export function normalizedPublisherName(name: string): string {
  const lower = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  if (lower.startsWith("numerama")) return "numerama"
  if (lower.startsWith("allocine")) return "allocine"
  if (lower.startsWith("20 minutes")) return "20-minutes"
  if (lower.startsWith("franceinfo")) return "franceinfo"
  if (lower.startsWith("la croix")) return "la-croix"
  if (lower.startsWith("le monde")) return "le-monde"
  if (lower.startsWith("telerama")) return "telerama"
  if (lower.startsWith("bbc")) return "bbc"

  return lower.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export function hasTrustedPublisherSource(sources: Prisma.JsonValue | null): boolean {
  if (!Array.isArray(sources)) return false
  for (const entry of sources) {
    if (typeof entry !== "object" || entry === null) continue
    const name = (entry as { name?: unknown }).name
    if (typeof name === "string" && TRUSTED_PUBLISHER_NORMALIZED.has(normalizedPublisherName(name))) {
      return true
    }
  }
  return false
}
