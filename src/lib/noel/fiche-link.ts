import { isChristmasSeason, isChristmasThemed } from "@/lib/seasonal"
import { NOEL_FILMS_PATH, NOEL_GAMES_PATH } from "./pages"

// Which fiches carry the in-season « Noël en famille » link card, and where
// it points. Pure (no Prisma, no Next): the gift-list membership is looked up
// by the caller (./gift-membership.ts) and passed in as a boolean, so every
// rule here is pinned by src/lib/__tests__/noel-fiche-link.test.ts.
//
//   - Films and series: the same Christmas matcher as the seasonal gate
//     (isChristmasThemed: title, genres and topics) → the films page.
//   - Games: only those the gift page actually lists → the gift page. Being
//     a game « about » Christmas is not enough: the gift list has its own
//     rules (PEGI on the box, current console, age ≤ the oldest band).
//   - Nothing at all outside November–December (isChristmasSeason).

export const NOEL_FICHE_LINK_TITLE = "Noël en famille : nos sélections par âge"

export interface NoelFicheLink {
  href: string
  title: string
  blurb: string
}

export interface NoelFicheCandidate {
  type: string
  title?: string | null
  genres?: string[] | null
  topics?: string[] | null
}

export function noelFicheLink(
  media: NoelFicheCandidate,
  opts: { month0: number; isGiftGame: boolean },
): NoelFicheLink | null {
  if (!isChristmasSeason(opts.month0)) return null

  if ((media.type === "MOVIE" || media.type === "TV") && isChristmasThemed(media)) {
    return {
      href: NOEL_FILMS_PATH,
      title: NOEL_FICHE_LINK_TITLE,
      blurb: "Les films de Noël à regarder en famille, rangés selon l'âge que nous conseillons.",
    }
  }

  if (media.type === "GAME" && opts.isGiftGame) {
    return {
      href: NOEL_GAMES_PATH,
      title: NOEL_FICHE_LINK_TITLE,
      blurb:
        "Ce jeu figure dans nos idées de jeux vidéo à offrir. Retrouvez les autres, rangées par âge et jamais plus jeunes que leur PEGI.",
    }
  }

  return null
}
