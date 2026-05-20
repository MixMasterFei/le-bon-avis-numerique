import { Prisma } from "@prisma/client"

export interface OfficialPressRegistryEntry {
  brand: string
  product?: string
  tags: string[]
  patterns: RegExp[]
  pressKitUrl: string
  newsroomUrl?: string
  termsUrl?: string
  termsSummary: string
}

export interface PressKitStoryInput {
  title: string
  summary?: string | null
  body?: string | null
  sources?: Prisma.JsonValue | null
}

export interface PressKitTarget {
  entry: OfficialPressRegistryEntry
  score: number
  matchedIn: string[]
}

export const OFFICIAL_PRESS_REGISTRY: OfficialPressRegistryEntry[] = [
  {
    brand: "Netflix",
    tags: ["netflix", "streaming", "series", "film-tv"],
    patterns: [/\bnetflix\b/i, /\btudum\b/i],
    pressKitUrl: "https://media.netflix.com/en/",
    newsroomUrl: "https://about.netflix.com/en/newsroom",
    termsUrl: "https://help.netflix.com/legal/termsofuse",
    termsSummary:
      "Official Netflix media center reference. Keep inactive until a specific image and usage terms are reviewed.",
  },
  {
    brand: "Google",
    product: "Google I/O",
    tags: ["google", "google-io", "android", "gemini", "ai"],
    patterns: [/\bgoogle\s*i\/?o\b/i],
    pressKitUrl: "https://io.google/2026/",
    newsroomUrl: "https://blog.google/",
    termsUrl: "https://about.google/brand-resource-center/brand-elements/",
    termsSummary:
      "Official Google I/O/event reference. Google brand elements are restricted; keep inactive until image terms are explicit.",
  },
  {
    brand: "Google",
    tags: ["google", "android", "youtube", "gemini", "ai"],
    patterns: [/\bgoogle\b/i, /\bandroid\b/i, /\byoutube\b/i, /\bgemini\b/i],
    pressKitUrl: "https://about.google/brand-resource-center/brand-elements/",
    newsroomUrl: "https://blog.google/",
    termsUrl: "https://about.google/brand-resource-center/brand-elements/",
    termsSummary:
      "Official Google brand resource reference. Assets require careful review before public editorial use.",
  },
  {
    brand: "Meta",
    tags: ["meta", "facebook", "instagram", "horizon-worlds", "vr", "social"],
    patterns: [/\bmeta\b/i, /\bfacebook\b/i, /\binstagram\b/i, /\bhorizon worlds?\b/i],
    pressKitUrl: "https://about.fb.com/news/",
    newsroomUrl: "https://about.fb.com/news/",
    termsSummary:
      "Official Meta newsroom reference. Individual newsroom posts often expose downloadable image packs; validate per story.",
  },
  {
    brand: "Microsoft",
    tags: ["microsoft", "xbox", "copilot", "windows", "ai"],
    patterns: [/\bmicrosoft\b/i, /\bxbox\b/i, /\bcopilot\b/i, /\bwindows\b/i],
    pressKitUrl: "https://news.microsoft.com/",
    newsroomUrl: "https://news.microsoft.com/",
    termsSummary:
      "Official Microsoft newsroom reference. Keep inactive until a specific asset page is reviewed.",
  },
  {
    brand: "Apple",
    tags: ["apple", "iphone", "ipad", "ios", "app-store"],
    patterns: [/\bapple\b/i, /\biphone\b/i, /\bipad\b/i, /\bios\b/i, /\bapp store\b/i],
    pressKitUrl: "https://www.apple.com/newsroom/",
    newsroomUrl: "https://www.apple.com/newsroom/",
    termsSummary:
      "Official Apple newsroom reference. Use only specific newsroom assets with reviewed terms.",
  },
  {
    brand: "Disney",
    product: "Disney+",
    tags: ["disney", "disney-plus", "streaming", "film-tv"],
    patterns: [/\bdisney\+?\b/i, /\bdisney plus\b/i],
    pressKitUrl: "https://press.disneyplus.com/",
    newsroomUrl: "https://thewaltdisneycompany.com/news/",
    termsSummary:
      "Official Disney+/Disney press reference. Keep inactive until a specific image and usage terms are reviewed.",
  },
  {
    brand: "Amazon",
    product: "Prime Video",
    tags: ["amazon", "prime-video", "streaming", "film-tv"],
    patterns: [/\bprime video\b/i, /\bamazon prime\b/i, /\bamazon\b/i],
    pressKitUrl: "https://press.amazonmgmstudios.com/us/en",
    newsroomUrl: "https://www.aboutamazon.com/news",
    termsSummary:
      "Official Amazon MGM/Prime Video press reference. Keep inactive until a specific asset is reviewed.",
  },
  {
    brand: "Epic Games",
    product: "Fortnite",
    tags: ["epic-games", "fortnite", "gaming"],
    patterns: [/\bfortnite\b/i, /\bepic games\b/i],
    pressKitUrl: "https://www.epicgames.com/site/news?lang=en-US",
    newsroomUrl: "https://www.epicgames.com/site/news?lang=en-US",
    termsSummary:
      "Official Epic Games newsroom reference. Use only story-specific official imagery after review.",
  },
  {
    brand: "Nintendo",
    tags: ["nintendo", "switch", "zelda", "mario", "gaming"],
    patterns: [/\bnintendo\b/i, /\bswitch\b/i, /\bzelda\b/i, /\bmario\b/i],
    pressKitUrl: "https://press.nintendo.com/",
    newsroomUrl: "https://www.nintendo.com/us/whatsnew/",
    termsSummary:
      "Official Nintendo press portal reference. It may require access; keep inactive until rights are confirmed.",
  },
  {
    brand: "Roblox",
    tags: ["roblox", "gaming", "metaverse"],
    patterns: [/\broblox\b/i],
    pressKitUrl: "https://corp.roblox.com/newsroom/",
    newsroomUrl: "https://corp.roblox.com/newsroom/",
    termsSummary:
      "Official Roblox newsroom reference. Keep inactive until a specific asset is reviewed.",
  },
  {
    brand: "OpenAI",
    product: "ChatGPT",
    tags: ["openai", "chatgpt", "ai"],
    patterns: [/\bopenai\b/i, /\bchatgpt\b/i],
    pressKitUrl: "https://openai.com/news/",
    newsroomUrl: "https://openai.com/news/",
    termsSummary:
      "Official OpenAI news reference. Keep inactive until a specific image and usage terms are reviewed.",
  },
  {
    brand: "TikTok",
    tags: ["tiktok", "social", "teen", "smartphone"],
    patterns: [/\btiktok\b/i],
    pressKitUrl: "https://newsroom.tiktok.com/",
    newsroomUrl: "https://newsroom.tiktok.com/",
    termsSummary:
      "Official TikTok newsroom reference. Keep inactive until a specific asset is reviewed.",
  },
  {
    brand: "Snap",
    product: "Snapchat",
    tags: ["snapchat", "snap", "social", "teen", "smartphone"],
    patterns: [/\bsnapchat\b/i, /\bsnap\b/i],
    pressKitUrl: "https://newsroom.snap.com/",
    newsroomUrl: "https://newsroom.snap.com/",
    termsSummary:
      "Official Snap newsroom reference. Keep inactive until a specific asset is reviewed.",
  },
  {
    brand: "Mojang",
    product: "Minecraft",
    tags: ["minecraft", "mojang", "gaming"],
    patterns: [/\bminecraft\b/i, /\bmojang\b/i],
    pressKitUrl: "https://www.minecraft.net/en-us/15th-anniversary",
    newsroomUrl: "https://www.minecraft.net/en-us/articles",
    termsSummary:
      "Official Minecraft reference. Use story-specific official assets only after terms are reviewed.",
  },
]

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function sourcesText(sources: Prisma.JsonValue | null | undefined): string {
  if (!Array.isArray(sources)) return ""
  return sources
    .flatMap((source) => {
      if (!source || typeof source !== "object" || Array.isArray(source)) return []
      const row = source as Record<string, unknown>
      return [row.name, row.headline, row.url].filter((value): value is string => typeof value === "string")
    })
    .join(" ")
}

function matchSection(patterns: RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text))
}

export function findPressKitTargetsForStory(input: PressKitStoryInput): PressKitTarget[] {
  const title = normalize(input.title)
  const summary = normalize(input.summary ?? "")
  const body = normalize(input.body ?? "")
  const sourceText = normalize(sourcesText(input.sources))

  return OFFICIAL_PRESS_REGISTRY.flatMap((entry) => {
    const matchedIn: string[] = []
    let score = 0

    if (matchSection(entry.patterns, title)) {
      matchedIn.push("title")
      score += 5
    }
    if (matchSection(entry.patterns, summary)) {
      matchedIn.push("summary")
      score += 3
    }
    if (matchSection(entry.patterns, body)) {
      matchedIn.push("body")
      score += 1
    }
    if (matchSection(entry.patterns, sourceText)) {
      matchedIn.push("sources")
      score += 1
    }

    if (score < 3) return []
    return [{ entry, score, matchedIn }]
  }).sort((a, b) => b.score - a.score)
}
