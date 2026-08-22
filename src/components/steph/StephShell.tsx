import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Gauge, BookOpen, Network } from "lucide-react"
import { fraunces } from "@/components/home-v2/apercuFont"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

/**
 * Coquille commune de l'espace /steph.
 *
 * Volontairement distincte de `AdminShell` : /admin est un poste de pilotage
 * technique (files d'attente, boutons de relance), /steph est un espace de
 * lecture. Même palette, même typographie, mais plus d'air, des titres plus
 * gros et zéro jargon. Composant serveur : aucune interactivité ici.
 */

export const stephPalette = APERCU_PALETTE
export const stephSerif = fraunces

export type StephSection = "tableau" | "projet" | "carte"

const NAV: Array<{ id: StephSection; href: string; label: string; icon: LucideIcon }> = [
  { id: "tableau", href: "/steph", label: "Tableau de bord", icon: Gauge },
  { id: "projet", href: "/steph/projet", label: "Le projet", icon: BookOpen },
  { id: "carte", href: "/steph/carte", label: "La carte", icon: Network },
]

export function StephShell({
  active,
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}: {
  active: StephSection
  eyebrow: string
  title: React.ReactNode
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const p = stephPalette
  return (
    <div
      className={`min-h-screen ${fraunces.variable}`}
      style={{ background: p.bg, color: p.ink }}
    >
      <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-8 md:py-12 flex flex-col gap-8">
        <header className="flex flex-col gap-5">
          <nav className="flex flex-wrap gap-2" aria-label="Navigation de l'espace Steph">
            {NAV.map(({ id, href, label, icon: Icon }) => {
              const isActive = id === active
              return (
                <Link
                  key={id}
                  href={href}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{
                    background: isActive ? p.ink : p.card,
                    color: isActive ? p.bg : p.ink,
                    border: `1px solid ${isActive ? p.ink : p.line}`,
                  }}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              )
            })}
          </nav>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: p.accent }}
              >
                {eyebrow}
              </span>
              <h1
                className={`${fraunces.className} text-3xl md:text-5xl font-medium leading-[1.05] mt-1.5`}
                style={{ color: p.ink, letterSpacing: "-0.02em" }}
              >
                {title}
              </h1>
              {subtitle && (
                <p className="text-base mt-3 max-w-2xl leading-relaxed" style={{ color: p.ink2 }}>
                  {subtitle}
                </p>
              )}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
          </div>
        </header>

        {children}

        <footer
          className="pt-6 mt-2 text-xs flex flex-wrap gap-x-4 gap-y-1"
          style={{ borderTop: `1px solid ${p.line}`, color: p.ink2 }}
        >
          <span>Espace de pilotage — réservé à l&apos;équipe.</span>
          <Link href="/" className="underline hover:opacity-70">
            Voir le site public
          </Link>
          <Link href="/admin" className="underline hover:opacity-70">
            Interface technique (Xavier)
          </Link>
        </footer>
      </div>
    </div>
  )
}

/** Carte de base : fond blanc, coins doux, filet discret. */
export function StephCard({
  children,
  className = "",
  accent,
}: {
  children: React.ReactNode
  className?: string
  /** Filet coloré à gauche, pour rattacher la carte à une famille. */
  accent?: string
}) {
  const p = stephPalette
  return (
    <div
      className={`rounded-2xl p-5 md:p-6 ${className}`}
      style={{
        background: p.card,
        border: `1px solid ${p.line}`,
        borderLeft: accent ? `4px solid ${accent}` : undefined,
      }}
    >
      {children}
    </div>
  )
}

/** Titre de section : un numéro, un intitulé, une phrase d'explication. */
export function StephSectionTitle({
  step,
  title,
  hint,
}: {
  step: string
  title: string
  hint?: string
}) {
  const p = stephPalette
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2.5">
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{ background: p.accent, color: "#fff" }}
        >
          {step}
        </span>
        <h2
          className={`${fraunces.className} text-xl md:text-2xl font-medium`}
          style={{ color: p.ink, letterSpacing: "-0.01em" }}
        >
          {title}
        </h2>
      </div>
      {hint && (
        <p className="text-sm ml-[38px] max-w-3xl leading-relaxed" style={{ color: p.ink2 }}>
          {hint}
        </p>
      )}
    </div>
  )
}
