import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getLiveBlogSlugs } from "@/lib/published-blog"
import { blogArticleHref, blogArticlesForShelf } from "@/lib/blog-links"

// « Conseils pour les parents » under the /films and /jeux catalogues: the
// live articles of that shelf (film articles on /films, game articles on
// /jeux in November–December only). Rules in @/lib/blog-links. Nothing is
// rendered when no article of the shelf is live, or when Sanity is
// unreachable (getLiveBlogSlugs never throws, it returns []). Callers wrap it
// in <Suspense fallback={null}>: it sits below the list, off the LCP path.

export async function ParentTipsStrip({ shelf }: { shelf: "films" | "jeux" }) {
  const articles = blogArticlesForShelf(shelf, {
    liveSlugs: await getLiveBlogSlugs(),
    month0: new Date().getMonth(),
  })
  if (articles.length === 0) return null

  return (
    <section
      aria-labelledby={`conseils-parents-${shelf}`}
      data-testid="parent-tips-strip"
      className="mx-auto w-full max-w-7xl px-4 pb-12 pt-2 md:px-8"
    >
      <h2
        id={`conseils-parents-${shelf}`}
        className="font-serif text-xl font-medium sm:text-2xl"
        style={{ color: "var(--color-ink)", letterSpacing: "-0.01em" }}
      >
        Conseils pour les parents
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <li key={a.slug}>
            <Link
              href={blogArticleHref(a.slug)}
              className="group flex h-full flex-col rounded-2xl p-4 transition-transform duration-200 hover:-translate-y-0.5"
              style={{ background: "var(--color-card)", border: "1px solid var(--color-line)" }}
            >
              <span className="font-serif text-base font-medium" style={{ color: "var(--color-ink)" }}>
                {a.title}
              </span>
              <span className="mt-1 flex-1 text-sm" style={{ color: "var(--color-ink2)" }}>
                {a.teaser}
              </span>
              <span
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold"
                style={{ color: "var(--color-accent)" }}
              >
                Lire l&apos;article
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
