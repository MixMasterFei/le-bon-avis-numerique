"use client"

import Link from "next/link"
import { SafeImage } from "@/components/ui/SafeImage"
import { UpcomingCard, type UpcomingItem } from "@/components/home-redesign/UpcomingCard"
import type { BlockMeta, BlogCard } from "@/lib/nl-search/resolve-blocks"
import { accentFor, BoardBand } from "./BoardSections"

/** Titles that are not out yet. Age-capped upstream — see @/lib/upcoming. */
export function UpcomingBlock({ meta, items, alt }: { meta: BlockMeta; items: UpcomingItem[]; alt: boolean }) {
  return (
    <BoardBand meta={meta} accent={accentFor("upcoming")} alt={alt} fallbackTitle="À surveiller prochainement">
      <div className="v2-row-up">
        {items.map((item) => (
          <UpcomingCard key={item.id} item={item} />
        ))}
      </div>
    </BoardBand>
  )
}

export function BlogBlock({ meta, items, alt }: { meta: BlockMeta; items: BlogCard[]; alt: boolean }) {
  return (
    <BoardBand meta={meta} accent={accentFor("blogPicks")} alt={alt} fallbackTitle="Pour aller plus loin">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="rounded-[14px] p-5 transition-transform duration-200 hover:-translate-y-1"
            style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}
          >
            {post.category && (
              <p className="text-[11.5px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--pine-2)" }}>
                {post.category.replace(/-/g, " ")}
              </p>
            )}
            <p
              className="mt-1.5 text-[15px] font-bold leading-snug"
              style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.01em", color: "var(--ink)" }}
            >
              {post.title}
            </p>
            {post.excerpt && (
              <p className="mt-1.5 line-clamp-3 text-[13.5px]" style={{ color: "var(--ink-2)" }}>
                {post.excerpt}
              </p>
            )}
          </Link>
        ))}
      </div>
    </BoardBand>
  )
}
