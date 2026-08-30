import { resolveDeferredBlock, type BlockMeta } from "@/lib/nl-search/resolve-blocks"
import type { NlBlockKey } from "@/lib/nl-search/blocks"
import type { NlIntent } from "@/lib/nl-search/types"
import { RailBlock, toRedesignCard } from "./BoardSections"
import { BlogBlock, NewsBlock, UpcomingBlock } from "./EditorialSources"

/**
 * One section that reaches a third party (TMDB, Sanity), rendered inside its
 * own Suspense boundary so the board paints without waiting for it. Resolving
 * to nothing renders nothing — an empty section is dropped rather than shown
 * as a heading over a blank row.
 */
export async function DeferredBlock({
  blockKey,
  meta,
  intent,
  query,
  seenIds,
  alt,
}: {
  blockKey: NlBlockKey
  meta: BlockMeta
  intent: NlIntent
  query: string
  seenIds: string[]
  alt: boolean
}) {
  const resolved = await resolveDeferredBlock({ key: blockKey, meta, intent, query, seenIds })
  if (!resolved) return null

  if (resolved.kind === "upcoming") return <UpcomingBlock meta={resolved.meta} items={resolved.items} alt={alt} />
  if (resolved.kind === "news") return <NewsBlock meta={resolved.meta} items={resolved.items} alt={alt} />
  if (resolved.kind === "blog") return <BlogBlock meta={resolved.meta} items={resolved.items} alt={alt} />
  if (resolved.kind === "rail") {
    return (
      <RailBlock
        blockKey={resolved.key}
        meta={resolved.meta}
        items={resolved.items.map(toRedesignCard)}
        alt={alt}
        sectionImage={resolved.sectionImage}
      />
    )
  }
  return null
}

/** Shape-matching placeholder: a heading bar over one row of posters. */
export function DeferredBlockSkeleton() {
  return (
    <section className="py-[52px] md:py-[62px]" style={{ background: "var(--paper)" }} aria-hidden>
      <div className="mx-auto max-w-[1240px] px-5 sm:px-7">
      <div className="h-4 w-28 animate-pulse rounded" style={{ background: "var(--placeholder, #E6DFCE)" }} />
      <div className="mt-3 h-7 w-64 animate-pulse rounded" style={{ background: "var(--placeholder, #E6DFCE)" }} />
      <div className="v2-row mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[2/3] animate-pulse rounded-[14px]"
            style={{ background: "var(--placeholder, #E6DFCE)" }}
          />
        ))}
      </div>
      </div>
    </section>
  )
}
