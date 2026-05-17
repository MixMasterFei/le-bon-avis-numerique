import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"

const LABELS: Record<string, string> = {
  PARENTHOOD: "Vie de famille",
  FILM_TV: "Cinema & series",
  GAMES: "Jeux video",
  READING: "Lectures",
  TECH: "Tech & IA",
}

const SUBLABELS: Record<string, string> = {
  PARENTHOOD: "parents, enfants, quotidien",
  FILM_TV: "ecrans & recits",
  GAMES: "jeu & culture",
  READING: "livres jeunesse",
  TECH: "numerique en famille",
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

const CATEGORY_MOTIFS: Record<string, string[]> = {
  PARENTHOOD: ["family", "calendar", "book", "screen", "network"],
  FILM_TV: ["screen", "network", "family", "book"],
  GAMES: ["console", "screen", "network", "family"],
  READING: ["book", "research", "family", "calendar"],
  TECH: ["phone", "network", "research", "screen", "family"],
}

const DEFAULT_MOTIFS = ["screen", "book", "console", "network", "research", "family", "phone"]

const BRAND_CUES = [
  { pattern: /\b(meta|facebook|instagram|horizon worlds?)\b/i, label: "Meta", accent: "#0866FF", motif: "phone" },
  { pattern: /\b(google|android|youtube|chromebook)\b/i, label: "Google", accent: "#1A73E8", motif: "phone" },
  { pattern: /\b(openai|chatgpt)\b/i, label: "OpenAI", accent: "#0F766E", motif: "research" },
  { pattern: /\b(netflix)\b/i, label: "Netflix", accent: "#D81F26", motif: "screen" },
  { pattern: /\b(disney\+?|disney plus)\b/i, label: "Disney+", accent: "#355CFF", motif: "screen" },
  { pattern: /\b(prime video|amazon prime)\b/i, label: "Prime Video", accent: "#00A8E1", motif: "screen" },
  { pattern: /\b(tiktok)\b/i, label: "TikTok", accent: "#111111", motif: "phone" },
  { pattern: /\b(snapchat)\b/i, label: "Snapchat", accent: "#F5D90A", motif: "phone" },
  { pattern: /\b(nintendo|switch)\b/i, label: "Nintendo", accent: "#E60012", motif: "console" },
  { pattern: /\b(roblox)\b/i, label: "Roblox", accent: "#335FFF", motif: "console" },
  { pattern: /\b(minecraft)\b/i, label: "Minecraft", accent: "#4A7D35", motif: "console" },
  { pattern: /\b(arxiv|universit|recherche|etude|study|research)\b/i, label: "Recherche", accent: "#B31B1B", motif: "research" },
]

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function normalizeSeed(seed: string): string {
  return seed
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function brandCueFor(seed: string) {
  const normalized = normalizeSeed(seed)
  return BRAND_CUES.find((cue) => cue.pattern.test(normalized)) ?? null
}

function motifFor(category: string, index: number, brandMotif?: string): string {
  if (brandMotif) return brandMotif
  const choices = CATEGORY_MOTIFS[category] ?? DEFAULT_MOTIFS
  return choices[index % choices.length]!
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

  if (type === "family") {
    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 24, transform: `rotate(${-3 + offset * 2}deg)` }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: [78, 104, 70][i],
                height: [78, 104, 70][i],
                borderRadius: 999,
                background: i === 1 ? fill : soft,
                border: `8px solid ${line}`,
              }}
            />
            <div
              style={{
                width: [118, 150, 105][i],
                height: [92, 118, 82][i],
                borderRadius: "42px 42px 24px 24px",
                background: i === 1 ? soft : fill,
                border: `8px solid ${line}`,
              }}
            />
          </div>
        ))}
      </div>
    )
  }

  if (type === "calendar") {
    return (
      <div
        style={{
          width: 340,
          height: 250,
          borderRadius: 28,
          background: "#FFFFFF88",
          border: `8px solid ${line}`,
          padding: 30,
          display: "flex",
          flexDirection: "column",
          gap: 24,
          transform: `rotate(${2 - offset}deg)`,
        }}
      >
        <div style={{ width: "100%", height: 18, borderRadius: 999, background: palette.accent }} />
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 58,
                height: 42,
                borderRadius: 14,
                background: i === offset + 3 ? fill : soft,
                border: `5px solid ${line}`,
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (type === "phone") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 24, transform: `rotate(${-7 + offset * 3}deg)` }}>
        <div
          style={{
            width: 172,
            height: 292,
            borderRadius: 36,
            background: "#FFFFFF88",
            border: `10px solid ${line}`,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div style={{ width: "45%", height: 9, borderRadius: 999, background: line, alignSelf: "center" }} />
          <div style={{ flex: 1, borderRadius: 24, background: fill, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 74, height: 74, borderRadius: 999, background: soft, border: `7px solid ${line}` }} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 118 - i * 14, height: 18, borderRadius: 999, background: i === 0 ? palette.accent : line }} />
          ))}
        </div>
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
    <div style={{ width: 360, height: 230, borderRadius: 34, background: fill, border: `9px solid ${line}`, padding: 22, display: "flex" }}>
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
  const brand = brandCueFor(seed)
  const accent = brand?.accent ?? palette.accent
  const motif = motifFor(cat, Math.floor(hash / PALETTES.length), brand?.motif)
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
            border: `58px solid ${accent}1F`,
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
        <div style={{ width: "52%", height: "100%", padding: "62px 0 58px 76px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ fontSize: 26, letterSpacing: 3, textTransform: "uppercase", color: `${palette.ink}8F`, fontWeight: 700 }}>
            Totem Avise
            </div>
            {brand ? (
              <div
                style={{
                  height: 42,
                  padding: "0 18px",
                  borderRadius: 999,
                  background: `${accent}22`,
                  color: palette.ink,
                  border: `3px solid ${accent}55`,
                  display: "flex",
                  alignItems: "center",
                  fontSize: 24,
                  fontWeight: 800,
                }}
              >
                {brand.label}
              </div>
            ) : null}
          </div>
          <div style={{ marginTop: 78, fontSize: cat === "PARENTHOOD" ? 82 : 88, fontWeight: 850, lineHeight: 0.98, letterSpacing: 0 }}>
            {label}
          </div>
          <div style={{ marginTop: 24, width: 112, height: 7, borderRadius: 999, background: accent }} />
          <div style={{ marginTop: 30, fontSize: 34, lineHeight: 1.15, color: `${palette.ink}CC`, fontWeight: 650 }}>{sublabel}</div>
          <div style={{ marginTop: "auto", fontSize: 23, color: `${palette.ink}82`, fontWeight: 650 }}>visuel Totem</div>
        </div>
        <div style={{ width: "48%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", paddingRight: 62 }}>
          <Motif type={motif} palette={{ ...palette, accent }} variant={hash} />
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
