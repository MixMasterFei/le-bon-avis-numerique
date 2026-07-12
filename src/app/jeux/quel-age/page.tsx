import Link from "next/link"
import type { Metadata } from "next"
import { ArrowLeft, Gamepad2 } from "lucide-react"
import { toMediaRouteId } from "@/lib/media-route"
import { getOfficialRatingDisplay } from "@/lib/utils"
import { buildQuickAnswer } from "@/lib/quick-answer"
import { SafeImage } from "@/components/ui/SafeImage"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { fetchTopGameRows } from "./gamesAgeData"

// The catalogue changes slowly relative to this page; a 1h ISR window keeps it
// fresh as titles get enriched without hammering the DB on every hit.
export const revalidate = 3600

const baseUrl = "https://totemavise.com"

export const metadata: Metadata = {
  title: "À partir de quel âge ? Les jeux vidéo que les enfants réclament | Totem Avisé",
  description:
    "Fortnite, Roblox, Minecraft, GTA… à partir de quel âge ? Pour chaque jeu très demandé : l'âge conseillé, la classification PEGI et les points à vérifier avant de laisser jouer votre enfant.",
  keywords: [
    "jeu vidéo à partir de quel âge",
    "âge jeux vidéo enfant",
    "fortnite quel âge",
    "roblox quel âge",
    "minecraft quel âge",
    "gta quel âge",
    "pegi",
    "avis parents jeux vidéo",
  ],
  alternates: { canonical: `${baseUrl}/jeux/quel-age` },
  openGraph: {
    title: "À partir de quel âge ? Les jeux vidéo que les enfants réclament | Totem Avisé",
    description:
      "Pour chaque jeu très demandé : l'âge conseillé, la classification PEGI et les points à vérifier avant de laisser jouer votre enfant.",
    type: "website",
    locale: "fr_FR",
    siteName: "Totem Avisé",
  },
}

export default async function GamesAgePillarPage() {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const rows = await fetchTopGameRows()

  // One honest verdict per row, from the shared builder so the wording matches
  // the fiche and the /md layer exactly.
  const enriched = rows.map((r) => {
    const qa = r.contentMetrics
      ? buildQuickAnswer({
          title: r.seed.name,
          type: "GAME",
          expertAgeRec: r.expertAgeRec,
          contentMetrics: r.contentMetrics,
        })
      : null
    const pegi = getOfficialRatingDisplay(r.officialRating, "GAME")
    return { ...r, qa, pegiLabel: pegi?.label ?? null }
  })

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Jeux vidéo", item: `${baseUrl}/jeux` },
      {
        "@type": "ListItem",
        position: 3,
        name: "À partir de quel âge ?",
        item: `${baseUrl}/jeux/quel-age`,
      },
    ],
  }

  const itemListLd =
    enriched.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Jeux vidéo : à partir de quel âge ?",
          numberOfItems: enriched.length,
          itemListElement: enriched.map((r, idx) => ({
            "@type": "ListItem",
            position: idx + 1,
            url: `${baseUrl}/media/${toMediaRouteId("GAME", r.id)}`,
            name: r.seed.name,
          })),
        }
      : null

  // FAQPage: the highest-value AIO citation surface — one honest Q&A per title,
  // same wording as each fiche. Cap at 12 so the block stays focused.
  const faqLd =
    enriched.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: enriched
            .filter((r) => r.qa)
            .slice(0, 12)
            .map((r) => ({
              "@type": "Question",
              name: r.qa!.question,
              acceptedAnswer: { "@type": "Answer", text: r.qa!.answer },
            })),
        }
      : null

  return (
    <div className="flex flex-col flex-1" style={{ background: p.bg, color: p.ink }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {itemListLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
        />
      )}
      {faqLd && faqLd.mainEntity.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}

      {/* Hero */}
      <section
        className="py-8 md:py-12"
        style={{ background: p.bg, borderBottom: `1px solid ${p.line}` }}
      >
        <div className="container mx-auto px-4 md:px-8">
          <Link
            href="/jeux"
            className="inline-flex items-center gap-2 text-sm hover:opacity-70 mb-5"
            style={{ color: p.ink2 }}
          >
            <ArrowLeft className="h-4 w-4" />
            Tous les jeux vidéo
          </Link>

          <div className="flex items-center gap-4 mb-5">
            <div className="p-3 rounded-2xl" style={{ background: p.bg2, color: p.accent }}>
              <Gamepad2 className="h-6 w-6" />
            </div>
            <div>
              <div
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: p.accent }}
              >
                Jeux vidéo
              </div>
              <h1
                className={`${serifClass} text-3xl md:text-4xl font-medium m-0 leading-[1.05]`}
                style={{ color: p.ink, letterSpacing: "-0.02em" }}
              >
                À partir de quel{" "}
                <em className="italic" style={{ color: p.accent }}>
                  âge
                </em>{" "}
                ?
              </h1>
            </div>
          </div>
          <p className="max-w-2xl text-sm md:text-base" style={{ color: p.ink2 }}>
            Les jeux que les enfants réclament le plus par leur nom. Pour chacun :
            l&apos;âge conseillé par Totem Avisé, la classification PEGI officielle et
            les points à vérifier avant de laisser jouer.
          </p>

          <div
            className="mt-6 max-w-3xl rounded-2xl p-4"
            style={{ background: p.card, border: `1px solid ${p.line}` }}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-wide mb-1"
              style={{ color: p.accent }}
            >
              Réponse rapide
            </p>
            <h2
              className={`${serifClass} text-lg md:text-xl font-medium mb-2`}
              style={{ color: p.ink, letterSpacing: "-0.02em" }}
            >
              Comment lire l&apos;âge d&apos;un jeu vidéo ?
            </h2>
            <p className="text-sm md:text-base leading-relaxed" style={{ color: p.ink2 }}>
              La classification <strong>PEGI</strong> indique un âge légal selon le
              contenu (violence, langage, jeu d&apos;argent). L&apos;
              <strong>âge conseillé Totem Avisé</strong> est un repère indépendant,
              qui tient aussi compte du jeu en ligne, du chat, des achats intégrés et
              de la sensibilité de chaque enfant. Les deux se complètent : lisez la
              fiche de chaque jeu pour le détail.
            </p>
          </div>
        </div>
      </section>

      {/* Rows */}
      <section className="flex-1 py-8 md:py-12" style={{ background: p.bg2 }}>
        <div className="container mx-auto px-4 md:px-8">
          {enriched.length > 0 ? (
            <ul className="flex flex-col gap-3 max-w-3xl">
              {enriched.map((r) => (
                <li key={r.id} id={r.seed.key}>
                  <Link
                    href={`/media/${toMediaRouteId("GAME", r.id)}`}
                    className="flex gap-4 rounded-2xl p-3 sm:p-4 transition-transform hover:-translate-y-0.5"
                    style={{ background: p.card, border: `1px solid ${p.line}` }}
                  >
                    <div
                      className="relative shrink-0 w-16 sm:w-20 aspect-[3/4] rounded-lg overflow-hidden"
                      style={{ background: p.bg2 }}
                    >
                      {r.posterUrl && (
                        <SafeImage
                          src={r.posterUrl}
                          alt={r.seed.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3
                          className={`${serifClass} text-base sm:text-lg font-medium m-0`}
                          style={{ color: p.ink, letterSpacing: "-0.01em" }}
                        >
                          {r.seed.name}
                        </h3>
                        {r.expertAgeRec != null && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{ background: p.accent, color: p.bg }}
                          >
                            Dès {r.expertAgeRec} ans
                          </span>
                        )}
                        {r.pegiLabel && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                            style={{ background: p.bg2, color: p.ink2, border: `1px solid ${p.line}` }}
                          >
                            {r.pegiLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm leading-snug mb-1" style={{ color: p.ink2 }}>
                        {r.seed.parentNote}
                      </p>
                      {r.qa && (
                        <p className="text-xs sm:text-sm leading-snug" style={{ color: p.ink }}>
                          {r.qa.sensitiveText}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div
              className="text-center py-16 rounded-2xl max-w-3xl"
              style={{ background: p.card, border: `1px solid ${p.line}` }}
            >
              <Gamepad2 className="h-12 w-12 mx-auto mb-4" style={{ color: p.ink2, opacity: 0.4 }} />
              <h2
                className={`${serifClass} text-2xl font-medium mb-2`}
                style={{ color: p.ink, letterSpacing: "-0.02em" }}
              >
                Bientôt disponible
              </h2>
              <p className="text-sm" style={{ color: p.ink2 }}>
                Ces fiches de jeux arrivent dans le catalogue.
              </p>
            </div>
          )}

          <p className="mt-8 text-xs max-w-3xl" style={{ color: p.ink2 }}>
            L&apos;âge conseillé est un repère indépendant, affiné par les familles —
            pas un verdict. Consultez chaque fiche pour l&apos;analyse détaillée du
            contenu et adaptez selon la sensibilité de votre enfant.
          </p>
        </div>
      </section>
    </div>
  )
}
