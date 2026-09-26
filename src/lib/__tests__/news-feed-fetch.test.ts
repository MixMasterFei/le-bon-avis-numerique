import { afterEach, describe, expect, it, vi } from "vitest"
import { parseFeed, type FeedParser } from "@/lib/news-feed-fetch"

// Publishers Weekly gzips its feed whatever the request asks for; rss-parser's
// HTTP client hands the raw bytes to the XML parser, which fails on byte one.
// The retry through fetch() is what brings that source back — and it must stay
// limited to parse failures, or every dead feed would cost two requests.

const UA = "TestBot/1.0"
const FEED = { items: [{ title: "Un article" }] }

function parserFailingWith(message: string): FeedParser<typeof FEED> {
  return {
    parseURL: vi.fn().mockRejectedValue(new Error(message)),
    parseString: vi.fn().mockResolvedValue(FEED),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("parseFeed", () => {
  it("returns the feed straight away when rss-parser reads it", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    const parser: FeedParser<typeof FEED> = {
      parseURL: vi.fn().mockResolvedValue(FEED),
      parseString: vi.fn(),
    }

    await expect(parseFeed(parser, "https://ex.test/rss", UA)).resolves.toBe(FEED)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("retries a parse failure through fetch(), which decodes gzip", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("<rss></rss>", { status: 200 }))
    vi.stubGlobal("fetch", fetchSpy)
    const parser = parserFailingWith("Non-whitespace before first tag.\nLine: 0\nColumn: 1\nChar: \u001f")

    await expect(parseFeed(parser, "https://ex.test/rss", UA)).resolves.toBe(FEED)
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(fetchSpy.mock.calls[0][1].headers["user-agent"]).toBe(UA)
    expect(parser.parseString).toHaveBeenCalledWith("<rss></rss>")
  })

  it.each(["Status code 404", "Request timed out after 6000ms"])(
    "does not retry a real outage (%s)",
    async (message) => {
      const fetchSpy = vi.fn()
      vi.stubGlobal("fetch", fetchSpy)

      await expect(parseFeed(parserFailingWith(message), "https://ex.test/rss", UA)).rejects.toThrow(message)
      expect(fetchSpy).not.toHaveBeenCalled()
    },
  )

  it("reports the original parse error when the retry is refused too", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 403 })))

    await expect(
      parseFeed(parserFailingWith("Non-whitespace before first tag."), "https://ex.test/rss", UA),
    ).rejects.toThrow("Non-whitespace before first tag.")
  })
})
