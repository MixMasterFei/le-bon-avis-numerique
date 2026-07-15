import { prisma } from "@/lib/prisma"
import { formatReaderSignals } from "@/lib/news-feedback"

/**
 * Server half of the news reader-feedback loop (the pure vocabulary +
 * formatter live in news-feedback.ts, shared with the client buttons).
 *
 * Loads the last 30 days of reader reactions (joined to story title/category)
 * and returns the formatted prompt section for news-discover. Fail-open: any
 * DB error (e.g. the reason columns not applied yet) returns "" so a feedback
 * hiccup can never block the news pipeline.
 */
export async function getReaderFeedbackSignals(): Promise<string> {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    // DISLIKE-only in the QUERY: the signals section only reports dislikes,
    // and fetching all types meant a like-heavy month could push the useful
    // dislikes out of the 300-row sample.
    const rows = await prisma.newsStoryReaction.findMany({
      where: { type: "DISLIKE", updatedAt: { gte: since } },
      select: {
        type: true,
        reasonCode: true,
        reasonNote: true,
        newsStory: { select: { category: true, title: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    })
    return formatReaderSignals(
      rows.map((r) => ({
        type: r.type,
        reasonCode: r.reasonCode,
        reasonNote: r.reasonNote,
        category: String(r.newsStory.category),
        title: r.newsStory.title,
      })),
    )
  } catch (err) {
    console.warn("[news-feedback] signals unavailable:", err)
    return ""
  }
}
