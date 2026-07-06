import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Band, Wrap, Eyebrow, Em } from "./parts"
import { COLLECTIONS, COLLECTION_HIGHLIGHTS } from "@/lib/collections-data"

/**
 * "Nos collections" band — static, crawlable links to the Top-X collection
 * pages from the highest-authority page of the site. Deliberately NO fetch:
 * titles/emojis come from the collections data module, so the links are in
 * the server-rendered HTML (the homepage's useEffect content is not — this
 * band is the collections' discovery path for crawlers, alongside sitemap).
 */
export function CollectionsStrip() {
  const featured = COLLECTION_HIGHLIGHTS
    .map((id) => COLLECTIONS.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))

  return (
    <Band alt>
      <Wrap>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow>Sélections</Eyebrow>
            <h2
              className="mt-2 text-[clamp(24px,3vw,34px)] font-bold leading-[1.08]"
              style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em", color: "var(--ink)" }}
            >
              Nos <Em>collections</Em>, prêtes à regarder
            </h2>
            <p className="mt-2 max-w-xl text-[14.5px]" style={{ color: "var(--ink-2)" }}>
              Des classements vérifiés titre par titre, avec l&apos;âge conseillé
              pour chacun. Le raccourci des soirs où personne n&apos;arrive à choisir.
            </p>
          </div>
          <Link
            href="/collections"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-bold"
            style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}
          >
            Toutes les collections
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((c) => (
            <Link
              key={c.id}
              href={`/collections/${c.id}`}
              className="group rounded-[18px] p-5 transition-transform duration-200 hover:-translate-y-0.5"
              style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
            >
              <span className="text-3xl">{c.emoji}</span>
              <div
                className="mt-3 text-[16px] font-bold leading-snug"
                style={{ fontFamily: "var(--font-bricolage)", color: "var(--ink)" }}
              >
                {c.title}
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed line-clamp-2" style={{ color: "var(--ink-2)" }}>
                {c.description}
              </p>
              <span
                className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-bold transition-opacity group-hover:opacity-70"
                style={{ color: "var(--terra)" }}
              >
                Découvrir
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </Wrap>
    </Band>
  )
}
