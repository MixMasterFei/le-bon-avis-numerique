import { describe, expect, it } from "vitest"
import { getClientIpFromHeaders } from "./client-ip"

describe("client IP for throttling", () => {
  it("ignores spoofed Cloudflare headers", () => {
    const headers = new Headers({ "x-real-ip": "203.0.113.1", "cf-connecting-ip": "spoof-1" })
    expect(getClientIpFromHeaders(headers)).toBe("203.0.113.1")
    headers.set("cf-connecting-ip", "spoof-2")
    expect(getClientIpFromHeaders(headers)).toBe("203.0.113.1")
    expect(getClientIpFromHeaders(new Headers({ "cf-connecting-ip": "spoof" }))).toBe("unknown")
  })
  it("supports trusted Vercel forwarding and a conservative unknown bucket", () => {
    expect(getClientIpFromHeaders(new Headers({ "x-vercel-forwarded-for": "203.0.113.2, 10.0.0.1" }))).toBe("203.0.113.2")
    expect(getClientIpFromHeaders(new Headers())).toBe("unknown")
  })
})
