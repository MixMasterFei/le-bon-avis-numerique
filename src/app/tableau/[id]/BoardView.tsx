"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import type { ReactNode } from "react"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { v2FontVars } from "@/components/home-redesign/fonts"
import { Em } from "@/components/home-redesign/parts"
import { computeStripes, type ResolvedBoard } from "@/lib/nl-search/resolve-blocks"
import { HeroMatch } from "@/app/decouverte/blocks/HeroMatch"
import {
  EditorialBlock,
  GridBlock,
  RailBlock,
  toRedesignCard,
} from "@/app/decouverte/blocks/BoardSections"
import { BlogBlock, NewsBlock, UpcomingBlock } from "@/app/decouverte/blocks/EditorialSources"
import { BoardBallot, type BallotItem } from "./BoardBallot"
import type { BallotTally } from "@/lib/nl-search/board-votes"

/**
 * A shared board. Same sections as /decouverte, without the search chrome —
 * this is something someone sent you, not a search you are steering.
 *
 * There is no member filter here even for the owner: the personalization a
 * board carries is whatever it was composed with, and a viewer who is not the
 * owner never receives family data at all (see page.tsx).
 */
export function BoardView({
  title,
  query,
  board,
  slots,
  isOwner,
  ballot,
}: {
  title: string | null
  query: string
  board: ResolvedBoard
  slots?: Record<number, ReactNode>
  isOwner: boolean
  ballot?: {
    boardId: string
    items: BallotItem[]
    budget: number
    initialTallies: BallotTally[]
    initialMyVotes: Record<string, number>
    initialMyName: string | null
    initialVoterCount: number
  } | null
}) {
  const stripes = computeStripes(board.blocks)
  return (
    <FamilyFitProvider>
      <div
        data-home="v2"
        className={`${v2FontVars} min-h-screen`}
        style={{ background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-hanken), system-ui, sans-serif" }}
      >
        <div className="mx-auto max-w-[1240px] px-5 py-12 sm:px-7">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: "var(--pine-2)" }} />
            <span className="text-[12.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--terra)" }}>
              Un tableau Totem Avisé
            </span>
          </div>

          <h1
            className="mt-3 max-w-[24ch] text-[clamp(28px,4vw,46px)] font-bold leading-[1.06]"
            style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em", color: "var(--ink)" }}
          >
            {title ?? (
              <>
                La sélection pour <Em tone="terra">« {query} »</Em>
              </>
            )}
          </h1>

          {title && query && (
            <p className="mt-3 max-w-[60ch] text-[15px]" style={{ color: "var(--ink-2)" }}>
              À partir de la demande&nbsp;: « {query} »
            </p>
          )}

          <p className="mt-4 max-w-[60ch] text-[13.5px]" style={{ color: "var(--ink-3)" }}>
            Les âges et les repères affichés sont ceux d&apos;aujourd&apos;hui&nbsp;: ce tableau se
            recompose à chaque ouverture, il ne fige rien.
          </p>

          {board.blocks.length === 0 ? (
            <p className="mt-10 text-[15px]" style={{ color: "var(--ink-2)" }}>
              Ce tableau ne contient plus de titres correspondant à ces critères.
            </p>
          ) : (
            board.blocks.map((block, index) => {
              const key = `${block.key}-${index}`
              const reveal = {
                className: "board-block-reveal",
                style: { animationDelay: `${Math.min(index, 6) * 90}ms` },
              } as const

              if (block.kind === "deferred") return <div key={key} {...reveal}>{slots?.[block.index] ?? null}</div>
              if (block.kind === "hero") return <div key={key} {...reveal}><HeroMatch meta={block.meta} hero={block.hero} /></div>
              if (block.kind === "editorial") return <div key={key} {...reveal}><EditorialBlock variant={block.key} meta={block.meta} /></div>
              const alt = stripes[index]
              if (block.kind === "upcoming") return <div key={key} {...reveal}><UpcomingBlock meta={block.meta} items={block.items} alt={alt} /></div>
              if (block.kind === "news") return <div key={key} {...reveal}><NewsBlock meta={block.meta} items={block.items} alt={alt} /></div>
              if (block.kind === "blog") return <div key={key} {...reveal}><BlogBlock meta={block.meta} items={block.items} alt={alt} /></div>
              if (block.kind === "grid") {
                return (
                  <div key={key} {...reveal}>
                    <GridBlock meta={block.meta} items={block.items.map(toRedesignCard)} alt={alt} sectionImage={block.sectionImage} />
                  </div>
                )
              }
              return (
                <div key={key} {...reveal}>
                  <RailBlock blockKey={block.key} meta={block.meta} items={block.items.map(toRedesignCard)} alt={alt} sectionImage={block.sectionImage} />
                </div>
              )
            })
          )}

          {ballot && (
            <BoardBallot
              boardId={ballot.boardId}
              items={ballot.items}
              budget={ballot.budget}
              initialTallies={ballot.initialTallies}
              initialMyVotes={ballot.initialMyVotes}
              initialMyName={ballot.initialMyName}
              initialVoterCount={ballot.initialVoterCount}
            />
          )}

          <section className="mt-16 border-t pt-12 text-center" style={{ borderColor: "var(--line)" }}>
            <h2
              className="mx-auto max-w-[20ch] text-[clamp(22px,3vw,34px)] font-bold leading-[1.08]"
              style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em", color: "var(--ink)" }}
            >
              Composez le <Em tone="terra">vôtre</Em>
            </h2>
            <p className="mx-auto mt-3 max-w-[52ch] text-[15px]" style={{ color: "var(--ink-2)" }}>
              Décrivez ce que vous cherchez pour votre famille, et Totem Avisé assemble une
              sélection avec un âge conseillé argumenté pour chaque titre.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/decouverte"
                className="rounded-full px-5 py-[11px] text-[14.5px] font-bold text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--terra)" }}
              >
                Poser ma question
              </Link>
              {isOwner && (
                <Link
                  href="/profil"
                  className="rounded-full px-5 py-[11px] text-[14.5px] font-bold transition-opacity hover:opacity-75"
                  style={{ background: "var(--paper-2)", border: "1px solid var(--line)", color: "var(--ink)" }}
                >
                  Mes tableaux
                </Link>
              )}
            </div>
          </section>
        </div>
      </div>
    </FamilyFitProvider>
  )
}
