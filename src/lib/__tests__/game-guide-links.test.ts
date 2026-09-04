import { describe, expect, it } from "vitest"
import { classifyLink } from "../game-guide-freshness"
import { GAME_GUIDES } from "../game-guides"

// ---------------------------------------------------------------------------
// The monthly guides report is only useful if a human trusts it. On 2026-09-01
// it announced "4/5 liens cassés": two were real (Roblox and Microsoft had
// moved their documentation) and two were an Epic edge answering 403 to our
// probe and a Zendesk help centre timing out. Half the findings were noise,
// and noise at that ratio is what makes a monthly alert stop being read.
//
// The rule that keeps it honest: only say "dead" when the answer means gone.
// ---------------------------------------------------------------------------

describe("classifyLink", () => {
  it("passes anything the fetch reported as ok", () => {
    expect(classifyLink(200, true)).toBe("ok")
    expect(classifyLink(206, true)).toBe("ok") // ranged GET fallback
  })

  it("calls 404 and 410 dead — the two statuses that mean 'gone'", () => {
    expect(classifyLink(404, false)).toBe("dead")
    expect(classifyLink(410, false)).toBe("dead")
  })

  // The Epic Games case. Their edge refuses our probe every month; if that
  // counted as dead, the task would sit permanently amber and the email would
  // demand an action that does not exist.
  it("never calls a refused probe dead", () => {
    for (const s of [401, 403, 429]) expect(classifyLink(s, false)).toBe("unverifiable")
  })

  it("never calls a server-side failure dead", () => {
    for (const s of [500, 502, 503, 504]) expect(classifyLink(s, false)).toBe("unverifiable")
  })

  // The help.minecraft.net case: the probe gave up after 10 s. A timeout is the
  // weakest possible evidence about a page.
  it("treats a timeout or network error as unverifiable", () => {
    expect(classifyLink(null, false)).toBe("unverifiable")
  })

  it("defaults to unverifiable for anything unexpected", () => {
    for (const s of [418, 451]) expect(classifyLink(s, false)).toBe("unverifiable")
  })
})

describe("les liens officiels des guides", () => {
  const links = GAME_GUIDES.flatMap((g) =>
    g.stateOfPlay.officialLinks.map((l) => ({ guide: g.name, ...l })),
  )

  it("sont tous en HTTPS et absolus", () => {
    for (const l of links) expect(l.url.startsWith("https://")).toBe(true)
  })

  // Les quatre URL retirées le 2026-09-04 : deux mortes (404) et deux
  // remplacées par une page éditeur bien plus ciblée. Les réintroduire ferait
  // silencieusement revenir le rapport à son état inexploitable.
  it("n'utilisent plus les URL retirées", () => {
    const retirees = [
      "corp.roblox.com/fr/parents-safety",
      "support.microsoft.com/fr-fr/account-billing/microsoft-family-safety",
      "help.minecraft.net/hc/fr",
      "https://www.epicgames.com/help/fr",
    ]
    for (const l of links) {
      for (const bad of retirees) {
        expect(l.url).not.toContain(bad)
      }
    }
  })

  it("portent tous un libellé et une source", () => {
    for (const l of links) {
      expect(l.label.trim().length).toBeGreaterThan(0)
      expect(l.source.trim().length).toBeGreaterThan(0)
    }
  })
})
