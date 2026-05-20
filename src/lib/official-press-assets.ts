import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { findOfficialPressImageCandidate } from "@/lib/official-press-registry"
import { uploadNewsImageWithDiagnostics } from "@/lib/supabase-storage"

export interface OfficialPressAssetMatch {
  id: string
  brand: string
  product: string | null
  title: string
  url: string
  sourceUrl: string
  credit: string
  licenseUrl: string | null
  termsUrl: string | null
  tags: string[]
  score: number
}

interface OfficialPressAssetInput {
  title: string
  summary?: string | null
  body?: string | null
  category?: string | null
}

const OFFICIAL_TOPIC_RULES = [
  { pattern: /\bgoogle\s*i\/?o\b/i, tags: ["google-io", "google", "ai"] },
  { pattern: /\bgoogle\b|\bandroid\b|\byoutube\b|\bgemini\b/i, tags: ["google"] },
  { pattern: /\bmeta\b|\bhorizon worlds?\b|\bfacebook\b|\binstagram\b/i, tags: ["meta"] },
  { pattern: /\bnetflix\b/i, tags: ["netflix", "streaming"] },
  { pattern: /\bdisney\+?\b|\bdisney plus\b/i, tags: ["disney", "streaming"] },
  { pattern: /\bprime video\b|\bamazon prime\b/i, tags: ["prime-video", "amazon", "streaming"] },
  { pattern: /\bminecraft\b/i, tags: ["minecraft", "gaming"] },
  { pattern: /\bfortnite\b|\bepic games\b/i, tags: ["fortnite", "epic-games", "gaming"] },
  { pattern: /\bzelda\b|\bnintendo\b|\bswitch\b/i, tags: ["nintendo", "gaming"] },
  { pattern: /\broblox\b/i, tags: ["roblox", "gaming"] },
  { pattern: /\bpronote\b/i, tags: ["pronote", "school"] },
  { pattern: /\bopenai\b|\bchatgpt\b/i, tags: ["openai", "ai"] },
]

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalize(value).trim()).filter(Boolean)))
}

export function officialPressTagsForStory(input: OfficialPressAssetInput): string[] {
  const haystack = normalize(`${input.title} ${input.summary ?? ""} ${input.body ?? ""}`)
  return unique(OFFICIAL_TOPIC_RULES.flatMap((rule) => (rule.pattern.test(haystack) ? rule.tags : [])))
}

function jsonTags(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return []
  return unique(value.flatMap((entry) => (typeof entry === "string" ? [entry] : [])))
}

function scoreAsset(asset: {
  brand: string
  product: string | null
  title: string
  tags: Prisma.JsonValue
}, desiredTags: string[]): number {
  const tags = jsonTags(asset.tags)
  const label = normalize(`${asset.brand} ${asset.product ?? ""} ${asset.title}`)
  return desiredTags.reduce((score, tag) => {
    if (tags.includes(tag)) return score + 3
    if (label.includes(tag.replace(/-/g, " "))) return score + 2
    if (label.includes(tag)) return score + 1
    return score
  }, 0)
}

export async function findOfficialPressAssetForStory(
  input: OfficialPressAssetInput,
): Promise<OfficialPressAssetMatch | null> {
  const desiredTags = officialPressTagsForStory(input)
  if (desiredTags.length === 0) return null

  try {
    const assets = await prisma.officialPressAsset.findMany({
      where: { active: true, assetType: "image" },
      orderBy: [{ verifiedAt: "desc" }, { createdAt: "desc" }],
      take: 250,
      select: {
        id: true,
        brand: true,
        product: true,
        title: true,
        sourceUrl: true,
        storageUrl: true,
        credit: true,
        licenseUrl: true,
        termsUrl: true,
        tags: true,
      },
    })

    let best: OfficialPressAssetMatch | null = null
    for (const asset of assets) {
      const score = scoreAsset(asset, desiredTags)
      if (score < 2 || (best && score <= best.score)) continue
      best = {
        id: asset.id,
        brand: asset.brand,
        product: asset.product,
        title: asset.title,
        url: asset.storageUrl ?? asset.sourceUrl,
        sourceUrl: asset.sourceUrl,
        credit: asset.credit,
        licenseUrl: asset.licenseUrl ?? asset.termsUrl,
        termsUrl: asset.termsUrl,
        tags: jsonTags(asset.tags),
        score,
      }
    }
    return best
  } catch (err) {
    console.warn("[official-press-assets] lookup failed:", err)
    return null
  }
}

export async function ensureOfficialPressAssetForStory(
  input: OfficialPressAssetInput,
): Promise<OfficialPressAssetMatch | null> {
  const existing = await findOfficialPressAssetForStory(input)
  if (existing) return existing

  const candidate = await findOfficialPressImageCandidate(input)
  if (!candidate) return null

  try {
    const mirrored = await uploadNewsImageWithDiagnostics(candidate.imageUrl)
    const existingCandidate = await prisma.officialPressAsset.findFirst({
      where: { sourceUrl: candidate.imageUrl, assetType: "image" },
      select: { id: true },
    })
    const row = existingCandidate
      ? await prisma.officialPressAsset.update({
          where: { id: existingCandidate.id },
          data: {
            brand: candidate.brand,
            product: candidate.product,
            title: candidate.title,
            storageUrl: mirrored.url ?? undefined,
            credit: candidate.credit,
            licenseUrl: candidate.pageUrl,
            termsUrl: candidate.termsUrl,
            termsSummary: candidate.termsSummary,
            tags: candidate.tags,
            active: true,
          },
          select: {
            id: true,
            brand: true,
            product: true,
            title: true,
            sourceUrl: true,
            storageUrl: true,
            credit: true,
            licenseUrl: true,
            termsUrl: true,
            tags: true,
          },
        })
      : await prisma.officialPressAsset.create({
          data: {
            brand: candidate.brand,
            product: candidate.product,
            assetType: "image",
            title: candidate.title,
            sourceUrl: candidate.imageUrl,
            storageUrl: mirrored.url,
            credit: candidate.credit,
            licenseUrl: candidate.pageUrl,
            termsUrl: candidate.termsUrl,
            termsSummary: candidate.termsSummary,
            tags: candidate.tags,
            active: true,
          },
          select: {
            id: true,
            brand: true,
            product: true,
            title: true,
            sourceUrl: true,
            storageUrl: true,
            credit: true,
            licenseUrl: true,
            termsUrl: true,
            tags: true,
          },
        })

    return {
      id: row.id,
      brand: row.brand,
      product: row.product,
      title: row.title,
      url: row.storageUrl ?? row.sourceUrl,
      sourceUrl: row.sourceUrl,
      credit: row.credit,
      licenseUrl: row.licenseUrl ?? row.termsUrl,
      termsUrl: row.termsUrl,
      tags: jsonTags(row.tags),
      score: 10,
    }
  } catch (err) {
    console.warn("[official-press-assets] ensure failed:", err)
    return null
  }
}
