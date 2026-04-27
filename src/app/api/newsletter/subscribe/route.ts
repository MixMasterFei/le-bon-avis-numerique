import { NextRequest, NextResponse } from "next/server"
import { subscribeToNewsletter } from "@/lib/newsletter"

/**
 * Newsletter signup endpoint. Public (no auth required) — the
 * /apercudecouverte-v3 page is auth-gated, but visitors arriving
 * via shared links shouldn't have to log in just to subscribe.
 *
 * POST { email: string } → { status: 'subscribed' | 'already', email }
 *                       or { error } on validation / upstream failure.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body?.email === "string" ? body.email : ""
    if (!email) {
      return NextResponse.json({ error: "Email requis" }, { status: 400 })
    }
    const result = await subscribeToNewsletter(email)
    if (result.status === "error") {
      const httpStatus = result.reason === "email invalide" ? 400 : 502
      return NextResponse.json({ error: result.reason }, { status: httpStatus })
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error("[/api/newsletter/subscribe] failed:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
