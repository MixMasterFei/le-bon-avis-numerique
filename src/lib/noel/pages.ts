// The seasonal /noel pages, in one place: the sitemap, the /noel hub and the
// in-season links (homepage strip, /films, /jeux, fiches, games pillar) all
// read this list, so a page cannot be linked without being in the sitemap or
// the other way round. Pure data, client-safe.

export interface NoelPage {
  path: string
  /** Link text. */
  title: string
  /** One line under the link. */
  blurb: string
}

export const NOEL_HUB_PATH = "/noel"
export const NOEL_FILMS_PATH = "/noel/films-en-famille"
export const NOEL_GAMES_PATH = "/noel/jeux-video-a-offrir"

export const NOEL_PAGES: readonly NoelPage[] = [
  {
    path: NOEL_FILMS_PATH,
    title: "Films de Noël en famille, par âge",
    blurb: "Des tout-petits aux ados, les films de Noël rangés selon l'âge conseillé.",
  },
  {
    path: NOEL_GAMES_PATH,
    title: "Jeux vidéo à offrir, par âge",
    blurb: "Des idées sur console actuelle, jamais plus jeunes que leur PEGI.",
  },
] as const

/** The hand-picked Christmas collection (`films-noel-famille` in collections-data). */
export const NOEL_COLLECTION_ID = "films-noel-famille"

export const NOEL_COLLECTION: NoelPage = {
  path: `/collections/${NOEL_COLLECTION_ID}`,
  title: "Notre sélection de films de Noël",
  blurb: "Les classiques et quelques nouveautés, choisis un par un.",
}

export const NOEL_HUB: NoelPage = {
  path: NOEL_HUB_PATH,
  title: "Noël en famille : toutes nos idées",
  blurb: "Films de Noël, sorties au cinéma et jeux à offrir, au même endroit.",
}

/**
 * Every other page of the Noël set (hub, the two sub-pages, the collection),
 * in a fixed order, minus the one being viewed. The /noel pages and the
 * collection end with this list, so the four always link to one another.
 */
export function noelCrossLinks(currentPath: string): NoelPage[] {
  return [NOEL_HUB, ...NOEL_PAGES, NOEL_COLLECTION].filter((p) => p.path !== currentPath)
}
