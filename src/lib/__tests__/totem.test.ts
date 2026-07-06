import { describe, expect, it } from "vitest"
import { isPathAllowed } from "../totem/nav-allowlist"
import { pickModel } from "../totem/model-router"
import { canUseTotem, getTotemAccessMode } from "../totem/access"

describe("totem nav-allowlist (isPathAllowed)", () => {
  it("allows core internal pages", () => {
    for (const p of ["/", "/connexion", "/profil", "/profil/membres/x", "/films", "/films/recherche?q=a", "/recherche", "/blog/mon-article", "/apercudecouverte/une-actu", "/apercudecouverte-v5"]) {
      expect(isPathAllowed(p), p).toBe(true)
    }
  })

  it("allows BOTH the raw and canonical media route forms", () => {
    // raw id (legacy shortcut)
    expect(isPathAllowed("/media/abc-123-def")).toBe(true)
    // canonical "<type>:<uuid>" form produced by toMediaRouteId — this is
    // the case the old regex rejected (the bug this fix addresses).
    expect(isPathAllowed("/media/movie:abc-123-def")).toBe(true)
    expect(isPathAllowed("/media/tv:9999")).toBe(true)
  })

  it("blocks admin / studio / api and external or malformed paths", () => {
    for (const p of ["/admin", "/admin/operations", "/studio", "/api/totem/chat", "https://evil.com", "//evil.com", "evil", "/media/x:y:z?<script>"]) {
      expect(isPathAllowed(p), p).toBe(false)
    }
  })

  it("blocks routes that do not exist (e.g. /news, /actualites)", () => {
    expect(isPathAllowed("/news")).toBe(false)
    expect(isPathAllowed("/news/x")).toBe(false)
    expect(isPathAllowed("/actualites/x")).toBe(false)
  })
})

describe("totem model-router (pickModel)", () => {
  const base = { turnCount: 1, lastTurnToolCount: 0, userText: "un film pour ce soir ?" }

  it("stays on the default model for a short benign turn", () => {
    const d = pickModel(base)
    expect(d.reason).toBe("default")
  })

  it("escalates on a long thread", () => {
    const d = pickModel({ ...base, turnCount: 8 })
    expect(d.reason).toBe("long_thread")
    expect(d.model).not.toBe(pickModel(base).model)
  })

  it("escalates after a multi-tool previous turn", () => {
    expect(pickModel({ ...base, lastTurnToolCount: 2 }).reason).toBe("multi_tool_prev")
  })

  it("escalates on a grave/sensitive keyword (accent-insensitive)", () => {
    expect(pickModel({ ...base, userText: "mon enfant fait des cauchemars" }).reason).toBe("grave_keyword")
    expect(pickModel({ ...base, userText: "victime de harcelement a l'ecole" }).reason).toBe("grave_keyword")
    expect(pickModel({ ...base, userText: "Harcèlement scolaire" }).reason).toBe("grave_keyword")
  })
})

describe("totem access gate (canUseTotem)", () => {
  function withFlag<T>(value: string | undefined, fn: () => T): T {
    const prev = process.env.TOTEM_PUBLIC
    if (value === undefined) delete process.env.TOTEM_PUBLIC
    else process.env.TOTEM_PUBLIC = value
    try {
      return fn()
    } finally {
      if (prev === undefined) delete process.env.TOTEM_PUBLIC
      else process.env.TOTEM_PUBLIC = prev
    }
  }

  const admin = { isAuthenticated: true, role: "ADMIN" }
  const member = { isAuthenticated: true, role: "USER" }
  const anon = { isAuthenticated: false, role: null }

  it("defaults to admin-only when the flag is unset", () => {
    withFlag(undefined, () => {
      expect(getTotemAccessMode()).toBe("admin-only")
      expect(canUseTotem(admin)).toBe(true)
      expect(canUseTotem(member)).toBe(false)
      expect(canUseTotem(anon)).toBe(false)
    })
  })

  it("'auth' opens to any authenticated user but not anonymous", () => {
    withFlag("auth", () => {
      expect(getTotemAccessMode()).toBe("authenticated")
      expect(canUseTotem(member)).toBe(true)
      expect(canUseTotem(admin)).toBe(true)
      expect(canUseTotem(anon)).toBe(false)
    })
  })

  it("'true' opens to authenticated users but NEVER to anonymous visitors", () => {
    withFlag("true", () => {
      expect(getTotemAccessMode()).toBe("authenticated")
      expect(canUseTotem(member)).toBe(true)
      expect(canUseTotem(anon)).toBe(false)
    })
  })

  it("no flag value ever grants anonymous access (account gate is hard)", () => {
    for (const v of [undefined, "auth", "true", "1", "authenticated", "public", "garbage"]) {
      withFlag(v, () => {
        expect(canUseTotem(anon), `flag=${String(v)}`).toBe(false)
      })
    }
  })
})
