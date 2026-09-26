/**
 * Fetch + parse one RSS/Atom feed for the news pipeline.
 *
 * rss-parser's own HTTP client does not decode compression. A server that
 * gzips whatever the request says (Publishers Weekly) hands it raw bytes, and
 * the XML parse dies on the first one ("Non-whitespace before first tag").
 * fetch() decodes gzip/br, so a PARSE failure gets one retry through it.
 * HTTP errors and timeouts are real outages: they are not retried, so a dead
 * feed still costs a single request.
 */

export interface FeedParser<F> {
  parseURL(url: string): Promise<F>
  parseString(xml: string): Promise<F>
}

const FETCH_TIMEOUT_MS = 6000

export async function parseFeed<F>(parser: FeedParser<F>, url: string, userAgent: string): Promise<F> {
  try {
    return await parser.parseURL(url)
  } catch (err) {
    if (/^Status code|timed out/i.test((err as Error).message)) throw err
    const res = await fetch(url, {
      headers: { "user-agent": userAgent },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) throw err
    return parser.parseString(await res.text())
  }
}
