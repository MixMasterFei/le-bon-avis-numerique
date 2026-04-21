import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, ThumbsDown, ThumbsUp } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

export const dynamic = "force-dynamic"
export const revalidate = 0

const MIN_VOTES = 5
const DISAGREEMENT_THRESHOLD = 0.5 // items below this agree ratio are flagged

interface DisagreedItem {
  mediaId: string
  title: string
  type: "MOVIE" | "TV" | "GAME"
  posterUrl: string | null
  expertAgeRec: number | null
  totalVotes: number
  agrees: number
  disagrees: number
  agreePct: number
  suggestedAges: { age: number; count: number }[]
}

async function loadDisagreedItems(): Promise<DisagreedItem[]> {
  // Step 1 — aggregate vote counts per media/agree combination.
  const breakdown = await prisma.ageVote.groupBy({
    by: ["mediaId", "agree"],
    _count: { _all: true },
  })

  const votesByMedia = new Map<string, { agrees: number; disagrees: number }>()
  for (const row of breakdown) {
    const cur = votesByMedia.get(row.mediaId) ?? { agrees: 0, disagrees: 0 }
    if (row.agree) cur.agrees += row._count._all
    else cur.disagrees += row._count._all
    votesByMedia.set(row.mediaId, cur)
  }

  // Step 2 — keep only items that actually need attention.
  const disagreedIds: string[] = []
  for (const [mediaId, { agrees, disagrees }] of votesByMedia.entries()) {
    const total = agrees + disagrees
    if (total >= MIN_VOTES && agrees / total < DISAGREEMENT_THRESHOLD) {
      disagreedIds.push(mediaId)
    }
  }

  if (disagreedIds.length === 0) return []

  // Step 3 — hydrate with media metadata.
  const medias = await prisma.mediaItem.findMany({
    where: { id: { in: disagreedIds } },
    select: {
      id: true,
      title: true,
      type: true,
      posterUrl: true,
      expertAgeRec: true,
    },
  })
  const mediaById = new Map(medias.map((m) => [m.id, m]))

  // Step 4 — suggestedAge histogram per media (only disagreeing voters
  // tend to suggest one; these are the signal for "what should the age be").
  const suggestions = await prisma.ageVote.findMany({
    where: {
      mediaId: { in: disagreedIds },
      agree: false,
      suggestedAge: { not: null },
    },
    select: { mediaId: true, suggestedAge: true },
  })
  const suggestedByMedia = new Map<string, Map<number, number>>()
  for (const s of suggestions) {
    if (s.suggestedAge == null) continue
    const bucket = suggestedByMedia.get(s.mediaId) ?? new Map<number, number>()
    bucket.set(s.suggestedAge, (bucket.get(s.suggestedAge) ?? 0) + 1)
    suggestedByMedia.set(s.mediaId, bucket)
  }

  // Step 5 — assemble, sort by disagreement strength (lower agree% first).
  const items: DisagreedItem[] = disagreedIds
    .map((mediaId) => {
      const media = mediaById.get(mediaId)
      const votes = votesByMedia.get(mediaId)!
      if (!media) return null
      const total = votes.agrees + votes.disagrees
      const sugg = suggestedByMedia.get(mediaId) ?? new Map()
      const suggestedAges = Array.from(sugg.entries())
        .map(([age, count]) => ({ age, count }))
        .sort((a, b) => b.count - a.count)
      return {
        mediaId,
        title: media.title,
        type: media.type as "MOVIE" | "TV" | "GAME",
        posterUrl: media.posterUrl,
        expertAgeRec: media.expertAgeRec,
        totalVotes: total,
        agrees: votes.agrees,
        disagrees: votes.disagrees,
        agreePct: Math.round((votes.agrees / total) * 100),
        suggestedAges,
      }
    })
    .filter((x): x is DisagreedItem => x !== null)
    .sort((a, b) => a.agreePct - b.agreePct)

  return items
}

export default async function DisagreedItemsPage() {
  let session
  try {
    session = await auth()
  } catch {
    redirect("/")
  }
  const role = (session?.user as { role?: string } | undefined)?.role
  if (role !== "ADMIN" && role !== "MODERATOR") {
    redirect("/")
  }

  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const items = await loadDisagreedItems()

  return (
    <div
      className="flex flex-col flex-1"
      style={{ background: p.bg, color: p.ink }}
    >
      <div className="container mx-auto px-4 md:px-8 py-8 md:py-12 flex flex-col gap-6 max-w-5xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm w-fit hover:opacity-70"
          style={{ color: p.ink2 }}
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au tableau de bord
        </Link>

        <header>
          <div
            className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
            style={{ color: p.accent }}
          >
            Calibrage communautaire
          </div>
          <h1
            className={`${serifClass} text-3xl md:text-4xl font-medium leading-[1.05]`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Désaccords{" "}
            <em className="italic" style={{ color: p.accent }}>
              communautaires
            </em>
          </h1>
          <p className="mt-3 text-sm md:text-base max-w-2xl" style={{ color: p.ink2 }}>
            Fiches où au moins {MIN_VOTES} parents ont voté et où moins de{" "}
            {Math.round(DISAGREEMENT_THRESHOLD * 100)} % sont d&apos;accord avec
            notre recommandation d&apos;âge. Ces items demandent un coup
            d&apos;œil humain — ré-enrichir, ou écraser manuellement l&apos;âge.
          </p>
        </header>

        {items.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: p.card, border: `1px solid ${p.line}` }}
          >
            <p className="text-sm" style={{ color: p.ink2 }}>
              Aucun désaccord significatif pour le moment. La communauté est
              alignée sur les recommandations automatisées.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((it) => (
              <DisagreedItemRow key={it.mediaId} item={it} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DisagreedItemRow({ item }: { item: DisagreedItem }) {
  const p = APERCU_PALETTE
  const topSuggested = item.suggestedAges[0]

  return (
    <Link
      href={`/media/${item.mediaId}`}
      className="rounded-2xl p-4 md:p-5 flex items-center gap-4 transition-transform hover:-translate-y-0.5"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div
        className="flex-shrink-0 w-14 h-20 rounded-lg overflow-hidden"
        style={{ background: p.placeholder }}
      >
        {item.posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.posterUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3
            className="font-semibold text-base truncate"
            style={{ color: p.ink }}
          >
            {item.title}
          </h3>
          <span
            className="text-[11px] px-1.5 py-0.5 rounded-full uppercase tracking-wide"
            style={{ background: p.bg2, color: p.ink2 }}
          >
            {item.type}
          </span>
          {item.expertAgeRec !== null && (
            <span
              className="text-[11px] px-1.5 py-0.5 rounded-full"
              style={{ background: p.bg2, color: p.ink }}
            >
              actuelle : {item.expertAgeRec}+
            </span>
          )}
        </div>

        <div
          className="flex items-center gap-4 mt-2 text-xs"
          style={{ color: p.ink2 }}
        >
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />
            {item.agrees}
          </span>
          <span className="flex items-center gap-1">
            <ThumbsDown className="h-3 w-3" style={{ color: p.accent }} />
            {item.disagrees}
          </span>
          <span style={{ color: p.accent }}>
            {item.agreePct}% d&apos;accord · {item.totalVotes} votes
          </span>
          {topSuggested && (
            <span style={{ color: p.ink2 }}>
              Âge suggéré par la communauté :{" "}
              <strong style={{ color: p.ink }}>{topSuggested.age}+</strong>
              {item.suggestedAges.length > 1 &&
                ` (+${item.suggestedAges.length - 1} autres)`}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
