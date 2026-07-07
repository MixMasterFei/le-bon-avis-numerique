import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { ArrowLeft, Film, ArrowRight, ChevronRight } from "lucide-react"
import { toMediaRouteId } from "@/lib/media-route"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { getCollectionWithItems } from "@/lib/collections"
import { COLLECTIONS } from "@/lib/collections-data"
import { CollectionIcon } from "@/components/collections/CollectionIcon"

// Server component (July 2026 rebuild): the Top-X list itself must be in the
// crawled HTML. The previous client version served a spinner to Google — the
// 10-15 titles, ages and links to their fiches only existed after a browser
// fetch. Metadata now reads local data (no more self-HTTP in a layout), and
// the page emits ItemList + BreadcrumbList JSON-LD matching the visible list.

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const collection = COLLECTIONS.find((c) => c.id === id)
  if (!collection) {
    return {
      title: "Collection — Sélection famille",
      description: "Une sélection thématique de films, séries et jeux analysés pour les familles.",
      alternates: { canonical: `/collections/${id}` },
    }
  }
  return {
    title: `${collection.title} — Sélection famille`,
    description: collection.description,
    alternates: { canonical: `/collections/${id}` },
    openGraph: {
      title: `${collection.title} | Totem Avisé`,
      description: collection.description,
      images: [{ url: "/icon.png", width: 620, height: 606, alt: "Totem Avisé" }],
    },
  }
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getCollectionWithItems(id)
  if (!data || data.items.length === 0) notFound()

  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const { collection, items } = data

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: collection.title,
    description: collection.description,
    url: `${baseUrl}/collections/${collection.id}`,
    numberOfItems: items.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title,
      url: `${baseUrl}/media/${toMediaRouteId(item.type as "MOVIE" | "TV" | "GAME", item.id)}`,
    })),
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Collections", item: `${baseUrl}/collections` },
      { "@type": "ListItem", position: 3, name: collection.title, item: `${baseUrl}/collections/${collection.id}` },
    ],
  }

  return (
    <div className="flex flex-col flex-1" style={{ background: p.bg, color: p.ink }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="max-w-3xl mx-auto py-8 px-4 w-full">
        <nav aria-label="Fil d'Ariane" className="mb-8">
          <ol className="flex flex-wrap items-center gap-1 text-sm" style={{ color: p.ink2 }}>
            <li>
              <Link href="/" className="hover:opacity-70">
                Accueil
              </Link>
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <Link href="/collections" className="hover:opacity-70">
                Collections
              </Link>
            </li>
            <li className="flex items-center gap-1 min-w-0">
              <ChevronRight className="h-3.5 w-3.5 flex-none" aria-hidden />
              <span className="truncate" style={{ color: p.ink }}>
                {collection.title}
              </span>
            </li>
          </ol>
        </nav>

        <header className="mb-10">
          <span
            className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "color-mix(in srgb, currentColor 13%, transparent)", color: p.accent }}
          >
            <CollectionIcon id={collection.id} className="h-7 w-7" />
          </span>
          <h1
            className={`${serifClass} text-3xl md:text-5xl font-medium leading-[1.05] mb-3`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            {collection.title}
          </h1>
          <p className="text-base md:text-lg mb-3" style={{ color: p.ink }}>
            {collection.description}
          </p>
          {collection.intro && (
            <p className="leading-relaxed text-sm md:text-base" style={{ color: p.ink2 }}>
              {collection.intro}
            </p>
          )}
          <div className="mt-6 flex items-center gap-3 text-xs" style={{ color: p.ink2 }}>
            <span>
              {items.length} titre{items.length > 1 ? "s" : ""} sélectionnés
            </span>
            <span>·</span>
            <span>
              {collection.lastUpdated
                ? `Mis à jour en ${new Date(collection.lastUpdated + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`
                : "Mis à jour régulièrement"}
            </span>
          </div>
          <hr className="mt-6" style={{ borderColor: p.line }} />
        </header>

        <div className="space-y-10">
          {items.map((item, index) => {
            const mediaUrl = `/media/${toMediaRouteId(item.type as "MOVIE" | "TV" | "GAME", item.id)}`
            const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : null

            return (
              <article key={item.id} className="group">
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className={`${serifClass} text-3xl font-medium`}
                    style={{ color: p.accent, opacity: 0.4, letterSpacing: "-0.02em" }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="h-px flex-1" style={{ background: p.line }} />
                </div>

                <Link href={mediaUrl} className="block">
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-5">
                    <div
                      className="relative w-full sm:w-48 aspect-[2/3] sm:aspect-auto sm:h-72 rounded-xl overflow-hidden shrink-0"
                      style={{ background: p.placeholder, boxShadow: `0 4px 12px ${p.line}` }}
                    >
                      {item.posterUrl ? (
                        <Image
                          src={item.posterUrl}
                          alt={item.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 640px) 100vw, 192px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="h-12 w-12" style={{ color: p.ink2, opacity: 0.4 }} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 py-1">
                      <h2
                        className={`${serifClass} text-xl md:text-2xl font-medium leading-snug mb-2 group-hover:opacity-70 transition-opacity`}
                        style={{ color: p.ink, letterSpacing: "-0.02em" }}
                      >
                        {item.title}
                      </h2>

                      <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
                        {item.expertAgeRec !== null && (
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full font-semibold text-xs"
                            style={{ background: p.bg2, color: p.accent2 }}
                          >
                            Dès {item.expertAgeRec} ans
                          </span>
                        )}
                        {year && <span style={{ color: p.ink2 }}>{year}</span>}
                        {item.type === "GAME" && <span style={{ color: p.ink2 }}>Jeu vidéo</span>}
                      </div>

                      {item.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {item.genres.slice(0, 4).map((genre) => (
                            <span
                              key={genre}
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: p.bg2, color: p.ink2 }}
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      )}

                      {item.synopsisFr && (
                        <p
                          className="text-sm leading-relaxed line-clamp-3 mb-4"
                          style={{ color: p.ink2 }}
                        >
                          {item.synopsisFr}
                        </p>
                      )}

                      <span
                        className="inline-flex items-center gap-1.5 text-sm font-semibold group-hover:opacity-70 transition-opacity"
                        style={{ color: p.accent }}
                      >
                        Voir la fiche complète
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </div>
                </Link>
              </article>
            )
          })}
        </div>

        <div className="mt-12 pt-8 text-center border-t" style={{ borderColor: p.line }}>
          <p className="text-sm mb-4" style={{ color: p.ink2 }}>
            Chaque titre renvoie vers sa fiche complète : âge conseillé, analyse
            détaillée et points de vigilance pour votre famille.
          </p>
          <Link
            href="/collections"
            className="inline-flex items-center gap-2 text-sm font-medium hover:opacity-70"
            style={{ color: p.accent }}
          >
            <ArrowLeft className="h-4 w-4" />
            Voir toutes les collections
          </Link>
        </div>
      </div>
    </div>
  )
}
