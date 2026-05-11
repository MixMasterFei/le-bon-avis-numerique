// Image hosts that reliably block browser hotlinking. Keeping them out
// of rendered news cards avoids noisy 403s and hydration-era image churn
// on /apercudecouverte-v3.
const BLOCKED_HOTLINK_IMAGE_HOSTS = ["cdn.sortiraparis.com"]

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
