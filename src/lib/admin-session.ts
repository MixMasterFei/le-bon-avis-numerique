import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

/**
 * Route-level ADMIN gate for admin APIs whose answers carry personal data —
 * the Totem transcript readers (account e-mails, family snapshots, message
 * text). The middleware already demands an ADMIN session there; this second
 * check means those answers never rest on the middleware's matcher or on its
 * credential rules alone.
 *
 * Only a session counts. The automation credential (Bearer CRON_SECRET) is not
 * one, so a cron token gets 401 here. `auth()` re-reads the account on every
 * call (src/lib/auth-session.ts): a deleted account gets 401, a demoted one 403,
 * even while its cookie has not expired.
 *
 * Returns null for a current ADMIN, otherwise the response to send back.
 */
export async function requireAdminSession(): Promise<NextResponse | null> {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 })
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
  }
  return null
}
