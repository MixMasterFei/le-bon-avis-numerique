import { ImageResponse } from "next/og"
import { loadBoard } from "@/lib/nl-search/boards"

// Branded 1200×630 social card for a shared board. A pasted link should look
// like something in a family group chat, not like a bare URL — that is most of
// what makes a board worth sharing at all.
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Un tableau Totem Avisé — sélection famille par âge"

const C = {
  bg: "#F4ECDE",
  bg2: "#EDE3D2",
  ink: "#23201C",
  ink2: "#4F463C",
  ink3: "#867A6B",
  terra: "#C5512C",
  pine: "#23493D",
  line: "#E2D6C2",
}

export default async function BoardOgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const board = await loadBoard(id).catch(() => null)

  const heading = board?.title ?? board?.query ?? "Une sélection famille"
  const headingSize = heading.length > 70 ? 46 : heading.length > 40 ? 56 : 68

  const chips: string[] = []
  if (board) {
    const { intent } = board
    chips.push(intent.mediaType === "GAME" ? "Jeux vidéo" : intent.mediaType === "TV" ? "Séries" : "Films")
    if (intent.maxAge !== null) chips.push(`jusqu'à ${intent.maxAge} ans`)
    for (const theme of intent.themes.slice(0, 2)) chips.push(theme)
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "68px 72px",
          background: `linear-gradient(135deg, ${C.bg} 0%, ${C.bg2} 100%)`,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: C.terra,
            }}
          >
            <div style={{ width: 12, height: 12, borderRadius: 999, background: C.terra }} />
            Un tableau Totem Avisé
          </div>

          <div
            style={{
              marginTop: 28,
              fontSize: headingSize,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: -1.5,
              color: C.ink,
              maxWidth: 980,
              display: "flex",
            }}
          >
            {heading}
          </div>

          {chips.length > 0 && (
            <div style={{ marginTop: 34, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {chips.map((chip) => (
                <div
                  key={chip}
                  style={{
                    display: "flex",
                    padding: "10px 22px",
                    borderRadius: 999,
                    border: `1px solid ${C.line}`,
                    background: "#FFFDF8",
                    fontSize: 24,
                    fontWeight: 600,
                    color: C.ink2,
                  }}
                >
                  {chip}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 26, color: C.ink3, maxWidth: 760 }}>
            Un âge conseillé argumenté pour chaque titre.
          </div>
          <div
            style={{
              display: "flex",
              padding: "14px 26px",
              borderRadius: 999,
              background: C.pine,
              color: "#FBF5EA",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            totemavise.com
          </div>
        </div>
      </div>
    ),
    size,
  )
}
