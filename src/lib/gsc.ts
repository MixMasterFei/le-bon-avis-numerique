// Minimal Google Search Console client — OAuth refresh-token → Search
// Analytics API, via plain fetch (no googleapis dependency).
//
// Required env (set in Vercel):
//   GSC_OAUTH_CLIENT_ID, GSC_OAUTH_CLIENT_SECRET, GSC_OAUTH_REFRESH_TOKEN
//   GSC_PROPERTY_URL   e.g. "https://totemavise.com/" or "sc-domain:totemavise.com"

const TOKEN_URL = "https://oauth2.googleapis.com/token"

export function isGscConfigured(): boolean {
  return Boolean(
    process.env.GSC_OAUTH_CLIENT_ID &&
      process.env.GSC_OAUTH_CLIENT_SECRET &&
      process.env.GSC_OAUTH_REFRESH_TOKEN &&
      process.env.GSC_PROPERTY_URL,
  )
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GSC_OAUTH_CLIENT_ID
  const clientSecret = process.env.GSC_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GSC_OAUTH_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("GSC OAuth env vars missing (CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN)")
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GSC token refresh failed (${res.status}). Vérifie les identifiants OAuth. ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) throw new Error("GSC token refresh returned no access_token")
  return data.access_token
}

export interface GscRow {
  /** Values in the order of the requested `dimensions`. */
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  /** 1-based average position (lower = better). */
  position: number
}

export interface SearchAnalyticsParams {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  dimensions: Array<"query" | "page" | "country" | "device" | "date">
  rowLimit?: number
  dimensionFilterGroups?: unknown[]
}

export async function querySearchAnalytics(params: SearchAnalyticsParams): Promise<GscRow[]> {
  const siteUrl = process.env.GSC_PROPERTY_URL
  if (!siteUrl) throw new Error("GSC_PROPERTY_URL missing")

  const token = await getAccessToken()
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: params.dimensions,
      rowLimit: params.rowLimit ?? 1000,
      ...(params.dimensionFilterGroups ? { dimensionFilterGroups: params.dimensionFilterGroups } : {}),
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    // 403 here usually means the property URL is wrong or the account lacks access.
    throw new Error(`GSC searchAnalytics failed (${res.status}) pour ${siteUrl}. ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as { rows?: GscRow[] }
  return data.rows ?? []
}

/** YYYY-MM-DD helpers honouring GSC's ~2–3 day data lag. */
export function gscDateRange(days = 28, lagDays = 3): { startDate: string; endDate: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const end = new Date()
  end.setUTCDate(end.getUTCDate() - lagDays)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - days)
  return { startDate: fmt(start), endDate: fmt(end) }
}
