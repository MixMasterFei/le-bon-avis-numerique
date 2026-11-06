/**
 * Artwork of the branded blog card (1200×630), rendered by next/og in
 * /api/blog/card/[slug]. Default next/og font only (Geist) — no font files to
 * trace into the serverless bundle, same choice as /api/news/fallback-card.
 * Satori rules: every element with several children is `display: flex`.
 */
import { blogCategoryLabel } from "@/sanity/categories"

const INK = "#1E1A15"
const INK_SOFT = "rgba(30, 26, 21, 0.66)"
// Solid (not translucent) so overlapping strokes don't darken where they cross.
const LINE = "#ABA39B"
const BRAND_ACCENT = "#D16A4A"
const BASE = "#F5F1E9"

/** French spacing: keep ? ! : ; » glued to the previous word (no orphan « ? » on a new line). */
export function frenchNoBreak(text: string): string {
  return text.replace(/\s+([?!:;»])/g, " $1").replace(/«\s+/g, "« ")
}

type MotifKind = "clock" | "screen" | "gamepad" | "family" | "checklist" | "news"

const CATEGORY_STYLE: Record<string, { accent: string; wash: string; motif: MotifKind }> = {
  "temps-ecran": { accent: "#C25A3C", wash: "#F2DCD0", motif: "clock" },
  "films-series": { accent: "#A94F42", wash: "#EEDFD3", motif: "screen" },
  "jeux-video": { accent: "#5B689F", wash: "#E1E2EE", motif: "gamepad" },
  "parentalite-numerique": { accent: "#4F7D50", wash: "#DFE8DA", motif: "family" },
  "guides-pratiques": { accent: "#336E64", wash: "#DAE7E3", motif: "checklist" },
  actualites: { accent: "#8F5E7A", wash: "#EBDFE7", motif: "news" },
}
const DEFAULT_STYLE = { accent: BRAND_ACCENT, wash: "#EFE2D6", motif: "checklist" as MotifKind }

function Motif({ kind, accent }: { kind: MotifKind; accent: string }) {
  const line = { stroke: LINE, strokeWidth: 14, strokeLinecap: "round" as const }
  const shape = { fill: "#FBF8F3", stroke: LINE, strokeWidth: 14 }
  const svg = (children: React.ReactNode) => (
    <svg width="300" height="280" viewBox="0 0 300 280">
      {children}
    </svg>
  )
  switch (kind) {
    case "clock":
      return svg(
        <>
          <circle cx="150" cy="140" r="112" {...shape} />
          <line x1="150" y1="140" x2="150" y2="78" {...line} stroke={accent} />
          <line x1="150" y1="140" x2="196" y2="166" {...line} />
          <circle cx="150" cy="140" r="11" fill={accent} />
        </>,
      )
    case "screen":
      return svg(
        <>
          <rect x="22" y="30" width="256" height="168" rx="24" {...shape} />
          <path d="M128 78 L188 114 L128 150 Z" fill={accent} />
          <line x1="150" y1="204" x2="150" y2="240" {...line} />
          <line x1="104" y1="244" x2="196" y2="244" {...line} />
        </>,
      )
    case "gamepad":
      return svg(
        <>
          <rect x="18" y="72" width="264" height="140" rx="70" {...shape} />
          <line x1="86" y1="116" x2="86" y2="168" {...line} />
          <line x1="60" y1="142" x2="112" y2="142" {...line} />
          <circle cx="202" cy="126" r="14" fill={accent} />
          <circle cx="232" cy="158" r="14" fill={accent} />
        </>,
      )
    case "family":
      return svg(
        <>
          <circle cx="78" cy="88" r="32" {...shape} strokeWidth={12} />
          <rect x="30" y="136" width="96" height="104" rx="40" {...shape} strokeWidth={12} />
          <circle cx="222" cy="88" r="32" {...shape} strokeWidth={12} />
          <rect x="174" y="136" width="96" height="104" rx="40" {...shape} strokeWidth={12} />
          <circle cx="150" cy="150" r="24" fill={accent} fillOpacity={0.25} stroke={accent} strokeWidth={12} />
          <rect x="116" y="188" width="68" height="62" rx="28" fill={accent} fillOpacity={0.25} stroke={accent} strokeWidth={12} />
        </>,
      )
    case "news":
      return svg(
        <>
          <rect x="30" y="28" width="240" height="224" rx="22" {...shape} />
          <rect x="64" y="64" width="172" height="46" rx="10" fill={accent} />
          <line x1="64" y1="148" x2="236" y2="148" {...line} strokeWidth={12} />
          <line x1="64" y1="184" x2="236" y2="184" {...line} strokeWidth={12} />
          <line x1="64" y1="220" x2="176" y2="220" {...line} strokeWidth={12} />
        </>,
      )
    case "checklist":
    default:
      return svg(
        <>
          <rect x="44" y="20" width="212" height="240" rx="24" {...shape} />
          {[78, 140, 202].map((y) => (
            <path
              key={`c${y}`}
              d={`M80 ${y} l14 14 l26 -28`}
              fill="none"
              stroke={accent}
              strokeWidth={12}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {[80, 142, 204].map((y) => (
            <line key={`l${y}`} x1="140" y1={y} x2="220" y2={y} {...line} strokeWidth={12} />
          ))}
        </>,
      )
  }
}

/**
 * `title` null = the post isn't public (or couldn't be read): the card then
 * carries the category label only.
 */
export function BlogCardArt({ title, category }: { title: string | null; category: string | null }) {
  const style = (category && CATEGORY_STYLE[category]) || DEFAULT_STYLE
  const label = blogCategoryLabel(category)
  const headline = frenchNoBreak(title ?? label)
  const fontSize = headline.length <= 38 ? 74 : headline.length <= 62 ? 64 : headline.length <= 88 ? 54 : 46

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: BASE,
        color: INK,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 780,
          height: 780,
          right: -250,
          top: -150,
          borderRadius: 9999,
          background: style.wash,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 560,
          height: 560,
          right: -140,
          top: -40,
          borderRadius: 9999,
          border: `44px solid ${style.accent}`,
          opacity: 0.1,
          display: "flex",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", width: 770, height: "100%", padding: "62px 0 54px 72px" }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 26, letterSpacing: 5, textTransform: "uppercase" }}>
          <span>Totem</span>
          <span style={{ color: BRAND_ACCENT, marginLeft: 12 }}>Avisé</span>
        </div>

        <div style={{ display: "flex", marginTop: 54 }}>
          <div
            style={{
              display: "flex",
              padding: "8px 20px",
              borderRadius: 999,
              background: "#FFFFFF",
              border: `2px solid ${style.accent}`,
              color: style.accent,
              fontSize: 24,
              letterSpacing: 1,
            }}
          >
            {title ? label : "Le blog"}
          </div>
        </div>

        <div style={{ display: "flex", marginTop: 26, fontSize, lineHeight: 1.08 }}>{headline}</div>

        <div style={{ display: "flex", alignItems: "center", marginTop: "auto", fontSize: 24, color: INK_SOFT }}>
          <div style={{ display: "flex", width: 56, height: 6, borderRadius: 999, background: style.accent, marginRight: 16 }} />
          totemavise.com · Conseils pour les familles
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 86,
          top: 176,
          width: 300,
          height: 280,
          display: "flex",
        }}
      >
        <Motif kind={style.motif} accent={style.accent} />
      </div>
    </div>
  )
}
