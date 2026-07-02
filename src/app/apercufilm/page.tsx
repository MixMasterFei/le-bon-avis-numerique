import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ApercuFilm } from "@/components/home-v2/ApercuFilm"
import { fraunces } from "@/components/home-v2/apercuFont"
import { isFraunces } from "@/components/home-v2/apercuTheme"

// Force full dynamic rendering so the session cookie is never cached
// and useSession() on the client always sees the authenticated user.
export const dynamic = "force-dynamic"

const OWNER_EMAIL = "masterfei@gmail.com"

interface SearchParams {
  font?: string
}

export default async function ApercuFilmPage(props: {
  searchParams?: Promise<SearchParams>
}) {
  let session
  try {
    session = await auth()
  } catch {
    redirect("/")
  }

  const user = session?.user as
    | { email?: string | null; role?: string }
    | undefined
  const isOwner = user?.email === OWNER_EMAIL || user?.role === "ADMIN"
  if (!isOwner) redirect("/")

  // Deterministic reference film: the highest-voted family-rated
  // movie that is fully enriched. Same film every load unless the
  // catalog dramatically shifts.
  const media = await prisma.mediaItem.findFirst({
    where: {
      type: "MOVIE",
      isEnriched: true,
      expertAgeRec: { gte: 5, lte: 10 },
      posterUrl: { not: null },
      dataQualityScore: { gte: 70 },
      contentMetrics: { isNot: null },
      originalLanguage: { in: ["fr", "en"] },
    },
    include: {
      contentMetrics: true,
      screenshots: {
        orderBy: { order: "asc" },
        take: 12,
      },
      reviews: {
        include: { user: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
    orderBy: [
      { tmdbVoteCount: { sort: "desc", nulls: "last" } },
      { tmdbRating: { sort: "desc", nulls: "last" } },
      { dataQualityScore: "desc" },
    ],
  })

  if (!media) {
    redirect("/apercu")
  }

  const searchParams = await props.searchParams
  const useFraunces = isFraunces(searchParams?.font)
  const serifClass = useFraunces
    ? fraunces.className
    : "font-[var(--font-heading)]"

  // Serialise the Prisma data (Date objects → ISO strings) so the
  // client boundary receives plain objects.
  const mediaForClient = {
    id: media.id,
    title: media.title,
    originalTitle: media.originalTitle,
    type: media.type as "MOVIE",
    posterUrl: media.posterUrl,
    backdropUrl: media.backdropUrl,
    synopsisFr: media.synopsisFr,
    releaseDate: media.releaseDate?.toISOString() ?? null,
    duration: media.duration,
    director: media.director,
    genres: media.genres,
    topics: media.topics,
    platforms: media.platforms,
    expertAgeRec: media.expertAgeRec,
    communityAgeRec: media.communityAgeRec,
    tmdbRating: media.tmdbRating,
    tmdbVoteCount: media.tmdbVoteCount,
    officialRating: media.officialRating,
    screenshots: media.screenshots.map((s) => ({
      id: s.id,
      url: s.url,
      width: s.width,
      height: s.height,
      order: s.order,
    })),
    contentMetrics: media.contentMetrics
      ? {
          violence: media.contentMetrics.violence,
          sexNudity: media.contentMetrics.sexNudity,
          language: media.contentMetrics.language,
          substanceUse: media.contentMetrics.substanceUse,
          consumerism: media.contentMetrics.consumerism,
          positiveMessages: media.contentMetrics.positiveMessages,
          roleModels: media.contentMetrics.roleModels,
          whatParentsNeedToKnow: media.contentMetrics.whatParentsNeedToKnow ?? [],
        }
      : null,
    reviews: media.reviews.map((r) => {
      const ext = r as unknown as {
        editedAt?: Date | null
        familyMember?: { id: string; name: string; avatarEmoji?: string } | null
      }
      return {
        id: r.id,
        role: r.role as "PARENT" | "KID" | "EDUCATOR",
        rating: r.rating,
        ageSuggestion: r.ageSuggestion ?? 0,
        comment: r.comment || "",
        createdAt: r.createdAt.toISOString(),
        editedAt: ext.editedAt?.toISOString() || null,
        user: r.user
          ? { id: r.user.id, name: r.user.name, image: r.user.image }
          : undefined,
        familyMember: ext.familyMember
          ? {
              id: ext.familyMember.id,
              name: ext.familyMember.name,
              avatarEmoji: ext.familyMember.avatarEmoji ?? "",
            }
          : null,
      }
    }),
  }

  return (
    <div className={useFraunces ? fraunces.variable : undefined}>
      <ApercuFilm
        media={mediaForClient}
        serifClass={serifClass}
      />
    </div>
  )
}
