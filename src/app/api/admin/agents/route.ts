import { NextResponse } from "next/server"
import { getLedgerOverview } from "@/lib/agent-ledger"
import { requireHumanAdmin } from "./require-human-admin"

export const dynamic = "force-dynamic"

/** GET /api/admin/agents — queue, review list, history, autonomy policy, 30-day costs. */
export async function GET() {
  const admin = await requireHumanAdmin()
  if (!admin.ok) return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
  return NextResponse.json(await getLedgerOverview())
}
