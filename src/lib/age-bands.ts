import type { Prisma } from "@prisma/client"

// Exclusive age bands — the single source for the /age/[range] pages, the
// /api/stats/age-bands counts and the homepage "Par âge" grid. The number a
// parent clicks on the homepage must match what the destination page lists,
// so both read the SAME catalog filter below.
//
// Bands are EXCLUSIVE (2-4, 5-7, …), not cumulative ceilings: "16+" counts
// only titles recommended from 16, not the whole catalog a 16-year-old could
// watch. Cumulative counts made the site read as adult-heavy when 16+ is in
// fact its smallest band.
// `voteFloor` keeps obscure noise off a browse surface — but it must scale
// with the band. Pre-school content (Tout-petits, Enfants) has far fewer TMDB
// votes than blockbusters, so a flat 50 hid ~100 already-enriched toddler
// titles and made the 2-4 band read as almost empty. Younger bands get a
// gentler floor; the mature bands keep the strict one (that's where shovelware
// and low-quality noise actually cluster).
export const AGE_BANDS = [
  { slug: "2-4", key: "2-4", min: 2, max: 4, voteFloor: 10 },
  { slug: "5-7", key: "5-7", min: 5, max: 7, voteFloor: 25 },
  { slug: "8-10", key: "8-10", min: 8, max: 10, voteFloor: 50 },
  { slug: "11-12", key: "11-12", min: 11, max: 12, voteFloor: 50 },
  { slug: "13-15", key: "13-15", min: 13, max: 15, voteFloor: 50 },
  { slug: "16-plus", key: "16+", min: 16, max: 18, voteFloor: 50 },
] as const

/** Catalog filter of the /age/[range] browse pages — films, séries and games
 *  only (mangas/books have their own sections), enriched, with a real poster,
 *  and a band-appropriate vote floor. */
export function ageBandCatalogWhere(min: number, max: number, voteFloor = 50): Prisma.MediaItemWhereInput {
  return {
    expertAgeRec: { gte: min, lte: max },
    posterUrl: { not: null, startsWith: "http" },
    isEnriched: true,
    type: { in: ["MOVIE", "TV", "GAME"] },
    AND: [{ tmdbVoteCount: { gte: voteFloor } }],
  }
}

/** Look up a band's vote floor by its route slug (e.g. "2-4" or "16-plus"). */
export function ageBandVoteFloor(slug: string): number {
  return AGE_BANDS.find((b) => b.slug === slug)?.voteFloor ?? 50
}
