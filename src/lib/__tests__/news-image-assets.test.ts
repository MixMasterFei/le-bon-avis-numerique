import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  batchResolveCatalogPostersByTitle,
  getApprovedDiscoveryV4Image,
  prepareDiscoveryV4Image,
  primaryRelatedMediaId,
} from "@/lib/news-image-assets"
import { prisma } from "@/lib/prisma"
import { resolveNewsVisualIntent } from "@/lib/news-visual-intent"
import { findContextualStockPhoto } from "@/lib/stock-photo"
import { ensureOfficialPressAssetForStory } from "@/lib/official-press-assets"
import { uploadNewsImageWithDiagnostics } from "@/lib/supabase-storage"
import { extractCatalogMatchesFromStory, loadCatalogIndex } from "@/lib/news-linkify"

vi.mock("@/lib/news-linkify", () => ({
  loadCatalogIndex: vi.fn(),
  extractCatalogMatchesFromStory: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsImageAsset: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    mediaItem: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/news-visual-intent", () => ({
  resolveNewsVisualIntent: vi.fn(),
}))

vi.mock("@/lib/stock-photo", () => ({
  findContextualStockPhoto: vi.fn(),
}))

vi.mock("@/lib/official-press-assets", () => ({
  ensureOfficialPressAssetForStory: vi.fn(),
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
    vi.mocked(ensureOfficialPressAssetForStory).mockResolvedValue(null)
    vi.mocked(loadCatalogIndex).mockResolvedValue([])
    vi.mocked(extractCatalogMatchesFromStory).mockReturnValue([])
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

  it("returns totem_editorial prepared assets instead of rejecting them", async () => {
    vi.mocked(prisma.newsImageAsset.findUnique).mockResolvedValueOnce({
      approved: true,
      storageUrl: "https://cdn.example/netflix-card.png",
      credit: "Totem Avisé",
      licenseUrl: null,
    } as never)

    await expect(getApprovedDiscoveryV4Image("story-netflix")).resolves.toEqual({
      url: "https://cdn.example/netflix-card.png",
      credit: "Totem Avisé",
      licenseUrl: null,
    })
  })

  it("prefers catalog poster before official press or stock", async () => {
    const catalogStory = {
      ...story,
      relatedMediaId: "media-tsubasa",
      relatedMediaIds: ["media-tsubasa"],
    }

    vi.mocked(prisma.newsImageAsset.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.mediaItem.findUnique).mockResolvedValueOnce({
      id: "media-tsubasa",
      title: "Captain Tsubasa",
      posterUrl: "https://image.tmdb.org/poster/tsubasa.jpg",
    } as never)
    vi.mocked(uploadNewsImageWithDiagnostics).mockResolvedValueOnce({
      url: "https://supabase.example/catalog/tsubasa.jpg",
    })
    vi.mocked(prisma.newsImageAsset.upsert).mockResolvedValueOnce({ id: "asset-catalog" } as never)

    const result = await prepareDiscoveryV4Image(catalogStory)

    expect(result).toEqual({ status: "updated", reason: "catalog_poster", assetId: "asset-catalog" })
    expect(ensureOfficialPressAssetForStory).not.toHaveBeenCalled()
    expect(resolveNewsVisualIntent).not.toHaveBeenCalled()
    expect(findContextualStockPhoto).not.toHaveBeenCalled()
    expect(prisma.newsImageAsset.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          provider: "catalog_poster",
          credit: "Totem Avisé / Catalogue",
          approved: true,
        }),
      }),
    )
  })

  it("resolves primary related media id from relatedMediaIds first", () => {
    expect(primaryRelatedMediaId({ relatedMediaIds: ["a", "b"], relatedMediaId: "c" })).toBe("a")
    expect(primaryRelatedMediaId({ relatedMediaId: "c" })).toBe("c")
    expect(primaryRelatedMediaId({})).toBeNull()
  })

  it("batch-resolves catalog posters from story titles when relatedMediaId is missing", async () => {
    vi.mocked(loadCatalogIndex).mockResolvedValueOnce([
      {
        id: "media-tsubasa",
        title: "Captain Tsubasa",
        originalTitle: null,
        type: "TV",
        releaseYear: 2018,
        expertAgeRec: 7,
      },
    ])
    vi.mocked(extractCatalogMatchesFromStory).mockReturnValueOnce(["media-tsubasa"])
    vi.mocked(prisma.mediaItem.findMany).mockResolvedValueOnce([
      {
        id: "media-tsubasa",
        posterUrl: "https://image.tmdb.org/poster/tsubasa.jpg",
        title: "Captain Tsubasa",
      },
    ] as never)

    const map = await batchResolveCatalogPostersByTitle([
      {
        id: "story-tsubasa",
        title: "Captain Tsubasa revient sur Netflix",
        summary: "La saga anime revient en streaming.",
        category: "FILM_TV",
      },
    ])

    expect(map.get("story-tsubasa")).toEqual({
      url: "https://image.tmdb.org/poster/tsubasa.jpg",
      credit: "Totem Avisé / Catalogue",
      licenseUrl: null,
    })
  })

  it("prefers catalog poster from title when relatedMediaId is absent during prewarm", async () => {
    const titleStory = {
      ...story,
      id: "story-title-tsubasa",
      title: "Captain Tsubasa : la saison revient sur Netflix",
      category: "FILM_TV",
    }

    vi.mocked(prisma.newsImageAsset.findUnique).mockResolvedValueOnce(null)
    vi.mocked(loadCatalogIndex).mockResolvedValueOnce([
      {
        id: "media-tsubasa",
        title: "Captain Tsubasa",
        originalTitle: null,
        type: "TV",
        releaseYear: 2018,
        expertAgeRec: 7,
      },
    ])
    vi.mocked(extractCatalogMatchesFromStory).mockReturnValueOnce(["media-tsubasa"])
    vi.mocked(prisma.mediaItem.findUnique).mockResolvedValueOnce({
      id: "media-tsubasa",
      title: "Captain Tsubasa",
      posterUrl: "https://image.tmdb.org/poster/tsubasa.jpg",
    } as never)
    vi.mocked(uploadNewsImageWithDiagnostics).mockResolvedValueOnce({
      url: "https://supabase.example/catalog/tsubasa.jpg",
    })
    vi.mocked(prisma.newsImageAsset.upsert).mockResolvedValueOnce({ id: "asset-title-catalog" } as never)

    const result = await prepareDiscoveryV4Image(titleStory)

    expect(result).toEqual({ status: "updated", reason: "catalog_poster", assetId: "asset-title-catalog" })
    expect(ensureOfficialPressAssetForStory).not.toHaveBeenCalled()
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
