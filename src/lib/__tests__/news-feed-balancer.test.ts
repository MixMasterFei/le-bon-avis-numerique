import { describe, expect, it } from "vitest"
import { balanceNewsForFeed, type BalanceableStory } from "@/lib/news-feed-balancer"

function story(
  id: string,
  tone: BalanceableStory["editorialTone"],
  cluster: BalanceableStory["topicCluster"],
): BalanceableStory {
  return { id, publishedAt: new Date(), editorialTone: tone, topicCluster: cluster }
}

describe("balanceNewsForFeed", () => {
  it("returns the same list when there's 0 or 1 stories", () => {
    expect(balanceNewsForFeed([])).toEqual([])
    const one = [story("a", "grave", "teen-suicide")]
    expect(balanceNewsForFeed(one)).toEqual(one)
  })

  it("swaps a grave hero with the next non-grave candidate", () => {
    const rows = [
      story("a", "grave", "teen-suicide"),
      story("b", "neutral", "cinema-sortie"),
      story("c", "concerning", "screen-time"),
    ]
    const out = balanceNewsForFeed(rows, 6)
    expect(out[0].id).toBe("b") // non-grave promoted
    expect(out[0].editorialTone).not.toBe("grave")
    expect(out.map((s) => s.id)).toContain("a") // grave still in list, just not hero
  })

  it("never places two stories with the same topicCluster consecutively", () => {
    const rows = [
      story("a", "neutral", "cinema-sortie"),
      story("b", "neutral", "teen-suicide"),
      story("c", "grave", "teen-suicide"), // would be next in pure recency
      story("d", "neutral", "sport"),
    ]
    const out = balanceNewsForFeed(rows, 6)
    const seen: string[] = []
    for (let i = 0; i < out.length - 1; i++) {
      const c1 = out[i].topicCluster
      const c2 = out[i + 1].topicCluster
      if (c1 && c2 && c1 === c2) {
        seen.push(`${out[i].id}+${out[i + 1].id}`)
      }
    }
    expect(seen).toEqual([])
  })

  it("caps grave stories to one in the top tier when the tail has room", () => {
    // 12 items, 3 grave at the top. Realistic V3 fetch is 18 items,
    // so the balancer has room to push extras to slots 6+.
    const rows = [
      story("a", "neutral", "cinema-sortie"),
      story("b", "grave", "teen-suicide"),
      story("c", "grave", "harcelement"),
      story("d", "grave", "drogue"),
      story("e", "neutral", "sport"),
      story("f", "neutral", "tech"),
      story("g", "neutral", "cuisine"),
      story("h", "neutral", "music"),
      story("i", "concerning", "screen-time"),
      story("j", "neutral", "school"),
      story("k", "neutral", "books"),
      story("l", "neutral", "art"),
    ]
    const out = balanceNewsForFeed(rows, 6)
    const graveCount = out.slice(0, 6).filter((s) => s.editorialTone === "grave").length
    expect(graveCount).toBeLessThanOrEqual(1)
    // Confirm the dropped grave stories are still in the tail, not removed.
    expect(out.map((s) => s.id).sort()).toEqual(rows.map((s) => s.id).sort())
  })

  it("promotes a positive story into the top tier when none would land there on recency alone", () => {
    const rows = [
      story("a", "neutral", "cinema-sortie"),
      story("b", "concerning", "screen-time"),
      story("c", "neutral", "tech"),
      story("d", "neutral", "sport"),
      story("e", "concerning", "harcelement"),
      story("f", "neutral", "school"),
      // Buried positive way past the top 6.
      story("g", "neutral", "music"),
      story("h", "positive", "good-news"),
    ]
    const out = balanceNewsForFeed(rows, 6)
    const top = out.slice(0, 6)
    expect(top.some((s) => s.editorialTone === "positive")).toBe(true)
  })

  it("treats null tone as neutral and null cluster as independent", () => {
    const rows = [
      story("a", null, null),
      story("b", null, null),
      story("c", null, null),
    ]
    const out = balanceNewsForFeed(rows, 6)
    expect(out.map((s) => s.id)).toEqual(["a", "b", "c"]) // unchanged
  })

  it("keeps the tail of the feed (beyond top N) intact", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      story(`a${i}`, "neutral", `cluster-${i}`),
    )
    const out = balanceNewsForFeed(rows, 6)
    expect(out).toHaveLength(12)
    // Tail past slot 6 stays where it was (all unique clusters, no
    // swaps happen).
    expect(out.slice(6).map((s) => s.id)).toEqual(rows.slice(6).map((s) => s.id))
  })
})
