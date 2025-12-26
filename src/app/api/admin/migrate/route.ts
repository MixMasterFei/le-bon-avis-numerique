import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// This endpoint helps verify/create tables if they don't exist
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    // Test that all tables exist by doing simple queries
    const results: Record<string, string> = {}

    try {
      await prisma.favorite.count()
      results.favorites = "OK"
    } catch (e: any) {
      results.favorites = `Error: ${e.message}`
    }

    try {
      await prisma.watchlist.count()
      results.watchlist = "OK"
    } catch (e: any) {
      results.watchlist = `Error: ${e.message}`
    }

    try {
      await prisma.reviewReport.count()
      results.reviewReports = "OK"
    } catch (e: any) {
      results.reviewReports = `Error: ${e.message}`
    }

    try {
      await prisma.review.count()
      results.reviews = "OK"
    } catch (e: any) {
      results.reviews = `Error: ${e.message}`
    }

    return NextResponse.json({
      message: "Table check complete",
      results,
      note: "If tables show errors, run 'npx prisma db push' locally or via Vercel CLI",
    })
  } catch (error) {
    console.error("Migration check error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la vérification" },
      { status: 500 }
    )
  }
}
