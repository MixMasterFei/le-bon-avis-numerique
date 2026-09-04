import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Staff access management — who may open /steph.
 *
 * Deliberately STRICTER than the other admin routes, which accept
 * `ADMIN || MODERATOR` (see /api/admin/tags). Granting a role is the one
 * operation a moderator must never perform: /steph is open to MODERATOR, so
 * the loose convention would let anyone with pilotage access hand it out.
 * ADMIN only, here and nowhere else in this file.
 *
 * Three further guards, all about not being able to shoot yourself:
 *  - ADMIN is never granted or revoked through the API. It is the role that
 *    can reach /admin, run imports and edit the catalogue; promoting to it
 *    stays a deliberate act at the database. This endpoint toggles exactly
 *    USER <-> MODERATOR.
 *  - You cannot change your own role, so the last admin cannot demote himself
 *    and lock everyone out.
 *  - An account that is currently ADMIN is never touched.
 */

const STAFF_ROLE = "MODERATOR" as const
const PLAIN_ROLE = "USER" as const

async function requireAdmin() {
  const session = await auth()
  return {
    ok: session?.user?.role === "ADMIN",
    userId: session?.user?.id ?? null,
  }
}

/** GET /api/admin/users?q= — accounts, newest first, optionally filtered. */
export async function GET(request: NextRequest) {
  try {
    const { ok } = await requireAdmin()
    if (!ok) return NextResponse.json({ error: "Non autorise" }, { status: 403 })

    const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80)
    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      // Staff first so the people who already have access are always visible,
      // then most recent signups.
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      take: 50,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })

    return NextResponse.json({ users, staffCount: users.filter((u) => u.role !== PLAIN_ROLE).length })
  } catch (error) {
    console.error("Admin users list error:", error)
    return NextResponse.json({ error: "Erreur" }, { status: 500 })
  }
}

/** PATCH — body { id, pilotage: boolean }. Toggles USER <-> MODERATOR. */
export async function PATCH(request: NextRequest) {
  try {
    const { ok, userId } = await requireAdmin()
    if (!ok) return NextResponse.json({ error: "Non autorise" }, { status: 403 })

    const body = await request.json().catch(() => null)
    const id = typeof body?.id === "string" ? body.id : ""
    const pilotage = body?.pilotage
    if (!id || typeof pilotage !== "boolean") {
      return NextResponse.json({ error: "id et pilotage (booleen) requis" }, { status: 400 })
    }

    if (id === userId) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas modifier votre propre acces." },
        { status: 400 },
      )
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
    if (!target) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 })
    if (target.role === "ADMIN") {
      return NextResponse.json(
        { error: "Ce compte est administrateur : son role se change en base, pas ici." },
        { status: 409 },
      )
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role: pilotage ? STAFF_ROLE : PLAIN_ROLE },
      select: { id: true, name: true, email: true, role: true },
    })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error("Admin users role error:", error)
    return NextResponse.json({ error: "Erreur" }, { status: 500 })
  }
}
