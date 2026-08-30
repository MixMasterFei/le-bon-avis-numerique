/**
 * Turns a validated page plan into rendered-ready data.
 *
 * Every block here is an ordinary catalogue query. The plan decided WHICH
 * sections exist and what they are called; this file decides nothing about the
 * content beyond running the deterministic engines and dropping sections that
 * came back too thin. No LLM import belongs in this file.
 *
 * Failure policy: each block resolves independently and catches its own errors,
 * so a TMDB hiccup costs one section rather than the whole board.
 */
import { NewsCategory, NewsStoryStatus, type Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getCinemaMovies } from "@/lib/cinema"
import { buildQuickAnswer, type QuickAnswer } from "@/lib/quick-answer"
import { buildAgeRationale, type AgeRationale } from "@/lib/age-rationale"
import { shouldHideContentAnalysis } from "@/lib/release-status"
import { totemVoiceLine, type FitReason } from "@/lib/totem-voice"
import { matchMediaIdsByTheme, matchMediaIdsByTitle } from "@/lib/search-normalize"
import { getUpcomingItems } from "@/lib/upcoming"
import { searchPublishedBlogPosts } from "@/lib/totem/sanity-search"
import type { UpcomingItem } from "@/components/home-redesign/UpcomingCard"
import {
  fetchByIds,
  runNlQuery,
  type AssembledCard,
} from "./assemble"
import { isEditorialBlock, type NlBlockKey, type NlBlockVariant, type NlEditorialBlock, type NlPlan, type NlPlanBlock } from "./blocks"
import type { NlIntent } from "./types"

const MAIN_LIMIT = 24
const RAIL_LIMIT = 12
/** Below this a rail reads as an accident rather than a selection. */
const MIN_RAIL_ITEMS = 3
const HERO_SCREENSHOTS = 4

/**
 * Sections that reach outside Postgres: TMDB for cinema and upcoming, Sanity
 * for the blog. Resolving these inline would hold the whole board — including
 * the answer to the question — behind the slowest third party. They are handed
 * back as `deferred` placeholders and streamed into their own Suspense
 * boundaries instead, so the results paint first and the rest fills in.
 */
const SLOW_BLOCKS = new Set<NlBlockKey>(["cinemaNow", "upcoming", "newsPicks", "blogPicks"])

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

export interface BlockMeta {
  eyebrow: string | null
  title: string | null
  em: string | null
  lead: string | null
  variant: NlBlockVariant
}

export interface HeroData {
  card: AssembledCard
  /** True when the site's 15+ blur rule fires for this title — the hero then
   *  renders poster-led with the art hidden, exactly like a RedesignCard
   *  blurs, instead of putting a mature backdrop full-bleed on the board. */
  matureArt: boolean
  /** Wide art for the full-bleed treatment. Null for every game. */
  backdropUrl: string | null
  screenshots: string[]
  synopsis: string | null
  /** Only when a family is signed in — traceable to a real fit signal. */
  voiceLine: string | null
  quickAnswer: QuickAnswer | null
  ageRationale: AgeRationale | null
  hideContentAnalysis: boolean
  officialRating: string | null
  director: string | null
  releaseDate: string | null
  platforms: string[]
}

export interface NewsCard {
  slug: string
  title: string
  summary: string
  imageUrl: string | null
  category: string
  publishedAt: string
}

export interface BlogCard {
  slug: string
  title: string
  excerpt: string | null
  category: string | null
}

export type ResolvedBlock =
  | { kind: "hero"; key: "heroMatch"; meta: BlockMeta; hero: HeroData }
  | { kind: "grid"; key: "mediaGrid"; meta: BlockMeta; items: AssembledCard[]; sectionImage?: SectionImage | null }
  | { kind: "rail"; key: NlBlockKey; meta: BlockMeta; items: AssembledCard[]; sectionImage?: SectionImage | null }
  | { kind: "upcoming"; key: "upcoming"; meta: BlockMeta; items: UpcomingItem[] }
  | { kind: "news"; key: "newsPicks"; meta: BlockMeta; items: NewsCard[] }
  | { kind: "blog"; key: "blogPicks"; meta: BlockMeta; items: BlogCard[] }
  | { kind: "editorial"; key: NlEditorialBlock; meta: BlockMeta }
  /** Placeholder for a section that streams in separately — see SLOW_BLOCKS. */
  | { kind: "deferred"; key: NlBlockKey; meta: BlockMeta; index: number; variant: NlBlockVariant }

export interface ResolvedBoard {
  blocks: ResolvedBlock[]
  personalized: boolean
  members: { id: string; name: string }[]
  /** Total main results, before the hero was lifted out of the grid. */
  mainCount: number
}

export interface SectionImage {
  url: string
  /** Backdrops are hero-grade; stills are patchier and slightly lower trust. */
  kind: "backdrop" | "screenshot"
}

/**
 * Wide art for a fullBleed section, taken from the titles the section already
 * contains. Two passes: a backdrop (MOVIE/TV only — the importer stores none
 * for games), then a screenshot, which is the one wide-art seam that also
 * covers games. Returning null tells the renderer to fall back to the plain
 * band rather than stretching a 2:3 poster into mush.
 */
async function sectionImageFor(items: AssembledCard[]): Promise<SectionImage | null> {
  if (items.length === 0) return null
  // Server-side there is no per-user blur setting to consult, so section art
  // is conservative by construction: only titles clearly below the site's
  // blur trigger (15+) may lend their image to a band. A 15+ title can still
  // BE on the board — its card handles its own blur — it just never becomes
  // the section's decor.
  const ids = items
    .filter((i) => i.expertAgeRec !== null && i.expertAgeRec < 15)
    .slice(0, 8)
    .map((i) => i.id)
  if (ids.length === 0) return null
  try {
    const backdrop = await prisma.mediaItem.findFirst({
      where: { id: { in: ids }, backdropUrl: { not: null } },
      select: { backdropUrl: true },
    })
    if (backdrop?.backdropUrl) return { url: backdrop.backdropUrl, kind: "backdrop" }

    const still = await prisma.mediaScreenshot.findFirst({
      where: { mediaId: { in: ids } },
      orderBy: { order: "asc" },
      select: { url: true },
    })
    return still?.url ? { url: still.url, kind: "screenshot" } : null
  } catch {
    return null
  }
}

function metaOf(block: NlPlanBlock): BlockMeta {
  return { eyebrow: block.eyebrow, title: block.title, em: block.em, lead: block.lead, variant: block.variant }
}

/* ------------------------------------------------------------------ *
 * The hero
 * ------------------------------------------------------------------ */

const ZERO_METRICS = {
  violence: 0, sexNudity: 0, language: 0, consumerism: 0,
  substanceUse: 0, positiveMessages: 0, roleModels: 0,
}

/**
 * Which member the hero is "for". Derived from the per-member scores the engine
 * already produced, never guessed — `totemVoiceLine` then renders it through a
 * closed set of openers, so the sentence cannot invent a taste.
 */
function deriveFitReason(card: AssembledCard): FitReason | null {
  const scores = card.memberScores ?? []
  if (scores.length === 0) return null
  if (scores.length === 1) return { kind: "member-strong", name: scores[0].memberName }

  const sorted = [...scores].sort((a, b) => b.score - a.score)
  if (sorted[sorted.length - 1].score >= 70) return { kind: "family-all" }
  if (sorted[0].score - sorted[1].score >= 15) return { kind: "family-one", name: sorted[0].memberName }
  const strong = sorted.filter((s) => s.score >= 65)
  if (strong.length >= 2) return { kind: "family-some", names: strong.map((s) => s.memberName) }
  return { kind: "family-compromise" }
}

async function resolveHero(card: AssembledCard, personalized: boolean): Promise<HeroData | null> {
  const row = await prisma.mediaItem.findUnique({
    where: { id: card.id },
    select: {
      title: true, type: true, synopsisFr: true, backdropUrl: true,
      expertAgeRec: true, officialRating: true, genres: true, topics: true,
      platforms: true, director: true, releaseDate: true, releaseStatus: true,
      isEnriched: true,
      contentMetrics: {
        select: {
          violence: true, sexNudity: true, language: true, consumerism: true,
          substanceUse: true, positiveMessages: true, roleModels: true,
        },
      },
      // Over-fetched because ~a third of the rows are exact URL duplicates.
      screenshots: { select: { url: true }, orderBy: { order: "asc" }, take: 12 },
    },
  })
  if (!row) return null

  const hideContentAnalysis = shouldHideContentAnalysis({
    releaseDate: row.releaseDate,
    releaseStatus: row.releaseStatus,
    isEnriched: row.isEnriched,
    expertAgeRec: row.expertAgeRec,
  })

  const metrics = row.contentMetrics
    ? {
        violence: row.contentMetrics.violence ?? 0,
        sexNudity: row.contentMetrics.sexNudity ?? 0,
        language: row.contentMetrics.language ?? 0,
        consumerism: row.contentMetrics.consumerism ?? 0,
        substanceUse: row.contentMetrics.substanceUse ?? 0,
        positiveMessages: row.contentMetrics.positiveMessages ?? 0,
        roleModels: row.contentMetrics.roleModels ?? 0,
      }
    : ZERO_METRICS

  const quickAnswer = buildQuickAnswer({
    title: row.title,
    type: row.type,
    expertAgeRec: row.expertAgeRec,
    contentMetrics: metrics,
    hideContentAnalysis,
  })

  const ageRationale = buildAgeRationale({
    title: row.title,
    type: row.type,
    expertAgeRec: row.expertAgeRec,
    officialRating: row.officialRating,
    genres: row.genres ?? [],
    topics: row.topics ?? [],
    contentMetrics: metrics,
    hideContentAnalysis,
  })

  const reason = personalized ? deriveFitReason(card) : null

  // Same trigger as shouldBlurMedia (age >= 15 AND one metric >= 3), computed
  // server-side without the user toggle: the toggle loosens CARD blur for the
  // adult who set it, but a full-bleed board hero is a bigger, more public
  // surface, so it stays conservative for everyone.
  const matureArt =
    row.type !== "GAME" &&
    row.expertAgeRec !== null &&
    row.expertAgeRec >= 15 &&
    (metrics.violence >= 3 || metrics.sexNudity >= 3 || metrics.language >= 3 || metrics.substanceUse >= 3)

  const seenUrls = new Set<string>(row.backdropUrl ? [row.backdropUrl] : [])
  const screenshots: string[] = []
  for (const shot of row.screenshots) {
    if (!shot.url || seenUrls.has(shot.url)) continue
    seenUrls.add(shot.url)
    screenshots.push(shot.url)
    if (screenshots.length >= HERO_SCREENSHOTS) break
  }

  return {
    card,
    matureArt,
    backdropUrl: matureArt ? null : row.backdropUrl,
    screenshots: matureArt ? [] : screenshots,
    synopsis: row.synopsisFr,
    voiceLine: reason ? totemVoiceLine(reason, row.synopsisFr) : null,
    quickAnswer,
    ageRationale: ageRationale.show ? ageRationale : null,
    hideContentAnalysis,
    officialRating: row.officialRating,
    director: row.director,
    releaseDate: row.releaseDate ? row.releaseDate.toISOString() : null,
    platforms: row.platforms ?? [],
  }
}

/* ------------------------------------------------------------------ *
 * Rails
 * ------------------------------------------------------------------ */

interface RailContext {
  intent: NlIntent
  userId: string | null
  memberIds: string[]
  /** Ids already on the board, so a rail never repeats what's above it. */
  seen: Set<string>
}

async function resolveCinemaRail(intent: NlIntent): Promise<AssembledCard[]> {
  const movies = await getCinemaMovies({
    ...(intent.maxAge !== null ? { maxAge: intent.maxAge } : {}),
    ...(intent.minAge !== null ? { minAge: intent.minAge } : {}),
  })
  // Off-catalogue entries carry a synthetic "tmdb-<id>" id that no fiche route
  // resolves, so they are dropped rather than rendered as dead cards.
  return movies
    .filter((m) => m.inDatabase && m.posterUrl)
    .slice(0, RAIL_LIMIT)
    .map((m) => ({
      id: m.id,
      type: "MOVIE" as const,
      title: m.title,
      posterUrl: m.posterUrl,
      expertAgeRec: m.expertAgeRec,
      genres: m.genres ?? [],
      contentMetrics: (m.contentMetrics as Record<string, unknown> | null) ?? null,
    }))
}

async function resolveRail(block: NlPlanBlock, ctx: RailContext): Promise<AssembledCard[]> {
  const { intent, userId, memberIds } = ctx

  switch (block.block) {
    case "cinemaNow":
      return resolveCinemaRail(intent)

    case "youngerSiblings": {
      if (intent.maxAge === null) return []
      const younger = Math.max(3, intent.maxAge - 3)
      const res = await runNlQuery({ intent, userId, memberIds, limit: RAIL_LIMIT, maxAgeOverride: younger })
      return res.items
    }

    case "crossType": {
      const target = block.mediaType && block.mediaType !== intent.mediaType ? block.mediaType : null
      if (!target) return []
      // Themes are type-scoped, so they are dropped when pivoting medium rather
      // than carried across into a vocabulary that doesn't contain them.
      const pivoted: NlIntent = { ...intent, mediaType: target, themes: [], platforms: [] }
      const res = await runNlQuery({ intent: pivoted, userId, memberIds, limit: RAIL_LIMIT })
      return res.items
    }

    case "mediaRail": {
      const narrowed: NlIntent = {
        ...intent,
        ...(block.mediaType ? { mediaType: block.mediaType, platforms: [] } : {}),
        ...(block.themes.length > 0 ? { themes: block.themes } : {}),
      }
      const res = await runNlQuery({ intent: narrowed, userId, memberIds, limit: RAIL_LIMIT })
      return res.items
    }

    default:
      return []
  }
}

/* ------------------------------------------------------------------ *
 * Editorial sources: news and blog
 * ------------------------------------------------------------------ */

const MAX_NEWS = 3
const MAX_BLOG = 3
/** related_media_ids carries no index, so the probe set stays deliberately small. */
const NEWS_RELATED_PROBE = 12

const NEWS_CATEGORY_FOR: Record<string, NewsCategory> = {
  MOVIE: NewsCategory.FILM_TV,
  TV: NewsCategory.FILM_TV,
  GAME: NewsCategory.GAMES,
}

/**
 * News worth putting on this board. Two passes: stories explicitly about a
 * title already selected above, then a keyword top-up in the matching section.
 *
 * `editorialTone: "grave"` is excluded throughout — the same rule the family
 * feed applies. A board someone assembled for a Saturday night is not where a
 * grave story belongs.
 */
async function resolveNewsPicks(intent: NlIntent, query: string, mediaIds: string[]): Promise<NewsCard[]> {
  const select = {
    slug: true, title: true, summary: true, imageUrl: true,
    category: true, publishedAt: true,
  } as const
  const base: Prisma.NewsStoryWhereInput = {
    status: NewsStoryStatus.PUBLISHED,
    storyType: "BRIEF",
    NOT: { editorialTone: "grave" },
  }

  const picked = new Map<string, NewsCard>()
  const push = (rows: { slug: string; title: string; summary: string; imageUrl: string; category: string; publishedAt: Date }[]) => {
    for (const row of rows) {
      if (picked.size >= MAX_NEWS || picked.has(row.slug)) continue
      picked.set(row.slug, {
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        imageUrl: row.imageUrl,
        category: row.category,
        publishedAt: row.publishedAt.toISOString(),
      })
    }
  }

  if (mediaIds.length > 0) {
    push(await prisma.newsStory.findMany({
      where: { ...base, relatedMediaIds: { hasSome: mediaIds.slice(0, NEWS_RELATED_PROBE) } },
      select,
      orderBy: { publishedAt: "desc" },
      take: MAX_NEWS,
    }))
  }

  if (picked.size < MAX_NEWS) {
    const terms = [...intent.themes, query].map((t) => t.trim()).filter((t) => t.length >= 4)
    const category = NEWS_CATEGORY_FOR[intent.mediaType]
    push(await prisma.newsStory.findMany({
      where: {
        ...base,
        ...(category ? { category } : {}),
        ...(terms.length > 0
          ? { OR: terms.flatMap((term) => [
              { title: { contains: term, mode: "insensitive" as const } },
              { summary: { contains: term, mode: "insensitive" as const } },
            ]) }
          : {}),
      },
      select,
      orderBy: { publishedAt: "desc" },
      take: MAX_NEWS,
    }))
  }

  return Array.from(picked.values())
}

async function resolveBlogPicks(intent: NlIntent, query: string): Promise<BlogCard[]> {
  const term = intent.themes[0] ?? query
  const posts = await searchPublishedBlogPosts(term, MAX_BLOG)
  return posts.map((post) => ({
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt ?? null,
    category: post.category ?? null,
  }))
}

/* ------------------------------------------------------------------ *
 * The board
 * ------------------------------------------------------------------ */

/** The main result set, by interpretation mode. */
async function resolveMainItems(
  intent: NlIntent,
  query: string,
  userId: string | null,
  memberIds: string[],
): Promise<{ items: AssembledCard[]; members: { id: string; name: string }[]; personalized: boolean }> {
  if (intent.mode === "hors_sujet") return { items: [], members: [], personalized: false }

  if (intent.mode === "titre" && intent.titre) {
    const ids = await matchMediaIdsByTitle(intent.titre, { limit: MAIN_LIMIT })
    return { items: await fetchByIds(ids, MAIN_LIMIT), members: [], personalized: false }
  }

  if (intent.mode === "texte") {
    const [themeIds, titleIds] = await Promise.all([
      matchMediaIdsByTheme(query, { limit: 40 }),
      matchMediaIdsByTitle(query, { limit: 12 }),
    ])
    const merged = Array.from(new Set([...titleIds, ...themeIds]))
    return { items: await fetchByIds(merged, MAIN_LIMIT), members: [], personalized: false }
  }

  return runNlQuery({ intent, userId, memberIds, limit: MAIN_LIMIT })
}

/**
 * Resolves one deferred section. Called from its own Suspense boundary, after
 * the board has already painted. Returns null when the section came back too
 * thin to be worth a heading.
 */
export async function resolveDeferredBlock(opts: {
  key: NlBlockKey
  meta: BlockMeta
  intent: NlIntent
  query: string
  seenIds: string[]
}): Promise<ResolvedBlock | null> {
  const { key, meta, intent, query, seenIds } = opts
  const variant = meta.variant
  try {
    if (key === "upcoming") {
      const items = await getUpcomingItems(intent.maxAge)
      return items.length >= MIN_RAIL_ITEMS ? { kind: "upcoming", key: "upcoming", meta, items } : null
    }
    if (key === "newsPicks") {
      const items = await resolveNewsPicks(intent, query, seenIds)
      return items.length > 0 ? { kind: "news", key: "newsPicks", meta, items } : null
    }
    if (key === "blogPicks") {
      const items = await resolveBlogPicks(intent, query)
      return items.length > 0 ? { kind: "blog", key: "blogPicks", meta, items } : null
    }
    if (key === "cinemaNow") {
      const seen = new Set(seenIds)
      const items = (await resolveCinemaRail(intent)).filter((i) => !seen.has(i.id))
      if (items.length < MIN_RAIL_ITEMS) return null
      const sectionImage = variant === "fullBleed" ? await sectionImageFor(items) : null
      return { kind: "rail", key: "cinemaNow", meta, items, sectionImage }
    }
    return null
  } catch (error) {
    console.error(`[nl-search] deferred block "${key}" failed:`, error)
    return null
  }
}

/**
 * Which sections take the alternate background, aligned to `blocks`.
 *
 * Counted over CONTENT sections only: an editorial block sitting between two
 * bands must not break the alternation, or the stripe reads as a mistake.
 */
export function computeStripes(blocks: ResolvedBlock[]): boolean[] {
  let n = 0
  return blocks.map((block) => {
    if (block.kind === "editorial") return false
    const alt = n % 2 === 1
    n += 1
    return alt
  })
}

export interface ResolveBoardOptions {
  intent: NlIntent
  plan: NlPlan
  query: string
  userId: string | null
}

export async function resolveBoard(opts: ResolveBoardOptions): Promise<ResolvedBoard> {
  const { intent, plan, query, userId } = opts

  const members = userId
    ? await prisma.familyMember.findMany({ where: { userId }, select: { id: true, name: true } })
    : []
  const memberIds = members.map((m) => m.id)

  const main = await resolveMainItems(intent, query, userId, memberIds)

  const wantsHero = plan.some((b) => b.block === "heroMatch") && main.items.length > 0
  const heroCard = wantsHero ? main.items[0] : null
  // The hero is lifted OUT of the grid: showing the same title twice, once huge
  // and once small, reads as a bug rather than emphasis.
  const gridItems = heroCard ? main.items.slice(1) : main.items

  const seen = new Set(main.items.map((i) => i.id))
  const ctx: RailContext = { intent, userId, memberIds, seen }

  // Every block resolves concurrently; a thrown resolver costs its own section.
  const resolved = await Promise.all(
    plan.map(async (block, index): Promise<ResolvedBlock | null> => {
      const meta = metaOf(block)
      try {
        if (isEditorialBlock(block.block)) {
          return { kind: "editorial", key: block.block, meta }
        }

        if (block.block === "heroMatch") {
          if (!heroCard) return null
          const hero = await resolveHero(heroCard, main.personalized)
          return hero ? { kind: "hero", key: "heroMatch", meta, hero } : null
        }

        if (block.block === "mediaGrid") {
          if (gridItems.length === 0) return null
          const sectionImage = block.variant === "fullBleed" ? await sectionImageFor(gridItems) : null
          return { kind: "grid", key: "mediaGrid", meta, items: gridItems, sectionImage }
        }

        if (SLOW_BLOCKS.has(block.block)) {
          return { kind: "deferred", key: block.block, meta, index, variant: block.variant }
        }

        if (block.block === "upcoming") {
          const items = await getUpcomingItems(intent.maxAge)
          return items.length >= MIN_RAIL_ITEMS ? { kind: "upcoming", key: "upcoming", meta, items } : null
        }

        if (block.block === "newsPicks") {
          const items = await resolveNewsPicks(intent, query, Array.from(seen))
          return items.length > 0 ? { kind: "news", key: "newsPicks", meta, items } : null
        }

        if (block.block === "blogPicks") {
          const items = await resolveBlogPicks(intent, query)
          return items.length > 0 ? { kind: "blog", key: "blogPicks", meta, items } : null
        }

        const items = (await resolveRail(block, ctx)).filter((i) => !seen.has(i.id))
        if (items.length < MIN_RAIL_ITEMS) return null
        for (const item of items) seen.add(item.id)
        const sectionImage = block.variant === "fullBleed" ? await sectionImageFor(items) : null
        return { kind: "rail", key: block.block, meta, items, sectionImage }
      } catch (error) {
        console.error(`[nl-search] block "${block.block}" failed:`, error)
        return null
      }
    }),
  )

  const blocks = resolved.filter((b): b is ResolvedBlock => b !== null)

  // A dangling editorial block at the end has nothing left to introduce once
  // the section it announced dropped out for being empty. A deferred block
  // still counts as content here — it has not resolved yet.
  while (
    blocks.length > 0 &&
    blocks[blocks.length - 1].kind === "editorial" &&
    blocks[blocks.length - 1].key !== "closingCta"
  ) {
    blocks.pop()
  }

  return { blocks, personalized: main.personalized, members: main.members, mainCount: main.items.length }
}
