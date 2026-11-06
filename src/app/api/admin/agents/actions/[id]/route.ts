import { NextRequest, NextResponse } from "next/server"
import { decideAgentAction, DecisionError, isHumanDecision } from "@/lib/agent-ledger"
import { requireHumanAdmin } from "../../require-human-admin"

/**
 * POST /api/admin/agents/actions/[id]  { decision: approve | reject | acknowledge | revert }
 *
 * approve      pending → applied (writes to the catalogue, compare-and-set)
 * reject       pending → rejected
 * acknowledge  applied + to review → applied (« Vu »)
 * revert       applied → reverted (restores the previous value if untouched)
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireHumanAdmin()
  if (!admin.ok) return NextResponse.json({ error: "Non autorisé" }, { status: 403 })

  const { id } = await ctx.params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  }
  const decision = (body as { decision?: unknown })?.decision
  if (!isHumanDecision(decision)) {
    return NextResponse.json({ error: "Décision inconnue" }, { status: 400 })
  }

  try {
    const result = await decideAgentAction(id, decision, admin.userId)
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    if (e instanceof DecisionError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("[admin/agents] decision failed:", e)
    return NextResponse.json({ error: "La décision n'a pas pu être enregistrée." }, { status: 500 })
  }
}
