import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { subscribeToNewsletter } from "@/lib/newsletter"

/**
 * Newsletter signup endpoint.
 *
 * Currently in **admin-only beta**: only authenticated ADMIN users
 * can subscribe. Xavier wants to validate the newsletter format and
 * cron automation on his own account before opening it up to all
 * visitors (the v3 page is auth-gated already, but we don't want
 * other test accounts to start receiving partially-baked digests).
 *
 * To go public after validation: set NEWSLETTER_PUBLIC=true on
 * Vercel — the gate below flips to "any authenticated user".
 *
 * POST { email: string } → { status: 'subscribed' | 'already', email }
 *                       or { error } on validation / upstream failure.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const isAdmin = session.user.role === "ADMIN"
    const isPublic = process.env.NEWSLETTER_PUBLIC === "true"
    if (!isAdmin && !isPublic) {
      return NextResponse.json(
        { error: "Inscription bientôt disponible." },
        { status: 403 },
      )
    }

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
