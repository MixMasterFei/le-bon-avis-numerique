import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const [
      movieCount,
      gameCount,
      tvCount,
      bookCount,
      reviewCount,
      recentMovies,
      recentGames,
      moviesWithAgeRec,
      gamesWithAgeRec,
    ] = await Promise.all([
      prisma.mediaItem.count({ where: { type: "MOVIE" } }),
      prisma.mediaItem.count({ where: { type: "GAME" } }),
      prisma.mediaItem.count({ where: { type: "TV" } }),
      prisma.mediaItem.count({ where: { type: "BOOK" } }),
      prisma.review.count(),
      prisma.mediaItem.findMany({
        where: { type: "MOVIE" },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          title: true,
          posterUrl: true,
          expertAgeRec: true,
          tmdbId: true,
        },
      }),
      prisma.mediaItem.findMany({
        where: { type: "GAME" },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          title: true,
          posterUrl: true,
          expertAgeRec: true,
          igdbId: true,
        },
      }),
      prisma.mediaItem.count({
        where: { type: "MOVIE", expertAgeRec: { not: null } },
      }),
      prisma.mediaItem.count({
        where: { type: "GAME", expertAgeRec: { not: null } },
      }),
    ])

    return NextResponse.json({
      counts: {
        movies: movieCount,
        games: gameCount,
        tv: tvCount,
        books: bookCount,
        reviews: reviewCount,
        total: movieCount + gameCount + tvCount + bookCount,
      },
      coverage: {
        moviesWithAgeRec,
        gamesWithAgeRec,
        moviesPercent: movieCount > 0 ? Math.round((moviesWithAgeRec / movieCount) * 100) : 0,
        gamesPercent: gameCount > 0 ? Math.round((gamesWithAgeRec / gameCount) * 100) : 0,
      },
      recent: {
        movies: recentMovies,
        games: recentGames,
      },
    })
  } catch (error) {
    console.error("Stats error:", error)
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    )
  }
}
