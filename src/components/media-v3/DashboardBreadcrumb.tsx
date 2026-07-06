import Link from "next/link"

// Visible counterpart of the BreadcrumbList JSON-LD emitted by the media page.
// Google expects the on-page trail to back the markup, and the category link
// gives every fiche a crawlable path back to its listing page.
const CRUMB_CATEGORY: Record<string, { path: string; label: string }> = {
  MOVIE: { path: "/films", label: "Films" },
  TV: { path: "/series", label: "Séries" },
  GAME: { path: "/jeux", label: "Jeux vidéo" },
  BOOK: { path: "/livres", label: "Livres" },
  MANGA: { path: "/mangas", label: "Mangas" },
}

export function DashboardBreadcrumb({
  type,
  title,
}: {
  type: string
  title: string
}) {
  const category = CRUMB_CATEGORY[type]
  return (
    <nav aria-label="Fil d'Ariane" className="mb-4 text-[12px]" style={{ color: "#8A8072" }}>
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="transition-colors hover:text-[#2A251F]">
            Accueil
          </Link>
        </li>
        {category && (
          <>
            <li aria-hidden="true" style={{ color: "#A89A82" }}>
              ›
            </li>
            <li>
              <Link href={category.path} className="transition-colors hover:text-[#2A251F]">
                {category.label}
              </Link>
            </li>
          </>
        )}
        <li aria-hidden="true" style={{ color: "#A89A82" }}>
          ›
        </li>
        <li aria-current="page" className="max-w-[60vw] truncate font-medium" style={{ color: "#4A433A" }}>
          {title}
        </li>
      </ol>
    </nav>
  )
}
