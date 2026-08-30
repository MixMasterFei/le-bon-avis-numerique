"use client"

import Link from "next/link"
import { SafeImage } from "@/components/ui/SafeImage"
import { UpcomingCard, type UpcomingItem } from "@/components/home-redesign/UpcomingCard"
import type { BlockMeta, BlogCard, NewsCard } from "@/lib/nl-search/resolve-blocks"
import { BoardHeading } from "./HeroMatch"

function SectionHead({ meta, fallback }: { meta: BlockMeta; fallback: string }) {
  return (
    <div className="mb-5">
      {meta.eyebrow && (
        <p className="text-[12.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--terra)" }}>
          {meta.eyebrow}
        </p>
      )}
      <div className="mt-1.5">
        <BoardHeading title={meta.title ?? fallback} em={meta.em} as="h3" />
      </div>
      {meta.lead && (
        <p className="mt-2 max-w-[56ch] text-[15px]" style={{ color: "var(--ink-2)" }}>
          {meta.lead}
        </p>
      )}
    </div>
  )
}

/** Titles that are not out yet. Age-capped upstream — see @/lib/upcoming. */
export function UpcomingBlock({ meta, items }: { meta: BlockMeta; items: UpcomingItem[] }) {
  return (
    <section className="mt-14 border-t pt-10" style={{ borderColor: "var(--line)" }}>
      <SectionHead meta={meta} fallback="À surveiller prochainement" />
      <div className="v2-row-up">
        {items.map((item) => (
          <UpcomingCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}

export function NewsBlock({ meta, items }: { meta: BlockMeta; items: NewsCard[] }) {
  return (
    <section className="mt-14 border-t pt-10" style={{ borderColor: "var(--line)" }}>
      <SectionHead meta={meta} fallback="À lire autour du sujet" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((story) => (
          <Link
            key={story.slug}
            href={`/apercudecouverte/${story.slug}`}
            className="group overflow-hidden rounded-[14px] transition-transform duration-200 hover:-translate-y-1"
            style={{ background: "var(--card)", border: "1px solid var(--line)" }}
          >
            {story.imageUrl && (
              <div className="relative aspect-[16/9] overflow-hidden" style={{ background: "var(--placeholder, #E6DFCE)" }}>
                <SafeImage
                  src={story.imageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, 360px"
                  className="object-cover"
                  fallbackClassName="h-full w-full"
                />
              </div>
            )}
            <div className="p-4">
              <p
                className="text-[14.5px] font-bold leading-snug"
                style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.01em", color: "var(--ink)" }}
              >
                {story.title}
              </p>
              <p className="mt-1.5 line-clamp-3 text-[13.5px]" style={{ color: "var(--ink-2)" }}>
                {story.summary}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function BlogBlock({ meta, items }: { meta: BlockMeta; items: BlogCard[] }) {
  return (
    <section className="mt-14 border-t pt-10" style={{ borderColor: "var(--line)" }}>
      <SectionHead meta={meta} fallback="Pour aller plus loin" />
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
    </section>
  )
}
