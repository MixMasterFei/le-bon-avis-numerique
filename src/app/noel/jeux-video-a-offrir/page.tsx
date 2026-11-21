import Link from "next/link"
import type { Metadata } from "next"
import { ChevronRight } from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { NoelBandNav, NoelBandSections } from "@/components/noel/NoelBandSections"
import { fetchGiftGamesByBand } from "@/lib/noel/queries"
import { noelItemListJsonLd, noelBreadcrumbJsonLd, NOEL_BASE_URL } from "@/lib/noel/structured-data"

export const revalidate = 3600

const PATH = "/noel/jeux-video-a-offrir"
const TITLE = "Jeux vidéo à offrir à Noël, par âge"
const DESCRIPTION =
  "Des idées de jeux vidéo à offrir à Noël, rangées par âge (3-5, 6-8, 9-11 et 12 ans et plus), avec la classification PEGI, les consoles et l'âge que nous conseillons."

export const metadata: Metadata = {
  title: "Jeux vidéo à offrir à Noël : idées par âge",
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

export default async function JeuxAOffrirPage() {
  const p = APERCU_PALETTE
  const groups = await fetchGiftGamesByBand()

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
              <span style={{ color: p.ink }}>Jeux vidéo à offrir</span>
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
            Avant d&apos;emballer un jeu, deux repères comptent : le logo PEGI imprimé sur la
            boîte, et l&apos;âge que nous conseillons après avoir regardé le jeu de près.
          </p>
          <p className="text-sm md:text-base leading-relaxed mb-6" style={{ color: p.ink2 }}>
            Chaque jeu est rangé selon le plus strict des deux : un jeu PEGI 12 ne se retrouve
            jamais chez les 9-11 ans. Tous sortent sur une console actuelle (Switch, Switch 2,
            PS5 ou Xbox Series). Dans chaque tranche, quelques sorties récentes passent devant,
            puis les jeux les mieux notés. Quand un jeu vend des achats intégrés, la carte le
            signale ; la fiche précise le reste : jeu en ligne, ce qui peut gêner selon
            l&apos;âge.
          </p>
          <NoelBandNav groups={groups} />
        </header>

        <NoelBandSections groups={groups} emptyText="Pas encore de jeu vérifié dans cette tranche." />

        <footer className="mt-16 border-t pt-8 text-sm" style={{ borderColor: p.line, color: p.ink2 }}>
          <p className="mb-4 max-w-3xl">
            Votre enfant réclame un jeu qui n&apos;est pas ici, comme Fortnite, Roblox ou
            Minecraft ? Notre page « À partir de quel âge ? » répond pour les jeux les plus
            demandés, avec les réglages à vérifier.
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 font-semibold" style={{ color: p.accent }}>
            <li>
              <Link href="/jeux/quel-age" className="hover:opacity-70">
                Jeux vidéo : à partir de quel âge ?
              </Link>
            </li>
            <li>
              <Link href="/collections/top-jeux-famille" className="hover:opacity-70">
                Jeux à partager en famille
              </Link>
            </li>
            <li>
              <Link href="/noel/films-en-famille" className="hover:opacity-70">
                Films de Noël, par âge
              </Link>
            </li>
          </ul>
        </footer>
      </div>
    </div>
  )
}
