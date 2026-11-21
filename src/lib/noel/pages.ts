// The seasonal /noel pages, in one place: the sitemap, the /noel hub and the
// in-season links (homepage strip, /films, /jeux) all read this list, so a
// page cannot be linked without being in the sitemap or the other way round.
// Pure data, client-safe.

export interface NoelPage {
  path: string
  /** Link text. */
  title: string
  /** One line under the link. */
  blurb: string
}

export const NOEL_HUB_PATH = "/noel"

export const NOEL_PAGES: readonly NoelPage[] = [
  {
    path: "/noel/films-en-famille",
    title: "Films de Noël en famille, par âge",
    blurb: "Des tout-petits aux ados, les films de Noël rangés selon l'âge conseillé.",
  },
  {
    path: "/noel/jeux-video-a-offrir",
    title: "Jeux vidéo à offrir, par âge",
    blurb: "Des idées sur console actuelle, jamais plus jeunes que leur PEGI.",
  },
] as const
