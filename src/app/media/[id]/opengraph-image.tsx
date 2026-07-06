import { ImageResponse } from "next/og"
import { parseMediaRouteId } from "@/lib/media-route"
import { getDashboardMedia } from "@/lib/media-dashboard-data"

// Branded 1200×630 social card — replaces the raw 2:3 portrait poster that
// letterboxed on summary_large_image. Warm site palette, poster inset on the
// left, verdict ("Dès X ans") on the right. Generated on demand, cached hard.
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Totem Avisé — avis famille par âge"

const C = {
  bg: "#F5F1E9",
  bg2: "#EDE4D5",
  ink: "#2A251F",
  ink2: "#6B6154",
  accent: "#C0512E",
  card: "#FFFFFF",
  line: "#E4DAC8",
}

const TYPE_LABEL: Record<string, string> = {
  MOVIE: "Film",
  TV: "Série",
  GAME: "Jeu vidéo",
  BOOK: "Livre",
  APP: "Application",
  MANGA: "Manga",
}

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { id: rawId } = parseMediaRouteId(id)
  const media = await getDashboardMedia(rawId).catch(() => null)

  const title = media?.title ?? "Totem Avisé"
  const typeLabel = media ? (TYPE_LABEL[media.type] ?? "") : ""
  const hasAge = !!media && media.expertAgeRec != null && media.expertAgeRec > 0
  const verdict = hasAge ? `Dès ${media!.expertAgeRec} ans` : "Repères famille"
  const poster =
    media?.posterUrl && media.posterUrl !== "/placeholder-poster.jpg" ? media.posterUrl : null
  const titleSize = title.length > 40 ? 52 : title.length > 24 ? 64 : 76

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: `linear-gradient(140deg, ${C.bg} 0%, ${C.bg2} 100%)`,
          color: C.ink,
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* decorative warm ring */}
        <div
          style={{
            position: "absolute",
            width: 720,
            height: 720,
            right: -260,
            top: -280,
            borderRadius: 9999,
            border: `56px solid ${C.accent}18`,
          }}
        />

        {/* poster inset */}
        {poster && (
          <div
            style={{
              display: "flex",
              padding: "70px 0 70px 76px",
              alignItems: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster}
              width={326}
              height={489}
              style={{
                width: 326,
                height: 489,
                objectFit: "cover",
                borderRadius: 18,
                border: `1px solid ${C.line}`,
                boxShadow: "0 24px 48px rgba(42,37,31,0.28)",
              }}
              alt=""
            />
          </div>
        )}

        {/* text column */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: poster ? "0 76px 0 56px" : "0 76px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 26,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: `${C.ink}8F`,
              fontWeight: 700,
            }}
          >
            Totem Avisé{typeLabel ? ` · ${typeLabel}` : ""}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 26,
              fontSize: titleSize,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -1,
            }}
          >
            {title}
          </div>

          <div style={{ display: "flex", marginTop: 28, width: 110, height: 7, borderRadius: 999, background: C.accent }} />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 30,
            }}
          >
            <div
              style={{
                display: "flex",
                padding: "12px 26px",
                borderRadius: 999,
                background: C.accent,
                color: "#FFFFFF",
                fontSize: 40,
                fontWeight: 800,
              }}
            >
              {verdict}
            </div>
          </div>

          <div style={{ display: "flex", marginTop: "auto", fontSize: 24, color: `${C.ink}82`, fontWeight: 600 }}>
            L&apos;avis famille, par âge
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        "Cache-Control": "public, immutable, no-transform, max-age=31536000",
      },
    },
  )
}
