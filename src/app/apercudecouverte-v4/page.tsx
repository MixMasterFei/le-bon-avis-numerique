import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatRelativeTimeFr } from "@/lib/utils"
import { isBlockedHotlinkImageUrl } from "@/lib/news-image-policy"
import { isFallbackCardUrl } from "@/lib/news-image"

export const dynamic = "force-dynamic"

type SourceRef = {
  name: string
  url: string
  favicon?: string
  headline?: string
}

type Row = {
  id: string
  slug: string
  title: string
  summary: string
  imageUrl: string
  imageCredit: string | null
  imageLicenseUrl: string | null
  imageSourceType: string | null
  category: string
  publishedAt: Date
  relevanceScore: number
  sources: Prisma.JsonValue
}

const CATEGORY_LABELS: Record<string, string> = {
  PARENTHOOD: "Famille",
  FILM_TV: "Films & series",
  GAMES: "Jeux video",
  READING: "Lectures",
  TECH: "Tech & IA",
}

function toSources(raw: Prisma.JsonValue | null): SourceRef[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  return raw.flatMap((entry): SourceRef[] => {
    if (typeof entry !== "object" || entry === null) return []
    const e = entry as Record<string, unknown>
    const name = typeof e.name === "string" ? e.name : ""
    const url = typeof e.url === "string" ? e.url : ""
    if (!name || !url || seen.has(name)) return []
    seen.add(name)
    return [{
      name,
      url,
      favicon: typeof e.favicon === "string" ? e.favicon : undefined,
      headline: typeof e.headline === "string" ? e.headline : undefined,
    }]
  })
}

function imageTier(row: Row): string {
  if (row.imageSourceType === "STOCK") return "Stock contextualise"
  if (row.imageSourceType === "FALLBACK" || isFallbackCardUrl(row.imageUrl)) return "Visuel Totem"
  if (row.imageSourceType === "AGENCY") {
    return row.imageCredit?.toLowerCase().includes("asset officiel") ? "Asset officiel" : "Agence"
  }
  if (row.imageSourceType === "PUBLISHER_RSS") return "RSS editeur"
  if (row.imageSourceType === "PUBLISHER_OG") return "OG editeur"
  return "Image source"
}

function imageCredit(row: Row): string {
  if (row.imageCredit) return row.imageCredit
  if (isFallbackCardUrl(row.imageUrl)) return "Totem Avise"
  return toSources(row.sources)[0]?.name ?? "Source"
}

function sourceLine(row: Row): string {
  const count = toSources(row.sources).length
  if (count <= 1) return "1 source"
  return `${count} sources`
}

function countBy<T extends string>(rows: Row[], getKey: (row: Row) => T): Array<{ key: T; count: number }> {
  const counts = new Map<T, number>()
  for (const row of rows) counts.set(getKey(row), (counts.get(getKey(row)) ?? 0) + 1)
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

function SourceDots({ sources }: { sources: SourceRef[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {sources.slice(0, 4).map((source) => (
        <a
          key={source.url}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          title={source.headline ?? source.name}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[10px] text-white/80 transition hover:bg-white/20"
        >
          {source.favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={source.favicon} alt="" className="h-3.5 w-3.5 rounded-sm" />
          ) : (
            source.name.slice(0, 1)
          )}
        </a>
      ))}
    </div>
  )
}
function VisualCredit({ row }: { row: Row }) {
  const label = `${imageTier(row)} : ${imageCredit(row)}`
  const className =
    "absolute bottom-2 right-2 max-w-[78%] truncate rounded bg-black/65 px-2 py-1 text-[10px] font-medium leading-none text-white/90 backdrop-blur"

  if (row.imageLicenseUrl) {
    return (
      <a href={row.imageLicenseUrl} target="_blank" rel="noopener noreferrer" className={className} title={label}>
        {label}
      </a>
    )
  }

  return <span className={className} title={label}>{label}</span>
}

function LeadStory({ row }: { row: Row }) {
  const sources = toSources(row.sources)
  return (
    <section className="grid gap-8 lg:grid-cols-[0.9fr_1.15fr] lg:items-center">
      <div className="min-w-0">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
          <span>{CATEGORY_LABELS[row.category] ?? row.category}</span>
          <span className="h-1 w-1 rounded-full bg-stone-600" />
          <span suppressHydrationWarning>{formatRelativeTimeFr(row.publishedAt)}</span>
        </div>
        <Link href={`/apercudecouverte/${row.slug}`} className="group block">
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.02] tracking-normal text-stone-100 md:text-5xl">
            {row.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-300">{row.summary}</p>
        </Link>
        <div className="mt-6 flex items-center gap-3 text-sm text-stone-400">
          <SourceDots sources={sources} />
          <span>{sourceLine(row)}</span>
        </div>
      </div>
      <Link
        href={`/apercudecouverte/${row.slug}`}
        className="group relative block aspect-[16/10] overflow-hidden rounded-2xl bg-stone-900"
      >
        <Image
          src={row.imageUrl}
          alt={row.title}
          fill
          priority
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
          sizes="(max-width: 1024px) 100vw, 52vw"
        />
        <VisualCredit row={row} />
      </Link>
    </section>
  )
}

function StoryTile({ row, wide = false }: { row: Row; wide?: boolean }) {
  const sources = toSources(row.sources)
  return (
    <article className={wide ? "grid gap-5 md:grid-cols-[280px_1fr]" : "flex flex-col"}>
      <Link
        href={`/apercudecouverte/${row.slug}`}
        className="group relative block aspect-[16/10] overflow-hidden rounded-xl bg-stone-900"
      >
        <Image
          src={row.imageUrl}
          alt={row.title}
          fill
          className="object-cover transition duration-500 group-hover:scale-[1.04]"
          sizes={wide ? "(max-width: 768px) 100vw, 280px" : "(max-width: 768px) 100vw, 24vw"}
        />
        <VisualCredit row={row} />
      </Link>
      <div className={wide ? "min-w-0 pt-1" : "pt-3"}>
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
          <span>{CATEGORY_LABELS[row.category] ?? row.category}</span>
          <span className="h-1 w-1 rounded-full bg-stone-700" />
          <span suppressHydrationWarning>{formatRelativeTimeFr(row.publishedAt)}</span>
        </div>
        <Link href={`/apercudecouverte/${row.slug}`} className="group block">
          <h2 className={`${wide ? "text-2xl" : "text-xl"} font-semibold leading-tight text-stone-100 group-hover:text-white`}>
            {row.title}
          </h2>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-stone-400">{row.summary}</p>
        </Link>
        <div className="mt-4 flex items-center gap-2 text-xs text-stone-500">
          <SourceDots sources={sources} />
          <span>{sourceLine(row)}</span>
        </div>
      </div>
    </article>
  )
}

function SideRail({ rows }: { rows: Row[] }) {
  const tiers = countBy(rows, imageTier)
  const categories = countBy(rows, (row) => CATEGORY_LABELS[row.category] ?? row.category)

  return (
    <aside className="space-y-7 lg:sticky lg:top-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-sm font-semibold text-stone-100">Audit visuel V4</h2>
        <div className="mt-4 space-y-3">
          {tiers.map((tier) => (
            <div key={tier.key}>
              <div className="mb-1 flex items-center justify-between text-xs text-stone-400">
                <span>{tier.key}</span>
                <span>{tier.count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#D16A4A]"
                  style={{ width: `${Math.max(8, Math.round((tier.count / rows.length) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-sm font-semibold text-stone-100">Sujets visibles</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((category) => (
            <span key={category.key} className="rounded-full bg-white/10 px-3 py-1 text-xs text-stone-300">
              {category.key} · {category.count}
            </span>
          ))}
        </div>
      </section>
    </aside>
  )
}

export default async function ApercuDecouverteV4Page() {
  let session
  try {
    session = await auth()
  } catch {
    redirect("/connexion?callbackUrl=/apercudecouverte-v4")
  }
  if (!session?.user?.id) {
    redirect("/connexion?callbackUrl=/apercudecouverte-v4")
  }

  const rows = await prisma.newsStory.findMany({
    where: { status: "PUBLISHED", storyType: "BRIEF" },
    orderBy: { publishedAt: "desc" },
    take: 36,
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      imageUrl: true,
      imageCredit: true,
      imageLicenseUrl: true,
      imageSourceType: true,
      category: true,
      publishedAt: true,
      relevanceScore: true,
      sources: true,
    },
  })

  const visibleRows = rows.filter((row) => row.imageUrl && !isBlockedHotlinkImageUrl(row.imageUrl))
  const [lead, ...rest] = visibleRows
  const top = rest.slice(0, 3)
  const stream = rest.slice(3, 15)

  return (
    <main className="min-h-screen bg-[#141311] text-stone-100">
      <div className="mx-auto max-w-[1280px] px-5 py-8 md:px-8">
        <header className="mb-10 flex items-center justify-between border-b border-white/10 pb-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[#D16A4A]">Apercu decouverte V4</div>
            <p className="mt-1 text-sm text-stone-400">Meme cron news, nouvelle lecture visuelle.</p>
          </div>
          <Link href="/apercudecouverte-v3" className="rounded-full border border-white/15 px-4 py-2 text-sm text-stone-300 transition hover:bg-white/10">
            Comparer V3
          </Link>
        </header>

        {!lead ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-stone-300">
            Aucune actualite publiee pour le moment.
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
            <div className="min-w-0 space-y-10">
              <LeadStory row={lead} />
              <section className="grid gap-5 md:grid-cols-3">
                {top.map((row) => <StoryTile key={row.id} row={row} />)}
              </section>
              <section className="space-y-8">
                {stream.map((row, index) => (
                  <StoryTile key={row.id} row={row} wide={index % 3 === 0} />
                ))}
              </section>
            </div>
            <SideRail rows={visibleRows} />
          </div>
        )}
      </div>
    </main>
  )
}
