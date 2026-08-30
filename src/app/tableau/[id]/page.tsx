import { Suspense, type ReactNode } from "react"
import { cookies } from "next/headers"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { canUseNlSearch } from "@/lib/nl-search/access"
import { loadBoard, noteBoardView } from "@/lib/nl-search/boards"
import {
  BADGES_PER_VOTER,
  collectBallotCandidates,
  isValidVoterToken,
  readBallot,
  VOTER_COOKIE,
} from "@/lib/nl-search/board-votes"
import { computeStripes, resolveBoard } from "@/lib/nl-search/resolve-blocks"
import { DeferredBlock, DeferredBlockSkeleton } from "@/app/decouverte/blocks/DeferredBlock"
import { BoardView } from "./BoardView"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const board = await loadBoard(id)
  if (!board) return { title: "Tableau introuvable | Totem Avisé", robots: { index: false } }

  const heading = board.title ?? `La sélection pour « ${board.query} »`
  return {
    title: `${heading} | Totem Avisé`,
    description:
      "Une sélection famille composée sur Totem Avisé, avec un âge conseillé argumenté pour chaque titre.",
    // Not indexable — one URL per board would be an unbounded space, and every
    // title on it is already reachable from the catalogue. Link previews and
    // sharing are unaffected by noindex.
    robots: { index: false, follow: true },
    openGraph: { title: heading, type: "article" },
  }
}

export default async function TableauPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()

  // A board is part of Recherche magique, so it follows the same rollout gate.
  // While the feature is admin-only, a shared link is admin-only too.
  if (!canUseNlSearch({ isAuthenticated: !!session?.user, role: session?.user?.role })) {
    notFound()
  }

  const board = await loadBoard(id)
  if (!board) notFound()

  const isOwner = !!board.ownerId && board.ownerId === session?.user?.id

  // PRIVACY: only the owner sees their own family in their board. For anyone
  // else we resolve as though signed out — no member names, no ages, no
  // per-child fit. A link forwarded to a class group must not disclose who
  // lives in the house that composed it.
  const resolved = await resolveBoard({
    intent: board.intent,
    plan: board.plan,
    query: board.query,
    userId: isOwner ? board.ownerId : null,
  })

  void noteBoardView(id)

  // The ballot: candidates are the titles actually on the board, hero first,
  // and the tally is read with the visitor's own voter token so the page can
  // show their spent badges. The ballot exists only on SHARED boards — voting
  // on your own private search would be talking to yourself.
  const cookieToken = (await cookies()).get(VOTER_COOKIE)?.value
  const voterToken = isValidVoterToken(cookieToken) ? cookieToken : null
  const ballotItems = collectBallotCandidates(resolved)
  const ballot = ballotItems.length >= 2 ? await readBallot(id, voterToken) : null

  const seenIds = resolved.blocks.flatMap((block) =>
    block.kind === "grid" || block.kind === "rail" ? block.items.map((item) => item.id) : [],
  )
  const stripes = computeStripes(resolved.blocks)
  const slots: Record<number, ReactNode> = {}
  resolved.blocks.forEach((block, i) => {
    if (block.kind !== "deferred") return
    slots[block.index] = (
      <Suspense fallback={<DeferredBlockSkeleton />}>
        <DeferredBlock
          blockKey={block.key}
          meta={block.meta}
          intent={board.intent}
          query={board.query}
          seenIds={seenIds}
          alt={stripes[i]}
        />
      </Suspense>
    )
  })

  return (
    <BoardView
      title={board.title}
      query={board.query}
      board={resolved}
      slots={slots}
      isOwner={isOwner}
      ballot={
        ballot
          ? {
              boardId: id,
              items: ballotItems,
              budget: BADGES_PER_VOTER,
              initialTallies: ballot.tallies,
              initialMyVotes: ballot.myVotes,
              initialMyName: ballot.myName,
              initialVoterCount: ballot.voterCount,
            }
          : null
      }
    />
  )
}
