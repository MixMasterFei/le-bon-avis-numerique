import { auth } from "@/lib/auth"

/**
 * The agent-ledger routes require a signed-in ADMIN *person*.
 *
 * The middleware also lets CRON_SECRET bearer calls into /api/admin/*, which
 * is right for maintenance jobs and wrong here: an automated job holding the
 * cron secret must never be able to approve its own proposals or raise its
 * own autonomy. So these handlers re-check the session and ignore the bearer.
 */
export async function requireHumanAdmin(): Promise<{ ok: true; userId: string } | { ok: false }> {
  const session = await auth()
  const userId = session?.user?.id
  if (session?.user?.role !== "ADMIN" || !userId) return { ok: false }
  return { ok: true, userId }
}
