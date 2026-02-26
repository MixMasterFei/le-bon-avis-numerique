import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

/**
 * Checks if the request is authorized for automated/cron access.
 * Accepts either:
 * 1. A valid user session (admin/moderator role)
 * 2. A Bearer token matching CRON_SECRET (for GitHub Actions / Vercel Cron)
 */
export async function isCronOrAdminAuthorized(req: NextRequest): Promise<boolean> {
  // Check CRON_SECRET first (fastest path for automated calls)
  const authHeader = req.headers.get("authorization")
  if (
    process.env.CRON_SECRET &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  ) {
    return true
  }

  // Fall back to session auth — require ADMIN role
  const session = await auth()
  if (session?.user?.role === "ADMIN") {
    return true
  }

  return false
}
