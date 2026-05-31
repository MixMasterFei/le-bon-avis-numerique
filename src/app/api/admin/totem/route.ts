import { NextRequest, NextResponse } from "next/server"
import {
  fetchTotemAdminOverview,
  fetchTotemConversationList,
} from "@/lib/totem-admin-kpis"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

function parseDays(raw: string | null): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 30
  return Math.min(90, Math.max(7, Math.floor(n)))
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const days = parseDays(sp.get("days"))

    if (sp.get("export") === "conversations") {
      const list = await fetchTotemConversationList({
        page: 1,
        pageSize: 500,
        q: sp.get("q") ?? undefined,
        onlyDown: sp.get("onlyDown") === "1",
        days,
      })
      const header =
        "id,started_at,last_message_at,user_email,anonymous,user_turns,feedback_up,feedback_down,source_page,preview\n"
      const lines = list.conversations.map((c) => {
        const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
        return [
          c.id,
          c.startedAt,
          c.lastMessageAt,
          c.userEmail ?? "",
          c.isAnonymous ? "yes" : "no",
          c.userTurns,
          c.feedbackUp,
          c.feedbackDown,
          c.sourcePage ?? "",
          esc(c.preview),
        ].join(",")
      })
      return new NextResponse(header + lines.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="totem-conversations-${days}d.csv"`,
        },
      })
    }

    const [overview, recentList] = await Promise.all([
      fetchTotemAdminOverview(days),
      fetchTotemConversationList({ page: 1, pageSize: 15, days }),
    ])

    return NextResponse.json({
      overview,
      recentConversations: recentList.conversations,
    })
  } catch (err) {
    console.error("[admin/totem] overview error", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
