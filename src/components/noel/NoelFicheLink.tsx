import Link from "next/link"
import { ArrowRight, TreePine } from "lucide-react"
import { isChristmasSeason } from "@/lib/seasonal"
import { noelFicheLink } from "@/lib/noel/fiche-link"
import { isNoelGiftGame } from "@/lib/noel/gift-membership"

// In-season link card on a fiche, towards the /noel page that fits it (rules
// in @/lib/noel/fiche-link). Server component: the link is in the crawled
// HTML. Placed low on the fiche (after the similar titles), so it never
// competes with the hero for LCP; the callers wrap it in <Suspense> so the
// one cached lookup a game fiche needs never holds the page back.

const PALETTES = {
  classic: {
    card: "var(--color-warm-card)",
    line: "var(--color-warm-line)",
    ink: "var(--color-warm-ink)",
    ink2: "var(--color-warm-ink2)",
    accent: "var(--color-warm-accent)",
  },
  v3: {
    card: "var(--f-card)",
    line: "var(--f-border)",
    ink: "var(--f-ink)",
    ink2: "var(--f-muted)",
    accent: "var(--f-accent)",
  },
} as const

export async function NoelFicheLink({
  mediaId,
  type,
  title,
  genres,
  topics,
  variant = "classic",
  className,
}: {
  mediaId: string
  type: string
  title: string
  genres: string[]
  topics: string[]
  variant?: keyof typeof PALETTES
  className?: string
}) {
  // Checked first: out of season, a game fiche makes no lookup at all.
  if (!isChristmasSeason()) return null
  const isGiftGame = type === "GAME" ? await isNoelGiftGame(mediaId) : false
  const link = noelFicheLink({ type, title, genres, topics }, { month0: new Date().getMonth(), isGiftGame })
  if (!link) return null

  const c = PALETTES[variant]
  return (
    <Link
      href={link.href}
      data-testid="noel-fiche-link"
      className={`group flex items-start gap-3 rounded-2xl p-4 sm:p-5 transition-transform duration-200 hover:-translate-y-0.5 ${className ?? ""}`}
      style={{ background: c.card, border: `1px solid ${c.line}` }}
    >
      <TreePine className="mt-0.5 h-5 w-5 flex-none" style={{ color: c.accent }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-serif text-lg font-medium" style={{ color: c.ink, letterSpacing: "-0.01em" }}>
          {link.title}
        </span>
        <span className="mt-1 block text-sm" style={{ color: c.ink2 }}>
          {link.blurb}
        </span>
      </span>
      <ArrowRight
        className="mt-1 h-4 w-4 flex-none transition-transform group-hover:translate-x-1"
        style={{ color: c.accent }}
        aria-hidden
      />
    </Link>
  )
}
