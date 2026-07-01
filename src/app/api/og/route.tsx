import { ImageResponse } from "next/og"

// Default social-share card for Totem Avisé — 1200×630 (the ratio Facebook,
// Slack, Discord, X and iMessage crop OG images to). Replaces the old square
// 620×606 /icon.png that every audit flagged as non-standard. Rendered on the
// fly with next/og (same tooling as /api/news/fallback-card) so there's a
// single branded source instead of a static asset to maintain. Cached hard —
// the card is deterministic.

export const runtime = "nodejs"

// Warm site palette (mirrors the news fallback card).
const BG = "#F7F1E7"
const BG2 = "#E8DDC9"
const INK = "#1D1711"
const ACCENT = "#D16A4A"
const SOFT = "#6E8F75"

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: `linear-gradient(145deg, ${BG} 0%, ${BG2} 100%)`,
          color: INK,
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
          padding: "0 84px",
        }}
      >
        {/* decorative rings, echoing the fallback-card language */}
        <div
          style={{
            position: "absolute",
            width: 780,
            height: 780,
            right: -280,
            top: -300,
            borderRadius: 9999,
            border: `60px solid ${ACCENT}1F`,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 460,
            height: 460,
            left: -180,
            bottom: -220,
            borderRadius: 9999,
            background: `${SOFT}1D`,
          }}
        />

        {/* family motif, top-right */}
        <div
          style={{
            position: "absolute",
            right: 96,
            top: 130,
            display: "flex",
            alignItems: "flex-end",
            gap: 26,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: [84, 112, 76][i],
                  height: [84, 112, 76][i],
                  borderRadius: 999,
                  background: i === 1 ? `${ACCENT}26` : `${SOFT}26`,
                  border: `9px solid ${INK}30`,
                }}
              />
              <div
                style={{
                  width: [126, 160, 112][i],
                  height: [100, 128, 90][i],
                  borderRadius: "44px 44px 26px 26px",
                  background: i === 1 ? `${SOFT}22` : `${ACCENT}20`,
                  border: `9px solid ${INK}30`,
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 30,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: `${INK}8F`,
              fontWeight: 700,
            }}
          >
            Totem Avisé
          </div>
          <div style={{ marginTop: 34, fontSize: 84, fontWeight: 850, lineHeight: 1.02, maxWidth: 760 }}>
            Le bon écran pour chaque enfant.
          </div>
          <div style={{ marginTop: 26, width: 128, height: 8, borderRadius: 999, background: ACCENT }} />
          <div style={{ marginTop: 30, fontSize: 36, lineHeight: 1.2, color: `${INK}CC`, fontWeight: 650, maxWidth: 720 }}>
            Films, séries, jeux et livres analysés et notés par âge pour votre famille.
          </div>
          <div style={{ marginTop: 46, fontSize: 26, color: `${INK}82`, fontWeight: 650 }}>
            totemavise.com
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, immutable, no-transform, max-age=31536000",
      },
    },
  )
}
