import { NextResponse } from "next/server"
import { fetchTotemConversationDetail } from "@/lib/totem-admin-kpis"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const detail = await fetchTotemConversationDetail(id)
    if (!detail) {
      return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 })
    }
    return NextResponse.json(detail)
  } catch (err) {
    console.error("[admin/totem/conversations/id] detail error", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
