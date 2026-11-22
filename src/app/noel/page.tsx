import Link from "next/link"
import type { Metadata } from "next"
import { ArrowRight, ChevronRight } from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { NoelCardGrid } from "@/components/noel/NoelBandSections"
import { fetchHolidayCinemaPicks, NOEL_CINEMA_MAX_AGE } from "@/lib/noel/queries"
import { NOEL_HUB_PATH, noelCrossLinks } from "@/lib/noel/pages"
import { noelBreadcrumbJsonLd, noelItemListJsonLd, NOEL_BASE_URL } from "@/lib/noel/structured-data"

// The cinema block reads the theatre listings live (cached one hour there);
// one hour here as well.
export const revalidate = 3600

const TITLE = "Que regarder pendant les vacances de Noël ?"
const DESCRIPTION =
  "Films de Noël par âge, films à voir en salle avec les enfants et idées de jeux vidéo à offrir : nos repères pour les vacances de Noël en famille."

export const metadata: Metadata = {
  title: "Vacances de Noël en famille : films, sorties cinéma et jeux à offrir",
  description: DESCRIPTION,
  alternates: { canonical: `${NOEL_BASE_URL}${NOEL_HUB_PATH}` },
  openGraph: {
    title: `${TITLE} | Totem Avisé`,
    description: DESCRIPTION,
    url: `${NOEL_BASE_URL}${NOEL_HUB_PATH}`,
    type: "website",
    locale: "fr_FR",
    siteName: "Totem Avisé",
  },
}

export default async function NoelHubPage() {
  const p = APERCU_PALETTE
  const cinema = await fetchHolidayCinemaPicks()

  const breadcrumb = noelBreadcrumbJsonLd([{ name: "Noël en famille", path: NOEL_HUB_PATH }])
  const itemList =
    cinema.length > 0
      ? noelItemListJsonLd("Au cinéma pendant les vacances de Noël", DESCRIPTION, NOEL_HUB_PATH, [
          { band: { key: "cinema", label: "Au cinéma", min: 0, max: NOEL_CINEMA_MAX_AGE }, items: cinema },
        ])
      : null

  return (
    <div className="flex flex-col flex-1" style={{ background: p.bg, color: p.ink }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      {itemList && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      )}
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <nav aria-label="Fil d'Ariane" className="mb-8">
          <ol className="flex flex-wrap items-center gap-1 text-sm" style={{ color: p.ink2 }}>
            <li>
              <Link href="/" className="hover:opacity-70">Accueil</Link>
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <span style={{ color: p.ink }}>Noël en famille</span>
            </li>
          </ol>
        </nav>

        <header className="mb-10 max-w-3xl">
          <h1
            className="font-serif text-3xl md:text-5xl font-medium leading-[1.05] mb-4"
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            {TITLE}
          </h1>
          <p className="text-base md:text-lg" style={{ color: p.ink }}>
            Deux semaines à la maison, des cousins de tous les âges et un sapin sous lequel
            il faudra bien poser quelque chose. Voici par où commencer.
          </p>
        </header>

        <ul className="mb-14 grid gap-4 md:grid-cols-3">
          {noelCrossLinks(NOEL_HUB_PATH).map((page) => (
            <li key={page.path}>
              <Link
                href={page.path}
                className="group block h-full rounded-2xl p-5 transition-transform duration-200 hover:-translate-y-0.5"
                style={{ background: p.card, border: `1px solid ${p.line}` }}
              >
                <span className="font-serif text-xl font-medium" style={{ color: p.ink }}>
                  {page.title}
                </span>
                <span className="mt-2 block text-sm" style={{ color: p.ink2 }}>
                  {page.blurb}
                </span>
                <span
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold"
                  style={{ color: p.accent }}
                >
                  Ouvrir <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                className="font-serif text-2xl md:text-3xl font-medium"
                style={{ color: p.ink, letterSpacing: "-0.02em" }}
              >
                Au cinéma en ce moment, avec les enfants
              </h2>
              <p className="mt-1 text-sm" style={{ color: p.ink2 }}>
                Les films à l&apos;affiche dont nous avons vérifié l&apos;âge, jusqu&apos;à{" "}
                {NOEL_CINEMA_MAX_AGE} ans.
              </p>
            </div>
            <Link
              href={`/films?sort=cinema&maxAge=${NOEL_CINEMA_MAX_AGE}`}
              className="text-sm font-semibold hover:opacity-70"
              style={{ color: p.accent }}
            >
              Voir tout →
            </Link>
          </div>
          {cinema.length > 0 ? (
            <NoelCardGrid items={cinema} />
          ) : (
            <p className="text-sm" style={{ color: p.ink2 }}>
              Les séances du moment sont momentanément indisponibles.{" "}
              <Link href="/films?sort=cinema" className="font-semibold" style={{ color: p.accent }}>
                Voir les films à l&apos;affiche
              </Link>
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
