import type { Prisma } from "@prisma/client"

// Image hosts that reliably block browser hotlinking. Keeping them out
// of rendered news cards avoids noisy 403s and hydration-era image churn
// on the news feeds (/apercudecouverte-v4, /apercudecouverte-v5).
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

// Publishers / image hosts whose article thumbnail is a flat brand graphic
// that reads as an empty placeholder — e.g. Better Internet for Kids ships a
// solid-violet "BIK+" card as its RSS image, which rendered as blank violet
// tiles on the Coin Famille grid. UNLIKE LOW_QUALITY_IMAGE_PUBLISHERS above
// (dropped at ingest), these are trusted, family-relevant sources we KEEP —
// we only swap the unusable image for our branded category card. Consulted
// both at ingest (resolveImage → null → the caller card-substitutes, story
// kept) and at render (coin-famille-news realPhotoUrl) so already-stored rows
// flip to the branded card too. Add a source by name and/or its image host.
const CARD_ONLY_IMAGE_HOSTS = ["better-internet-for-kids.europa.eu"]
const CARD_ONLY_IMAGE_PUBLISHERS = new Set<string>(["Better Internet for Kids (UE)"])

// Strip a trailing " (…)" region tag so a stored credit "Better Internet for
// Kids" matches the feed name "Better Internet for Kids (UE)".
function stripRegionTag(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim()
}

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

/** Publisher whose image we skip (branded card instead) but whose article we keep. */
export function isCardOnlyImagePublisher(name: string | undefined | null): boolean {
  if (!name) return false
  if (CARD_ONLY_IMAGE_PUBLISHERS.has(name)) return true
  const base = stripRegionTag(name)
  for (const p of CARD_ONLY_IMAGE_PUBLISHERS) if (stripRegionTag(p) === base) return true
  return false
}

/** Image host whose graphic is an unusable flat brand card (→ branded card instead). */
export function isCardOnlyImageUrl(url: string | undefined | null): boolean {
  const host = imageHostFromUrl(url)
  if (!host) return false
  return CARD_ONLY_IMAGE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
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
