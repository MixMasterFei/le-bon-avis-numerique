import { NextRequest, NextResponse } from "next/server"
import { fetchTotemConversationList } from "@/lib/totem-admin-kpis"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseDays(raw: string | null): number | undefined {
  if (!raw) return undefined
  const n = Number(raw)
  if (!Number.isFinite(n)) return undefined
  return Math.min(90, Math.max(7, Math.floor(n)))
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const page = Math.max(1, Number(sp.get("page") ?? 1) || 1)
    const pageSize = Math.min(50, Math.max(10, Number(sp.get("pageSize") ?? 20) || 20))

    const result = await fetchTotemConversationList({
      page,
      pageSize,
      q: sp.get("q") ?? undefined,
      onlyDown: sp.get("onlyDown") === "1",
      days: parseDays(sp.get("days")),
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error("[admin/totem/conversations] list error", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
