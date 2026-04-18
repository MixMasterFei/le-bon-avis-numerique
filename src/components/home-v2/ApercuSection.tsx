import { APERCU_PALETTE } from "./apercuTheme"

/**
 * Canonical art-direction section frame used across /apercu* pages.
 *
 * Gives every widget an eyebrow + Fraunces italic title, so the page
 * reads as one coherent editorial system rather than a stack of
 * stock shadcn cards. Prefer wrapping every reused live-site
 * component in this frame on the apercu pages.
 */

interface ApercuSectionProps {
  eyebrow: string
  title: string
  titleAccent?: string
  titleAccentColor?: "accent" | "accent2"
  as?: "section" | "div"
  tight?: boolean
  children: React.ReactNode
  serifClass: string
}

export function ApercuSection({
  eyebrow,
  title,
  titleAccent,
  titleAccentColor = "accent",
  as = "section",
  tight = false,
  children,
  serifClass,
}: ApercuSectionProps) {
  const p = APERCU_PALETTE
  const Tag = as as "section" | "div"
  const accentHex = titleAccentColor === "accent2" ? p.accent2 : p.accent

  return (
    <Tag className={tight ? "space-y-3" : "space-y-5"}>
      <div>
        <div
          className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide"
          style={{ color: p.accent }}
        >
          {eyebrow}
        </div>
        <h2
          className={`${serifClass} ${tight ? "text-lg md:text-xl" : "text-xl md:text-2xl"} font-medium m-0 leading-[1.1]`}
          style={{ letterSpacing: "-0.02em", color: p.ink }}
        >
          {title}
          {titleAccent && (
            <em className="italic" style={{ color: accentHex }}>
              {" "}
              {titleAccent}
            </em>
          )}
        </h2>
      </div>
      {children}
    </Tag>
  )
}
