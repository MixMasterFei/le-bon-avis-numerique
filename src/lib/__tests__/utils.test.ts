import { describe, it, expect } from "vitest"
import { cn, getMetricColor, formatDateFr, mediaTypeLabels } from "../utils"

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1")
  })

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "extra")).toBe("base extra")
  })

  it("resolves Tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })
})

describe("getMetricColor", () => {
  it("returns green for safe values", () => {
    expect(getMetricColor(0)).toBe("bg-emerald-500")
    expect(getMetricColor(1)).toBe("bg-emerald-500")
  })

  it("returns amber for caution values", () => {
    expect(getMetricColor(2)).toBe("bg-amber-500")
    expect(getMetricColor(3)).toBe("bg-amber-500")
  })

  it("returns red for high values", () => {
    expect(getMetricColor(4)).toBe("bg-red-500")
    expect(getMetricColor(5)).toBe("bg-red-500")
  })
})

describe("formatDateFr", () => {
  it("formats a date in French", () => {
    const result = formatDateFr("2024-03-15")
    expect(result).toContain("2024")
    expect(result).toContain("mars")
  })
})

describe("mediaTypeLabels", () => {
  it("has French labels for all media types", () => {
    expect(mediaTypeLabels.MOVIE).toBe("Film")
    expect(mediaTypeLabels.TV).toBe("Série TV")
    expect(mediaTypeLabels.GAME).toBe("Jeu Vidéo")
    expect(mediaTypeLabels.BOOK).toBe("Livre")
    expect(mediaTypeLabels.APP).toBe("Application")
  })
})
