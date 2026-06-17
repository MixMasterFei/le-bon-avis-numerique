import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const maxDuration = 60

// Reports whether the transactional-email env is wired correctly, WITHOUT ever
// returning the secret value. Route is admin-gated by middleware (/api/admin).
// Note: actual sender-domain verification lives in Resend (Domains → Verified)
// and can't be detected from here — we only flag the obvious misconfigurations.
function checkEmailConfig() {
  const hasResendKey = !!process.env.RESEND_API_KEY
  const fromEmail = process.env.FROM_EMAIL || "noreply@totemavise.com"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""

  const fromDomain = fromEmail.includes("@") ? fromEmail.split("@")[1] : null
  // resend.dev is Resend's sandbox sender — it only delivers to the account owner.
  const usingSandboxDomain = fromDomain === "resend.dev"
  const appUrlIsLocalhost =
    !appUrl || appUrl.includes("localhost") || appUrl.includes("127.0.0.1")

  const notes = [
    !hasResendKey
      ? "RESEND_API_KEY manquant — aucun email transactionnel ne partira."
      : null,
    appUrlIsLocalhost
      ? "NEXT_PUBLIC_APP_URL absent ou localhost — les liens de vérification/réinitialisation seront cassés."
      : null,
    usingSandboxDomain
      ? "FROM_EMAIL utilise resend.dev — Resend ne délivrera qu'à l'adresse du compte."
      : null,
    "Vérifiez que le domaine d'envoi est 'Verified' dans Resend (non détectable ici).",
  ].filter(Boolean)

  return {
    ok: hasResendKey && !appUrlIsLocalhost && !usingSandboxDomain,
    resendApiKey: { set: hasResendKey },
    fromEmail: {
      value: fromEmail,
      domain: fromDomain,
      usesDefault: !process.env.FROM_EMAIL,
      usingSandboxDomain,
    },
    appUrl: {
      // NEXT_PUBLIC_* vars are non-secret by design, safe to echo back.
      value: appUrl || null,
      set: !!appUrl,
      isLocalhost: appUrlIsLocalhost,
    },
    notes,
  }
}

export async function GET() {
  // Computed up front so email diagnostics still return even if the DB query fails.
  const email = checkEmailConfig()

  try {
    const movieTvFilter = { type: { in: ["MOVIE", "TV"] as ("MOVIE" | "TV")[] } }

    const [
      total,
      withAgeRec,
      withScreenshots,
      withMetrics,
      withStreaming,
      avgQuality,
    ] = await Promise.all([
      prisma.mediaItem.count({ where: movieTvFilter }),
      prisma.mediaItem.count({
        where: { ...movieTvFilter, expertAgeRec: { not: null } },
      }),
      prisma.mediaItem.count({
        where: { ...movieTvFilter, screenshots: { some: {} } },
      }),
      prisma.mediaItem.count({
        where: { ...movieTvFilter, contentMetrics: { isNot: null } },
      }),
      prisma.mediaItem.count({
        where: { ...movieTvFilter, streamingAvailability: { some: {} } },
      }),
      prisma.mediaItem.aggregate({
        _avg: { dataQualityScore: true },
        where: movieTvFilter,
      }),
    ])

    const pct = (count: number) =>
      total > 0 ? Math.round((count / total) * 100) : 0

    return NextResponse.json({
      total,
      ratings: { count: withAgeRec, pct: pct(withAgeRec) },
      screenshots: { count: withScreenshots, pct: pct(withScreenshots) },
      enriched: { count: withMetrics, pct: pct(withMetrics) },
      streaming: { count: withStreaming, pct: pct(withStreaming) },
      quality: { avg: Math.round(avgQuality._avg.dataQualityScore || 0) },
      email,
    })
  } catch (error) {
    console.error("Health check error:", error)
    return NextResponse.json(
      { error: "Failed to fetch health data", email },
      { status: 500 }
    )
  }
}
