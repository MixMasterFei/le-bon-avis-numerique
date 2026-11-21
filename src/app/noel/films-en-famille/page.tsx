import Link from "next/link"
import type { Metadata } from "next"
import { ChevronRight } from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { NoelBandNav, NoelBandSections } from "@/components/noel/NoelBandSections"
import { fetchChristmasFilmsByBand, NOEL_FILM_EXCLUDED_GENRES } from "@/lib/noel/queries"
import { noelItemListJsonLd, noelBreadcrumbJsonLd, NOEL_BASE_URL } from "@/lib/noel/structured-data"

// Same ISR window as the games pillar: ages move only when a fiche is
// re-enriched, and an hour is plenty for that.
export const revalidate = 3600

const PATH = "/noel/films-en-famille"
const TITLE = "Films de Noël en famille, par âge"
const DESCRIPTION =
  "Les films de Noël à regarder en famille, rangés par âge : 3-5 ans, 6-8 ans, 9-11 ans et 12 ans et plus. Pour chaque film, l'âge conseillé et ce qui peut gêner un enfant."

export const metadata: Metadata = {
  title: "Films de Noël en famille : lesquels choisir selon l'âge",
  description: DESCRIPTION,
  alternates: { canonical: `${NOEL_BASE_URL}${PATH}` },
  openGraph: {
    title: `${TITLE} | Totem Avisé`,
    description: DESCRIPTION,
    url: `${NOEL_BASE_URL}${PATH}`,
    type: "website",
    locale: "fr_FR",
    siteName: "Totem Avisé",
  },
}

export default async function FilmsDeNoelPage() {
  const p = APERCU_PALETTE
  const groups = await fetchChristmasFilmsByBand()
  const total = groups.reduce((n, g) => n + g.items.length, 0)

  const itemList = noelItemListJsonLd(TITLE, DESCRIPTION, PATH, groups)
  const breadcrumb = noelBreadcrumbJsonLd([{ name: "Noël en famille", path: "/noel" }, { name: TITLE, path: PATH }])

  return (
    <div className="flex flex-col flex-1" style={{ background: p.bg, color: p.ink }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <nav aria-label="Fil d'Ariane" className="mb-8">
          <ol className="flex flex-wrap items-center gap-1 text-sm" style={{ color: p.ink2 }}>
            <li>
              <Link href="/" className="hover:opacity-70">Accueil</Link>
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <Link href="/noel" className="hover:opacity-70">Noël en famille</Link>
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <span style={{ color: p.ink }}>Films de Noël</span>
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
          <p className="text-base md:text-lg mb-3" style={{ color: p.ink }}>
            Le Grinch, Klaus, Maman, j&apos;ai raté l&apos;avion… À quel âge les montrer ? Nous
            avons rangé les films de Noël de notre catalogue selon l&apos;âge à partir duquel nous
            les conseillons.
          </p>
          <p className="text-sm md:text-base leading-relaxed mb-6" style={{ color: p.ink2 }}>
            Chaque affiche mène à la fiche du film : les scènes qui peuvent faire peur, le
            langage, les messages, et la raison de l&apos;âge retenu. Dans chaque tranche, les
            films les plus appréciés passent en premier. Les films d&apos;horreur, les
            thrillers et les polars qui se passent à Noël n&apos;y figurent pas, pas plus que
            les films dont l&apos;âge n&apos;a pas encore été vérifié.
          </p>
          <NoelBandNav groups={groups} />
        </header>

        <NoelBandSections
          groups={groups}
          emptyText="Pas encore de film vérifié dans cette tranche."
          seeAll={(band) => ({
            href: `/films/recherche?topics=${encodeURIComponent("Noël")}&maxAge=${band.max}&excludeGenres=${NOEL_FILM_EXCLUDED_GENRES.join(",")}`,
            label: "Tous les films de Noël de cet âge",
          })}
        />

        <footer className="mt-16 border-t pt-8 text-sm" style={{ borderColor: p.line, color: p.ink2 }}>
          <p className="mb-4 max-w-3xl">
            L&apos;âge indiqué est un repère, pas une règle : vous connaissez votre enfant mieux que
            personne. {total > 0 ? `${total} films sont listés aujourd'hui ; la page se met à jour d'elle-même quand une fiche change.` : null}
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 font-semibold" style={{ color: p.accent }}>
            <li>
              <Link href="/collections/films-noel-famille" className="hover:opacity-70">
                Notre sélection resserrée de films de Noël
              </Link>
            </li>
            <li>
              <Link href="/noel/jeux-video-a-offrir" className="hover:opacity-70">
                Jeux vidéo à offrir, par âge
              </Link>
            </li>
            <li>
              <Link href="/films?sort=cinema" className="hover:opacity-70">
                En ce moment au cinéma
              </Link>
            </li>
          </ul>
        </footer>
      </div>
    </div>
  )
}
