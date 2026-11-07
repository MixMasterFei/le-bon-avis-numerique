import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { isCronJobRequest } from "@/lib/cron-credential"

/**
 * Authorizes a job endpoint. Accepts either:
 * 1. The automation credential (`Bearer <CRON_SECRET>`, from GitHub Actions or
 *    Vercel Cron) — only on the job routes the schedulers call
 *    (CRON_JOB_ROUTES in src/lib/cron-credential.ts), compared in constant
 *    time, and never when the secret is unset or blank.
 * 2. A current ADMIN session. `auth()` re-reads the account on every call
 *    (src/lib/auth-session.ts), so a deleted or demoted account is refused
 *    even while its cookie is still unexpired.
 *
 * The "Vérifier les guides" button (/admin/operations#guides) relies on (2)
 * against the same handler the monthly cron reaches through (1).
 */
export async function isCronOrAdminAuthorized(req: NextRequest): Promise<boolean> {
  if (isCronJobRequest(req)) return true

  const session = await auth()
  return session?.user?.role === "ADMIN"
}
