import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"

/**
 * Branded "zen card" used as the news image when an article carries no
 * usable photo of its own — or only a thumbnail too small to render as a
 * 16:9 hero. Rendered on the fly as a 1200×630 PNG so it flows through
 * the same <Image> path (and the Supabase-mirror skip guard) as real
 * photos.
 *
 * Deliberately quiet: warm cream→sand gradient in the site palette, the
 * section name in large type, a thin terracotta rule, the wordmark. No
 * stock-photo busyness, no loud "IMAGE MISSING" energy — it should read
 * as an intentional editorial card, not a placeholder.
 *
 * Query: ?cat=PARENTHOOD|FILM_TV|GAMES|READING|TECH  (unknown → "Actualités")
 */

// Mirrors NEWS_CATEGORY_LABEL (src/components/home-v2/apercuNewsLabels.ts).
// Kept inline so this route has zero imports beyond next/og.
const LABELS: Record<string, string> = {
  PARENTHOOD: "Parentalité",
  FILM_TV: "Cinéma & séries",
  GAMES: "Jeux vidéo",
  READING: "Lectures",
  TECH: "Tech & IA",
}

export async function GET(req: NextRequest) {
  const cat = new URL(req.url).searchParams.get("cat") ?? ""
  const label = LABELS[cat] ?? "Actualités"

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(155deg, #F8F4EC 0%, #EFE9DC 55%, #E6DDCA 100%)",
          color: "#1E1A15",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Big translucent terracotta ring, drifting off the top-right. */}
        <div
          style={{
            position: "absolute",
            width: 820,
            height: 820,
            right: -300,
            top: -280,
            borderRadius: 9999,
            border: "64px solid rgba(209, 106, 74, 0.10)",
          }}
        />
        {/* Soft sage disc bottom-left for balance. */}
        <div
          style={{
            position: "absolute",
            width: 460,
            height: 460,
            left: -190,
            bottom: -220,
            borderRadius: 9999,
            background: "rgba(92, 138, 92, 0.09)",
          }}
        />
        <div
          style={{
            fontSize: 26,
            letterSpacing: 7,
            textTransform: "uppercase",
            color: "rgba(30, 26, 21, 0.42)",
            marginBottom: 16,
          }}
        >
          Totem Avisé
        </div>
        <div
          style={{
            fontSize: 92,
            fontWeight: 700,
            letterSpacing: -1,
            lineHeight: 1.05,
            textAlign: "center",
            maxWidth: 980,
            display: "flex",
          }}
        >
          {label}
        </div>
        <div style={{ marginTop: 28, width: 88, height: 4, borderRadius: 2, background: "#D16A4A" }} />
        <div style={{ position: "absolute", bottom: 42, fontSize: 22, color: "rgba(30, 26, 21, 0.38)" }}>
          totemavise.com
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      // Effectively static — the design only changes on deploy.
      headers: {
        "Cache-Control": "public, immutable, no-transform, max-age=31536000",
      },
    },
  )
}
