import { beforeEach, describe, expect, it, vi } from "vitest"
import { getApprovedDiscoveryV4Image, prepareDiscoveryV4Image } from "@/lib/news-image-assets"
import { prisma } from "@/lib/prisma"
import { resolveNewsVisualIntent } from "@/lib/news-visual-intent"
import { findContextualStockPhoto } from "@/lib/stock-photo"
import { uploadNewsImageWithDiagnostics } from "@/lib/supabase-storage"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsImageAsset: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

vi.mock("@/lib/news-visual-intent", () => ({
  resolveNewsVisualIntent: vi.fn(),
}))

vi.mock("@/lib/stock-photo", () => ({
  findContextualStockPhoto: vi.fn(),
}))

vi.mock("@/lib/supabase-storage", () => ({
  uploadNewsImageWithDiagnostics: vi.fn(),
}))

const story = {
  id: "story-1",
  title: "Des enfants courent moins vite au college",
  summary: "Un sujet de sante publique pour les familles.",
  body: "Les medecins recommandent davantage d'activite physique.",
  category: "PARENTHOOD",
}

describe("news image assets", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns only approved prepared V4 assets", async () => {
    vi.mocked(prisma.newsImageAsset.findUnique).mockResolvedValueOnce({
      approved: true,
      storageUrl: "https://cdn.example/news.jpg",
      credit: "Jane Doe / Pexels",
      licenseUrl: "https://pexels.com/photo/1",
    } as never)

    await expect(getApprovedDiscoveryV4Image("story-1")).resolves.toEqual({
      url: "https://cdn.example/news.jpg",
      credit: "Jane Doe / Pexels",
      licenseUrl: "https://pexels.com/photo/1",
    })
  })

  it("does not reprocess an existing asset unless forced", async () => {
    vi.mocked(prisma.newsImageAsset.findUnique).mockResolvedValueOnce({
      id: "asset-1",
      approved: true,
      rejectedReason: null,
    } as never)

    const result = await prepareDiscoveryV4Image(story)

    expect(result).toEqual({ status: "skipped", reason: "already_prepared", assetId: "asset-1" })
    expect(resolveNewsVisualIntent).not.toHaveBeenCalled()
    expect(findContextualStockPhoto).not.toHaveBeenCalled()
  })

  it("retries assets previously rejected because storage failed", async () => {
    vi.mocked(prisma.newsImageAsset.findUnique).mockResolvedValueOnce({
      id: "asset-storage-failed",
      approved: false,
      rejectedReason: "storage_failed",
    } as never)
    vi.mocked(resolveNewsVisualIntent).mockResolvedValueOnce({
      query: "children running track",
      negativeTerms: [],
      confidence: 0.9,
      label: "enfants qui courent",
      source: "llm",
    })
    vi.mocked(findContextualStockPhoto).mockResolvedValueOnce({
      url: "https://images.pexels.com/photos/123/pexels-photo.jpg",
      credit: "Jane Doe / Pexels",
      licenseUrl: "https://www.pexels.com/photo/123/",
      provider: "pexels",
      query: "children running track",
      conceptLabel: "enfants qui courent",
      concept: {
        query: "children running track",
        label: "enfants qui courent",
        matchedTerms: ["llm"],
      },
    })
    vi.mocked(uploadNewsImageWithDiagnostics).mockResolvedValueOnce({
      url: "https://supabase.example/storage/news/123.jpg",
    })
    vi.mocked(prisma.newsImageAsset.upsert).mockResolvedValueOnce({ id: "asset-storage-retried" } as never)

    const result = await prepareDiscoveryV4Image(story)

    expect(result).toEqual({ status: "updated", assetId: "asset-storage-retried" })
    expect(resolveNewsVisualIntent).toHaveBeenCalled()
    expect(uploadNewsImageWithDiagnostics).toHaveBeenCalledWith("https://images.pexels.com/photos/123/pexels-photo.jpg")
  })

  it("records a rejected asset when visual confidence is too low", async () => {
    vi.mocked(prisma.newsImageAsset.findUnique).mockResolvedValueOnce(null)
    vi.mocked(resolveNewsVisualIntent).mockResolvedValueOnce({
      query: "unclear family scene",
      negativeTerms: ["logo"],
      confidence: 0.4,
      label: "scene floue",
      source: "llm",
    })
    vi.mocked(prisma.newsImageAsset.upsert).mockResolvedValueOnce({ id: "asset-low" } as never)

    const result = await prepareDiscoveryV4Image(story)

    expect(result).toEqual({ status: "rejected", reason: "low_confidence", assetId: "asset-low" })
    expect(findContextualStockPhoto).not.toHaveBeenCalled()
    expect(uploadNewsImageWithDiagnostics).not.toHaveBeenCalled()
  })

  it("stores credit, license and mirrored URL for approved Pexels assets", async () => {
    vi.mocked(prisma.newsImageAsset.findUnique).mockResolvedValueOnce(null)
    vi.mocked(resolveNewsVisualIntent).mockResolvedValueOnce({
      query: "children running track",
      negativeTerms: ["logo"],
      confidence: 0.89,
      label: "enfants qui courent",
      reason: "La scene represente directement l'activite physique.",
      source: "llm",
    })
    vi.mocked(findContextualStockPhoto).mockResolvedValueOnce({
      url: "https://images.pexels.com/photos/123/pexels-photo.jpg",
      credit: "Jane Doe / Pexels",
      licenseUrl: "https://www.pexels.com/photo/123/",
      provider: "pexels",
      query: "children running track",
      conceptLabel: "enfants qui courent",
      concept: {
        query: "children running track",
        label: "enfants qui courent",
        matchedTerms: ["llm"],
      },
      intent: {
        query: "children running track",
        negativeTerms: ["logo"],
        confidence: 0.89,
        label: "enfants qui courent",
        source: "llm",
      },
    })
    vi.mocked(uploadNewsImageWithDiagnostics).mockResolvedValueOnce({
      url: "https://supabase.example/storage/news/123.jpg",
    })
    vi.mocked(prisma.newsImageAsset.upsert).mockResolvedValueOnce({ id: "asset-ok" } as never)

    const result = await prepareDiscoveryV4Image(story)

    expect(result).toEqual({ status: "updated", assetId: "asset-ok" })
    expect(prisma.newsImageAsset.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          approved: true,
          sourceUrl: "https://images.pexels.com/photos/123/pexels-photo.jpg",
          storageUrl: "https://supabase.example/storage/news/123.jpg",
          credit: "Jane Doe / Pexels",
          licenseUrl: "https://www.pexels.com/photo/123/",
        }),
      }),
    )
  })
})
