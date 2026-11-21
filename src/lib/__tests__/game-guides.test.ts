import { describe, expect, it } from "vitest"
import { GAME_GUIDES, getGameGuide, guideKeyForTitle } from "../game-guides"
import { TOP_GAMES } from "@/app/jeux/quel-age/topGames.data"
import { gameGuideEnabled, isGameGuidePublic } from "../game-guide-flag"

describe("game guide flag", () => {
  it("is admin-only by default", () => {
    const prev = process.env.GAME_GUIDES_PUBLIC
    delete process.env.GAME_GUIDES_PUBLIC
    expect(isGameGuidePublic()).toBe(false)
    expect(gameGuideEnabled(false)).toBe(false)
    expect(gameGuideEnabled(true)).toBe(true)
    if (prev !== undefined) process.env.GAME_GUIDES_PUBLIC = prev
  })
})

describe("GAME_GUIDES", () => {
  it("every guide key exists in the seed list", () => {
    const seeds = new Set(TOP_GAMES.map((s) => s.key))
    for (const g of GAME_GUIDES) expect(seeds.has(g.key), `orphan guide: ${g.key}`).toBe(true)
  })

  it("carries both layers — understanding and a dated état du jeu", () => {
    for (const g of GAME_GUIDES) {
      expect(g.whatItIs.length).toBeGreaterThan(50)
      expect(g.whatHappens.length).toBeGreaterThan(1)
      expect(g.decisions.length).toBeGreaterThan(1)
      expect(g.stateOfPlay.facts.length).toBeGreaterThan(0)
      expect(g.playTogether.ideas.length).toBeGreaterThan(1)
    }
  })

  it("always states what the controls do NOT do", () => {
    // The dominant risk is not staleness, it's confident wrongness — a parent
    // believing they capped spending when they did not. Every guide must name
    // the limits of the controls it describes.
    for (const g of GAME_GUIDES) {
      expect(g.stateOfPlay.doesNotDo.length, `${g.key} has no doesNotDo`).toBeGreaterThan(0)
    }
  })

  it("dates the perishable block with a real, non-future date", () => {
    for (const g of GAME_GUIDES) {
      const d = new Date(g.stateOfPlay.verifiedOn)
      expect(Number.isNaN(d.getTime()), `${g.key}: bad date`).toBe(false)
      expect(d.getTime()).toBeLessThanOrEqual(Date.now() + 24 * 3600 * 1000)
    }
  })

  it("routes to official pages instead of transcribing menu paths", () => {
    // Deep-linking is the single largest rot reduction available: the vendor
    // maintains their own path for free. A guide that spells out
    // "Paramètres > Confidentialité > Chat" breaks on the next redesign.
    const pathLike = /paramètres\s*>|settings\s*>|réglages\s*>/i
    for (const g of GAME_GUIDES) {
      expect(g.stateOfPlay.officialLinks.length, `${g.key} has no official link`).toBeGreaterThan(0)
      for (const l of g.stateOfPlay.officialLinks) expect(l.url).toMatch(/^https:\/\//)
      for (const f of [...g.stateOfPlay.facts, ...g.stateOfPlay.doesNotDo]) {
        expect(pathLike.test(f), `${g.key} transcribes a menu path: "${f}"`).toBe(false)
      }
    }
  })

  it("has an advanced tier for parents who game but not this one", () => {
    for (const g of GAME_GUIDES) expect(g.advanced.length).toBeGreaterThan(1)
  })

  it("resolves catalogue titles, including editions and seasons", () => {
    expect(guideKeyForTitle("Roblox")).toBe("roblox")
    expect(guideKeyForTitle("Minecraft: Java Edition")).toBe("minecraft")
    expect(guideKeyForTitle("Fortnite OG: Chapter 1 Season 7")).toBe("fortnite")
    expect(guideKeyForTitle("The Legend of Zelda: Ocarina of Time")).toBe("zelda-ocarina-of-time")
    // The franchise seed has no guide: other Zelda fiches get no button.
    expect(guideKeyForTitle("The Legend of Zelda: Tears of the Kingdom")).toBeNull()
    expect(guideKeyForTitle("Call of Duty: Black Ops 6")).toBeNull()
    expect(guideKeyForTitle("L'Odyssée")).toBeNull()
  })

  it("getGameGuide returns null for unknown keys", () => {
    expect(getGameGuide("nope")).toBeNull()
    expect(getGameGuide("roblox")?.name).toBe("Roblox")
  })
})

describe("guides must not cannibalise the fiches", () => {
  // The fiche owns "à partir de quel âge" — its <title> and its FAQPage both
  // answer it. A guide that competes for the same query splits signal with the
  // 1 860-fiche asset it was meant to amplify. The guide answers "comment on
  // s'y prend", never "à partir de quel âge".
  it("no guide asserts an age verdict in its headline copy", () => {
    const ageVerdict = /à partir de quel âge|dès \d{1,2} ans|quel âge/i
    for (const g of GAME_GUIDES) {
      expect(ageVerdict.test(g.tagline), `${g.key} tagline: "${g.tagline}"`).toBe(false)
      expect(ageVerdict.test(g.whatItIs), `${g.key} whatItIs`).toBe(false)
    }
  })

  it("names no YouTube creators or channels", () => {
    // Minecraft/Roblox YouTube has the worst documented base rate of top
    // creators later accused of grooming minors, and a published
    // recommendation is a standing endorsement with no monitoring mechanism.
    // The abstention is itself the trust asset.
    const creatorish = /youtube|youtubeur|chaîne de|@[a-z0-9_]{3,}|twitch/i
    for (const g of GAME_GUIDES) {
      const prose = [
        g.tagline, g.whatItIs, g.whyKidsLove, g.playTogether.intro,
        ...g.whatHappens, ...g.advanced, ...g.playTogether.ideas,
        ...g.decisions.map((d) => `${d.question} ${d.detail}`),
      ].join(" ")
      expect(creatorish.test(prose), `${g.key} references a creator/platform`).toBe(false)
    }
  })

  it("links only to official publisher/platform documentation", () => {
    // fortnite.com is Epic's own product domain — the French parental-controls
    // page lives there, not under the generic epicgames.com/help root (which
    // 403s our probe and isn't game-specific anyway).
    // Matched on the HOST, not anywhere in the URL: a third-party page whose
    // path merely mentions "playstation.com" must not pass.
    const official =
      /^(?:[a-z0-9-]+\.)*(?:roblox\.com|epicgames\.com|fortnite\.com|minecraft\.net|microsoft\.com|xbox\.com|playstation\.com|nintendo\.com|nintendo\.fr|supercell\.com|rockstargames\.com|pegi\.info|ea\.com|activision\.com|innersloth\.com|apple\.com|google\.com)$/i
    for (const g of GAME_GUIDES) {
      for (const l of g.stateOfPlay.officialLinks) {
        const host = new URL(l.url).hostname
        expect(official.test(host), `${g.key}: non-official link ${l.url}`).toBe(true)
      }
    }
  })

  it("never names the internal data providers or credits the CSA", () => {
    // CLAUDE.md: no third-party service names in rendered text, and the CSA
    // became the Arcom on 1 January 2022.
    const forbidden = /\b(tmdb|igdb|openai|claude|anthropic|chatgpt|csa)\b/i
    for (const g of GAME_GUIDES) {
      const text = JSON.stringify({ ...g, stateOfPlay: { ...g.stateOfPlay, officialLinks: [] } })
      expect(forbidden.test(text), `${g.key} names a forbidden source`).toBe(false)
    }
  })

  it("never states a Totem age verdict anywhere in the guide", () => {
    // The live strip at the top of the page shows the fiche's age and links
    // to it — that is the single mention. The prose never repeats it.
    const totemAge = /dès \d{1,2} ans|à partir de \d{1,2} ans|conseillé (?:à partir|dès)/i
    for (const g of GAME_GUIDES) {
      const text = JSON.stringify(g)
      expect(totemAge.test(text), `${g.key} states an age verdict`).toBe(false)
    }
  })

  it("cites an official classification at most twice", () => {
    // A PEGI label is a fact a parent needs (and FC 26 vs FC 27 needs both),
    // but a guide that repeats it is drifting into age-page territory.
    for (const g of GAME_GUIDES) {
      const mentions = JSON.stringify(g).match(/\bPEGI \d{1,2}\b|\bESRB [A-Z]/g) ?? []
      expect(mentions.length, `${g.key}: ${mentions.join(", ")}`).toBeLessThanOrEqual(2)
    }
  })
})

describe("guides pinned to a fiche", () => {
  it("pin a well-formed catalogue id", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    for (const g of GAME_GUIDES) {
      if (g.catalogueId) expect(g.catalogueId, g.key).toMatch(uuid)
    }
  })
})
