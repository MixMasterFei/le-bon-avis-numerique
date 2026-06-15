"use client"

import { useMemo } from "react"
import { useFamilyFit } from "@/components/home/FamilyFitProvider"
import type { RedesignCardMedia } from "./RedesignCard"

/**
 * Re-orders a rail's items by the selected members' family-fit score so the
 * child's TASTE (not just their age) drives what shows first. Uses the per-media
 * fit already fetched for the card avatars (FamilyFitProvider) — no extra
 * requests. Stable: items without a fit score yet keep their original order, so
 * cards only settle once fit loads (no jarring reshuffle before).
 */
export function useRankedByFit(
  items: RedesignCardMedia[],
  rankByMemberIds?: string[],
): RedesignCardMedia[] {
  const { getFamilyFit } = useFamilyFit()
  return useMemo(() => {
    if (!rankByMemberIds || rankByMemberIds.length === 0) return items
    const fitScore = (mediaId: string): number | null => {
      const members = getFamilyFit(mediaId)?.members
      if (!members) return null
      const scores = rankByMemberIds
        .map((id) => members.find((mm) => mm.id === id)?.score)
        .filter((s): s is number => typeof s === "number")
      if (scores.length === 0) return null
      return scores.reduce((a, b) => a + b, 0) / scores.length
    }
    return items
      .map((it, i) => ({ it, i, s: fitScore(it.id) }))
      .sort((a, b) => (b.s ?? -1) - (a.s ?? -1) || a.i - b.i)
      .map((x) => x.it)
  }, [items, rankByMemberIds, getFamilyFit])
}
