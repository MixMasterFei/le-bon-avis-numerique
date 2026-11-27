import Link from "next/link"
import { ArrowRight, BookOpen } from "lucide-react"
import { getLiveBlogSlugs } from "@/lib/published-blog"
import { blogArticleHref, blogLinkForFiche, blogSlugFromHref, type FicheBlogCandidate } from "@/lib/blog-links"
import { isChristmasSeason } from "@/lib/seasonal"
import { isNoelGiftGame } from "@/lib/noel/gift-membership"

// « À lire aussi » on a fiche: ONE blog article picked by blogLinkForFiche
// (rules and tests in @/lib/blog-links). Server component, so the link is in
// the crawled HTML. Placed under the age / content-analysis block, never in
// the hero: the callers wrap it in <Suspense fallback={null}> so the cached
// live-slug read (5 min, 2.5 s timeout, never throws) cannot hold back LCP.

const PALETTES = {
  classic: {
    card: "var(--color-warm-card)",
    line: "var(--color-warm-line)",
    ink: "var(--color-warm-ink)",
    ink2: "var(--color-warm-ink2)",
    accent: "var(--color-warm-accent)",
  },
  v3: {
    card: "var(--f-card)",
    line: "var(--f-border)",
    ink: "var(--f-ink)",
    ink2: "var(--f-muted)",
    accent: "var(--f-accent)",
  },
} as const

export async function FicheBlogLink({
  mediaId,
  media,
  ageGuideHref,
  variant = "classic",
  className,
}: {
  mediaId: string
  media: FicheBlogCandidate
  /** The « Comment lire cet âge ? » href already on the page — never linked twice. */
  ageGuideHref?: string | null
  variant?: keyof typeof PALETTES
  className?: string
}) {
  const month0 = new Date().getMonth()
  // The gift-list lookup only matters for a game fiche in season.
  const [liveSlugs, isGiftGame] = await Promise.all([
    getLiveBlogSlugs(),
    media.type === "GAME" && isChristmasSeason(month0) ? isNoelGiftGame(mediaId) : Promise.resolve(false),
  ])
  const article = blogLinkForFiche(media, {
    liveSlugs,
    month0,
    isGiftGame,
    alreadyLinkedSlugs: [blogSlugFromHref(ageGuideHref)],
  })
  if (!article) return null

  const c = PALETTES[variant]
  return (
    <aside aria-label="À lire aussi" className={className}>
      <Link
        href={blogArticleHref(article.slug)}
        data-testid="fiche-blog-link"
        className="group flex items-start gap-3 rounded-2xl p-4 sm:p-5 transition-transform duration-200 hover:-translate-y-0.5"
        style={{ background: c.card, border: `1px solid ${c.line}` }}
      >
        <BookOpen className="mt-0.5 h-5 w-5 flex-none" style={{ color: c.accent }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span
            className="block text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: c.accent }}
          >
            À lire aussi
          </span>
          <span
            className="mt-1 block font-serif text-lg font-medium"
            style={{ color: c.ink, letterSpacing: "-0.01em" }}
          >
            {article.title}
          </span>
          <span className="mt-1 block text-sm" style={{ color: c.ink2 }}>
            {article.teaser}
          </span>
        </span>
        <ArrowRight
          className="mt-1 h-4 w-4 flex-none transition-transform group-hover:translate-x-1"
          style={{ color: c.accent }}
          aria-hidden
        />
      </Link>
    </aside>
  )
}
