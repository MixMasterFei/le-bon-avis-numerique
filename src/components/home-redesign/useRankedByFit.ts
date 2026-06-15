"use client"

import { useMemo } from "react"
import { useFamilyFit } from "@/components/home/FamilyFitProvider"
import type { RedesignCardMedia } from "./RedesignCard"

/**
 * FILTERS then re-orders a rail's items for the selected family member(s).
 *
 * - Filter: a card is kept only if EVERY selected member is actually a fit for
 *   it — i.e. present in the card's family-fit `members` (the same set that
 *   draws the per-card meters). If a member was excluded (too young, disliked
 *   genre, avoided topic, mature content…), the card is dropped rather than
 *   shown under a "pour <enfant>" label where that child isn't even listed.
 *   The owner's rule: fewer-but-correct beats padded-with-unsuitable.
 * - Rank: the survivors are ordered by the selected members' fit score so the
 *   child's TASTE (not just age) drives what shows first.
 *
 * Uses the per-media fit already fetched for the card avatars
 * (FamilyFitProvider) — no extra requests. A card whose fit hasn't loaded yet
 * (`getFamilyFit` === null) is KEPT until the data arrives, then re-evaluated,
 * so there's no premature flash of an empty rail.
 */
export function useRankedByFit(
  items: RedesignCardMedia[],
  rankByMemberIds?: string[],
): RedesignCardMedia[] {
  const { getFamilyFit } = useFamilyFit()
  return useMemo(() => {
    if (!rankByMemberIds || rankByMemberIds.length === 0) return items

    // Keep only cards where every selected member is a confirmed fit. Unknown
    // (not-yet-loaded) cards pass through until their fit resolves.
    const kept = items.filter((it) => {
      const fit = getFamilyFit(it.id)
      if (!fit) return true
      const fitIds = new Set(fit.members.map((m) => m.id))
      return rankByMemberIds.every((id) => fitIds.has(id))
    })

    const fitScore = (mediaId: string): number | null => {
      const members = getFamilyFit(mediaId)?.members
      if (!members) return null
      const scores = rankByMemberIds
        .map((id) => members.find((mm) => mm.id === id)?.score)
        .filter((s): s is number => typeof s === "number")
      if (scores.length === 0) return null
      return scores.reduce((a, b) => a + b, 0) / scores.length
    }
    return kept
      .map((it, i) => ({ it, i, s: fitScore(it.id) }))
      .sort((a, b) => (b.s ?? -1) - (a.s ?? -1) || a.i - b.i)
      .map((x) => x.it)
  }, [items, rankByMemberIds, getFamilyFit])
}
