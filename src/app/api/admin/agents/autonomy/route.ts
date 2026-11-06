import { NextRequest, NextResponse } from "next/server"
import { DecisionError, isAutonomyLevel, parseMinConfidence, setAutonomy } from "@/lib/agent-ledger"
import { requireHumanAdmin } from "../require-human-admin"

/** PUT /api/admin/agents/autonomy  { actionType, level, minConfidence: number 0..1 | null } */
export async function PUT(req: NextRequest) {
  const admin = await requireHumanAdmin()
  if (!admin.ok) return NextResponse.json({ error: "Non autorisé" }, { status: 403 })

  let body: { actionType?: unknown; level?: unknown; minConfidence?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  }
  if (typeof body.actionType !== "string" || !isAutonomyLevel(body.level)) {
    return NextResponse.json({ error: "Niveau d'autonomie invalide" }, { status: 400 })
  }
  const minConfidence = parseMinConfidence(body.minConfidence)
  if (minConfidence === "invalid") {
    return NextResponse.json({ error: "Le seuil de confiance doit être entre 0 et 1" }, { status: 400 })
  }

  try {
    await setAutonomy(body.actionType, body.level, minConfidence, admin.userId)
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof DecisionError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error("[admin/agents] autonomy update failed:", e)
    return NextResponse.json(
      { error: "Enregistrement impossible (migration 015 appliquée ?)" },
      { status: 500 },
    )
  }
}
