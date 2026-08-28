import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Trophy, CalendarDays } from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { getCollectionSummaries, type CollectionSummary } from "@/lib/collections"
import { CollectionIcon } from "@/components/collections/CollectionIcon"

// Server component (July 2026 rebuild): the hub used to be client-rendered
// ("use client" + useEffect fetch), so its HTML was a spinner — Google never
// saw the links to the 16 collection pages, which also weren't in the sitemap.
// The Top-X lists are a primary SEO surface; their discovery path must be
// plain crawlable HTML.

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

export const metadata: Metadata = {
  title: "Collections — Sélections thématiques pour toute la famille",
  description:
    "Sélections thématiques de films, séries et jeux vidéo adaptés aux enfants et aux ados, avec âge conseillé.",
  alternates: { canonical: "/collections" },
  openGraph: {
    title: "Collections — Sélections thématiques pour toute la famille | Totem Avisé",
    description:
      "Sélections thématiques de films, séries et jeux vidéo adaptés aux enfants et aux ados, avec âge conseillé.",
    url: `${baseUrl}/collections`,
  },
}

export default async function CollectionsPage() {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const collections = await getCollectionSummaries()

  const topCollections = collections.filter((c) => c.category === "top")
  // In-season collections lead; out-of-season ones stay listed (their pages
  // are permanent SEO surfaces) but sink to the end — the block used to open
  // on « Films de Noël » in August, which reads as an unmaintained site.
  const month = new Date().getMonth()
  const inSeason = (c: (typeof collections)[number]) => !c.months || c.months.includes(month)
  const seasonalCollections = collections
    .filter((c) => c.category === "seasonal")
    .sort((a, b) => Number(inSeason(b)) - Number(inSeason(a)))

  // CollectionPage + ItemList of the collections themselves.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Collections — Sélections thématiques pour toute la famille",
    description:
      "Sélections thématiques de films, séries et jeux vidéo adaptés aux enfants et aux ados, avec âge conseillé.",
    url: `${baseUrl}/collections`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: collections.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.title,
        url: `${baseUrl}/collections/${c.id}`,
      })),
    },
  }

  return (
    <div className="flex flex-col flex-1" style={{ background: p.bg, color: p.ink }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section
        className="py-10 md:py-14"
        style={{ background: p.bg, borderBottom: `1px solid ${p.line}` }}
      >
        <div className="container mx-auto px-4 md:px-8">
          <div
            className="text-[11px] font-semibold mb-2 uppercase tracking-wide"
            style={{ color: p.accent }}
          >
            Découvrir
          </div>
          <h1
            className={`${serifClass} text-3xl md:text-5xl font-medium m-0 leading-[1.05]`}
            style={{ letterSpacing: "-0.02em", color: p.ink }}
          >
            Nos{" "}
            <em className="italic" style={{ color: p.accent }}>
              collections
            </em>
          </h1>
          <p className="mt-3 text-sm md:text-base max-w-2xl" style={{ color: p.ink2 }}>
            Des sélections par thème et par âge pour trouver rapidement le film
            ou le jeu parfait.
          </p>
        </div>
      </section>

      <section className="py-10 md:py-14" style={{ background: p.bg2 }}>
        <div className="container mx-auto px-4 md:px-8">
          {topCollections.length > 0 && (
            <section className="mb-12">
              <div className="flex items-center gap-2 mb-5">
                <Trophy className="h-5 w-5" style={{ color: p.accent }} />
                <h2
                  className={`${serifClass} text-xl md:text-2xl font-medium`}
                  style={{ color: p.ink, letterSpacing: "-0.02em" }}
                >
                  Nos classements
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {topCollections.map((collection) => (
                  <CollectionCard key={collection.id} collection={collection} />
                ))}
              </div>
            </section>
          )}

          {seasonalCollections.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-5">
                <CalendarDays className="h-5 w-5" style={{ color: p.accent2 }} />
                <h2
                  className={`${serifClass} text-xl md:text-2xl font-medium`}
                  style={{ color: p.ink, letterSpacing: "-0.02em" }}
                >
                  Saisons & occasions
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {seasonalCollections.map((collection) => (
                  <CollectionCard key={collection.id} collection={collection} />
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  )
}

function CollectionCard({ collection }: { collection: CollectionSummary }) {
  const p = APERCU_PALETTE
  const posters = collection.previewPosters || []
  const hasPosters = posters.length >= 4

  return (
    <Link href={`/collections/${collection.id}`}>
      <div
        className="group rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
        style={{
          background: p.card,
          border: `1px solid ${p.line}`,
          boxShadow: `0 2px 8px ${p.line}`,
        }}
      >
        <div className="relative aspect-[16/9] overflow-hidden">
          {hasPosters ? (
            <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
              {posters.slice(0, 4).map((url, i) => (
                <div key={i} className="relative overflow-hidden">
                  <Image
                    src={url}
                    alt={`${collection.title} — aperçu ${i + 1}`}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div
              className="h-full w-full flex items-center justify-center"
              style={{ background: p.bg2 }}
            >
              <span
                className="inline-flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: "rgba(255,255,255,0.55)", color: p.accent }}
              >
                <CollectionIcon id={collection.id} className="h-8 w-8" />
              </span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CollectionIcon id={collection.id} className="h-[18px] w-[18px] flex-none text-white" />
              <h3 className="font-semibold text-white text-sm leading-tight">
                {collection.title}
              </h3>
            </div>
            <p className="text-xs text-white/70">
              {collection.count} titre{collection.count > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="p-4 pt-3">
          <p className="text-xs line-clamp-2" style={{ color: p.ink2 }}>
            {collection.description}
          </p>
        </div>
      </div>
    </Link>
  )
}
