import { NextResponse } from "next/server"
import { auth, updateSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * PATCH /api/user/onboarding
 * Marks the current user's onboarding as complete.
 */
export async function PATCH() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { onboardingCompleted: true },
  })

  // Rotate the session JWT in THIS response so the middleware sees
  // onboardingCompleted=true on the very next navigation (the jwt callback
  // runs with trigger "update" and re-reads the flag from the DB). Relying on
  // the client's useSession().update() proved flaky: the cookie kept the
  // stale `false` and the middleware bounced the user straight back to
  // /onboarding after they finished the wizard.
  try {
    await updateSession({ user: {} })
  } catch (error) {
    console.error("[onboarding] session JWT refresh failed:", error)
  }

  return NextResponse.json({ success: true })
}
