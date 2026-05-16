import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"

const LABELS: Record<string, string> = {
  PARENTHOOD: "Parentalite",
  FILM_TV: "Cinema & series",
  GAMES: "Jeux video",
  READING: "Lectures",
  TECH: "Tech & IA",
}

const SUBLABELS: Record<string, string> = {
  PARENTHOOD: "vie de famille",
  FILM_TV: "ecrans & recits",
  GAMES: "jeu & culture",
  READING: "livres jeunesse",
  TECH: "numerique familial",
}

const PALETTES = [
  { bg: "#F7F1E7", bg2: "#E8DDC9", ink: "#1D1711", accent: "#D16A4A", soft: "#6E8F75" },
  { bg: "#F4EFE6", bg2: "#E4E9DC", ink: "#1B1B17", accent: "#3F7F8A", soft: "#C96F46" },
  { bg: "#F8F2EA", bg2: "#E8E0F0", ink: "#18151A", accent: "#8F5E7A", soft: "#6D8B5F" },
  { bg: "#F3EFE7", bg2: "#DDE8E6", ink: "#151B1B", accent: "#336E64", soft: "#D09054" },
  { bg: "#F7F0E4", bg2: "#E9E1CF", ink: "#1E1813", accent: "#B75D45", soft: "#4D7784" },
  { bg: "#F5F1EA", bg2: "#E3E8D8", ink: "#171914", accent: "#627C4B", soft: "#C45F59" },
  { bg: "#F6EFE8", bg2: "#DEDDEA", ink: "#17151D", accent: "#5B689F", soft: "#C7774F" },
  { bg: "#F8F3EA", bg2: "#E7D9D1", ink: "#1C1713", accent: "#A94F42", soft: "#5B8B7B" },
]

const MOTIFS = ["screen", "book", "console", "network", "research"]

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function motifFor(category: string, index: number): string {
  if (category === "FILM_TV") return index % 2 === 0 ? "screen" : "network"
  if (category === "GAMES") return index % 2 === 0 ? "console" : "screen"
  if (category === "READING") return index % 2 === 0 ? "book" : "research"
  if (category === "TECH") return index % 2 === 0 ? "network" : "research"
  if (category === "PARENTHOOD") return index % 2 === 0 ? "screen" : "book"
  return MOTIFS[index % MOTIFS.length]!
}

function Motif({
  type,
  palette,
  variant,
}: {
  type: string
  palette: (typeof PALETTES)[number]
  variant: number
}) {
  const line = `${palette.ink}33`
  const fill = `${palette.accent}1F`
  const soft = `${palette.soft}24`
  const offset = variant % 3

  if (type === "book") {
    return (
      <div style={{ display: "flex", gap: 18, transform: `rotate(${-5 + offset * 2}deg)` }}>
        <div style={{ width: 150, height: 210, borderRadius: 16, background: fill, border: `8px solid ${line}` }} />
        <div style={{ width: 150, height: 210, borderRadius: 16, background: soft, border: `8px solid ${line}` }} />
      </div>
    )
  }

  if (type === "console") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 280, height: 150, borderRadius: 46, background: fill, border: `8px solid ${line}` }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ width: 42, height: 42, borderRadius: 999, background: palette.accent }} />
          <div style={{ width: 42, height: 42, borderRadius: 999, background: palette.soft }} />
        </div>
      </div>
    )
  }

  if (type === "network") {
    return (
      <div style={{ position: "relative", width: 360, height: 250, display: "flex" }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: [24, 150, 275, 88, 224][i],
              top: [30, 92, 26, 185, 172][i],
              width: i === 1 ? 76 : 54,
              height: i === 1 ? 76 : 54,
              borderRadius: 999,
              background: i % 2 ? fill : soft,
              border: `7px solid ${line}`,
            }}
          />
        ))}
        <div style={{ position: "absolute", left: 52, top: 68, width: 250, height: 7, background: line, transform: "rotate(11deg)" }} />
        <div style={{ position: "absolute", left: 112, top: 137, width: 170, height: 7, background: line, transform: "rotate(-26deg)" }} />
      </div>
    )
  }

  if (type === "research") {
    return (
      <div
        style={{
          width: 330,
          height: 230,
          borderRadius: 22,
          background: "#FFFFFF66",
          border: `8px solid ${line}`,
          padding: 32,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 230 - i * 28,
              height: 12,
              borderRadius: 999,
              background: i === 0 ? palette.accent : line,
              marginBottom: 24,
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div style={{ width: 360, height: 230, borderRadius: 34, background: fill, border: `9px solid ${line}`, padding: 22 }}>
      <div style={{ width: "100%", height: "100%", borderRadius: 20, background: "#FFFFFF66", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 150, height: 84, borderRadius: 999, background: soft, border: `7px solid ${line}` }} />
      </div>
    </div>
  )
}

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const cat = params.get("cat") ?? ""
  const seed = params.get("seed") ?? cat
  const hash = hashSeed(`${cat}:${seed}`)
  const palette = PALETTES[hash % PALETTES.length]!
  const motif = motifFor(cat, Math.floor(hash / PALETTES.length))
  const label = LABELS[cat] ?? "Actualites"
  const sublabel = SUBLABELS[cat] ?? "selection famille"
  const ringShift = hash % 160

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: `linear-gradient(145deg, ${palette.bg} 0%, ${palette.bg2} 100%)`,
          color: palette.ink,
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 760,
            height: 760,
            right: -260 + ringShift,
            top: -300,
            borderRadius: 9999,
            border: `58px solid ${palette.accent}1A`,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 430,
            height: 430,
            left: -160,
            bottom: -210 + (hash % 80),
            borderRadius: 9999,
            background: `${palette.soft}1D`,
          }}
        />
        <div style={{ width: "50%", height: "100%", padding: "70px 0 62px 78px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 24, letterSpacing: 6, textTransform: "uppercase", color: `${palette.ink}73` }}>
            Totem Avise
          </div>
          <div style={{ marginTop: 76, fontSize: 84, fontWeight: 750, lineHeight: 0.98, letterSpacing: -1.2 }}>
            {label}
          </div>
          <div style={{ marginTop: 22, width: 92, height: 5, borderRadius: 999, background: palette.accent }} />
          <div style={{ marginTop: 28, fontSize: 31, color: `${palette.ink}A8` }}>{sublabel}</div>
          <div style={{ marginTop: "auto", fontSize: 22, color: `${palette.ink}66` }}>visuel editorial</div>
        </div>
        <div style={{ width: "50%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", paddingRight: 70 }}>
          <Motif type={motif} palette={palette} variant={hash} />
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
