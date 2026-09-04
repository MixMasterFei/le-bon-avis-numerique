/** Vercel overwrites these headers. A self-hosted proxy must do the same. */
export function getClientIpFromHeaders(headers: Headers): string {
  // Cloudflare is not our ingress: cf-connecting-ip can be client supplied.
  return headers.get("x-real-ip")?.trim() ||
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
}
