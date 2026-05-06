// Image hosts that reliably block browser hotlinking. Keeping them out
// of rendered news cards avoids noisy 403s and hydration-era image churn
// on /apercudecouverte-v3.
const BLOCKED_HOTLINK_IMAGE_HOSTS = ["cdn.sortiraparis.com"]

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
