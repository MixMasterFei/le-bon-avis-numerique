import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { deleteUserAccount } from "@/lib/account-deletion"

// One transaction over the account's whole footprint (see account-deletion.ts).
export const maxDuration = 60

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    // Reviews and comments, family data, searches, clicks, conversations…
    // all removed together, or — on any failure — none of it.
    const deleted = await deleteUserAccount(session.user.id)
    if (!deleted) {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    // Name and Prisma code only: a Prisma message can echo the query's
    // arguments, and the account id must not outlive the account in the logs.
    const code = (error as { code?: unknown } | null)?.code
    console.error(
      "[account-deletion] failed, rolled back:",
      error instanceof Error ? error.name : "unknown",
      typeof code === "string" ? code : "",
    )
    return NextResponse.json(
      { error: "Erreur lors de la suppression du compte" },
      { status: 500 },
    )
  }
}
