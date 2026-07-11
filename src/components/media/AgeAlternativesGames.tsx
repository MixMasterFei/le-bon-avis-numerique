import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { toMediaRouteId } from "@/lib/media-route"
import { SafeImage } from "@/components/ui/SafeImage"

/**
 * "Trop grand pour votre enfant ? Alternatives plus jeunes dans le même esprit."
 *
 * Shown only on mature game fiches (the caller gates on age). Distinct from the
 * "Titres similaires" rail, which surfaces same-age-or-younger *similar* games:
 * this one deliberately drops the age by a clear margin so a parent who lands on
 * GTA (18) or Call of Duty (18) leaves with kid-appropriate options in the same
 * genre — the exact follow-up an answer engine (and a parent) wants after
 * "[jeu] à partir de quel âge".
 */

const AGE_GAP = 4 // alternatives must be at least this many years younger

interface AgeAlternativesGamesProps {
  mediaId: string
  title: string
  genres: string[]
  topics: string[]
  currentAge: number
}

export async function AgeAlternativesGames({
  mediaId,
  title,
  genres,
  topics,
  currentAge,
}: AgeAlternativesGamesProps) {
  const maxAge = currentAge - AGE_GAP
  if (maxAge < 3) return null

  const genreSet = new Set(genres.map((g) => g.toLowerCase()))
  const topicSet = new Set(topics.map((t) => t.toLowerCase()))

  const pool = await withPrismaRetry(() =>
    prisma.mediaItem.findMany({
      where: {
        type: "GAME",
        isEnriched: true,
        posterUrl: { not: null },
        id: { not: mediaId },
        expertAgeRec: { not: null, lte: maxAge, gte: 3 },
        OR: [
          ...(genres.length > 0 ? [{ genres: { hasSome: genres } }] : []),
          ...(topics.length > 0 ? [{ topics: { hasSome: topics } }] : []),
        ],
      },
      orderBy: [{ dataQualityScore: "desc" }],
      take: 30,
      select: {
        id: true,
        title: true,
        posterUrl: true,
        expertAgeRec: true,
        genres: true,
        topics: true,
      },
    }),
  )

  if (pool.length === 0) return null

  // Rank by style overlap (genre + topic), then keep the top 6. Prefer the
  // closest-but-still-younger age so a 16+ title favours 12s over 3s.
  const scored = pool
    .map((g) => {
      const genreOverlap = g.genres.filter((x) => genreSet.has(x.toLowerCase())).length
      const topicOverlap = g.topics.filter((x) => topicSet.has(x.toLowerCase())).length
      const ageProximity = g.expertAgeRec != null ? g.expertAgeRec : 0
      return { g, score: topicOverlap * 3 + genreOverlap * 2 + ageProximity * 0.1 }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((s) => s.g)

  if (scored.length === 0) return null

  return (
    <div
      className="rounded-2xl p-5 sm:p-6"
      style={{ background: "var(--color-warm-card)", border: "1px solid var(--color-warm-line)" }}
    >
      <h2
        className="font-serif text-xl md:text-2xl font-medium mb-1"
        style={{ color: "var(--color-warm-ink)", letterSpacing: "-0.02em" }}
      >
        Trop grand pour votre enfant ?{" "}
        <em className="italic" style={{ color: "var(--color-warm-accent)" }}>
          Alternatives plus jeunes
        </em>
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--color-warm-ink2)" }}>
        Des jeux dans le même esprit que {title}, conseillés pour un public plus jeune.
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 md:gap-4">
        {scored.map((item) => (
          <Link
            key={item.id}
            href={`/media/${toMediaRouteId("GAME", item.id)}`}
            className="group block"
          >
            <div
              className="relative aspect-[3/4] rounded-lg overflow-hidden mb-1.5"
              style={{ background: "var(--color-warm-bg2)" }}
            >
              {item.posterUrl && (
                <SafeImage
                  src={item.posterUrl}
                  alt={item.title}
                  fill
                  sizes="(max-width: 768px) 33vw, 120px"
                  className="object-cover transition-transform group-hover:scale-105"
                />
              )}
              {item.expertAgeRec != null && (
                <span
                  className="absolute top-1.5 left-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: "var(--color-warm-accent)", color: "var(--color-warm-card)" }}
                >
                  {item.expertAgeRec}+
                </span>
              )}
            </div>
            <p
              className="text-xs leading-snug line-clamp-2"
              style={{ color: "var(--color-warm-ink)" }}
            >
              {item.title}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
