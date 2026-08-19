import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft, ExternalLink, ShieldAlert, CalendarCheck } from "lucide-react"
import { isAdmin } from "@/lib/auth"
import { gameGuideEnabled } from "@/lib/game-guide-flag"
import { guideFreshness } from "@/lib/game-guide-freshness"
import { getGameGuide, GAME_GUIDES } from "@/lib/game-guides"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

// Guides are hand-written and change only when a human edits them, so they can
// cache hard. The dated "état du jeu" block is what carries freshness, not ISR.
export const revalidate = 3600

const baseUrl = "https://totemavise.com"

export async function generateStaticParams() {
  return GAME_GUIDES.map((g) => ({ key: g.key }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>
}): Promise<Metadata> {
  const { key } = await params
  const guide = getGameGuide(key)
  if (!guide) return { title: "Guide parents" }
  return {
    title: `${guide.name} — Guide parents`,
    description: guide.tagline,
    alternates: { canonical: `${baseUrl}/jeux/guide/${guide.key}` },
    // Admin-only while the flag is off: keep it out of the index either way
    // until a human has read each guide end to end.
    robots: { index: false, follow: true },
  }
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })

export default async function GameGuidePage({
  params,
}: {
  params: Promise<{ key: string }>
}) {
  const { key } = await params
  const guide = getGameGuide(key)
  if (!guide) notFound()
  if (!gameGuideEnabled(await isAdmin())) notFound()

  const freshness = guideFreshness(guide)

  const p = APERCU_PALETTE

  return (
    <div className="min-h-screen" style={{ background: p.bg }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Link
          href="/jeux/quel-age"
          className="inline-flex items-center gap-1.5 text-sm mb-6 hover:opacity-70"
          style={{ color: p.ink2 }}
        >
          <ArrowLeft className="h-4 w-4" />
          Les jeux, à partir de quel âge
        </Link>

        <p
          className="text-[12px] font-bold uppercase tracking-[0.16em] mb-2"
          style={{ color: p.accent }}
        >
          Guide parents
        </p>
        <h1
          className="font-serif text-[clamp(28px,5vw,42px)] leading-[1.08] mb-3"
          style={{ color: p.ink }}
        >
          {guide.name}
        </h1>
        <p className="text-lg leading-snug mb-10" style={{ color: p.ink2 }}>
          {guide.tagline}
        </p>

        {/* ── Layer 1: understanding. No date — this ages slowly. ── */}
        <Section title="Ce que c'est vraiment" p={p}>
          <p className="leading-relaxed" style={{ color: p.ink }}>
            {guide.whatItIs}
          </p>
        </Section>

        <Section title="Ce qui se passe quand votre enfant y joue" p={p}>
          <Bullets items={guide.whatHappens} p={p} />
        </Section>

        <Section title="Pourquoi les enfants y tiennent" p={p}>
          <p className="leading-relaxed" style={{ color: p.ink }}>
            {guide.whyKidsLove}
          </p>
        </Section>

        <Section title="Les décisions qui vous reviennent" p={p}>
          <div className="space-y-4">
            {guide.decisions.map((d) => (
              <div
                key={d.question}
                className="rounded-xl p-4"
                style={{ background: p.card, border: `1px solid ${p.line}` }}
              >
                <p className="font-semibold mb-1" style={{ color: p.ink }}>
                  {d.question}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: p.ink2 }}>
                  {d.detail}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Layer 2: perishable. Dated and visually quarantined, so a stale
             step discredits this block rather than the whole page. ── */}
        <section className="mb-10">
          <div
            className="rounded-2xl p-5 sm:p-6"
            style={{ background: p.card, border: `1px solid ${p.accent}40` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <CalendarCheck className="h-4 w-4" style={{ color: p.accent }} />
              <h2 className="font-serif text-xl" style={{ color: p.ink }}>
                L&apos;état du jeu
              </h2>
            </div>
            <p className="text-xs mb-4" style={{ color: p.ink2 }}>
              Vérifié le {fmtDate(guide.stateOfPlay.verifiedOn)}. Ces réglages changent
              souvent et par paliers selon les pays — en cas de doute, la page officielle
              de l&apos;éditeur fait foi.
            </p>

            {/* The date alone is a passive stamp: a reader has no idea whether
                30 days is normal here. When the block passes its review window
                the page says so out loud, in the reader's own view — the
                monthly cron only reaches our inbox. Evaluated per request (the
                route is dynamic), so it cannot silently rot. */}
            {freshness.state !== "fresh" && (
              <p
                className="text-xs mb-4 rounded-lg px-3 py-2"
                style={{ background: `${p.accent}14`, color: p.ink }}
              >
                {freshness.ageDays === null
                  ? "La date de vérification de ce bloc est incorrecte : considérez-le comme non vérifié et fiez-vous aux liens officiels ci-dessous."
                  : `Ce bloc n'a pas été relu depuis ${freshness.ageDays} jours. Les réglages ont pu changer depuis : les liens officiels ci-dessous font foi.`}
              </p>
            )}

            <Bullets items={guide.stateOfPlay.facts} p={p} />

            <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${p.line}` }}>
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="h-4 w-4" style={{ color: p.ink2 }} />
                <p className="text-sm font-semibold" style={{ color: p.ink }}>
                  Ce que ces réglages ne font pas
                </p>
              </div>
              <Bullets items={guide.stateOfPlay.doesNotDo} p={p} muted />
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {guide.stateOfPlay.officialLinks.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1.5 text-sm hover:opacity-70"
                  style={{ color: p.accent }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {l.label}
                  <span style={{ color: p.ink2 }}>· {l.source}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <Section title="Jouer avec votre enfant" p={p}>
          <p className="leading-relaxed mb-3" style={{ color: p.ink }}>
            {guide.playTogether.intro}
          </p>
          <Bullets items={guide.playTogether.ideas} p={p} />
        </Section>

        {/* Advanced tier: for parents who game, just not this one. */}
        <details className="mb-10 group">
          <summary
            className="cursor-pointer font-serif text-xl list-none flex items-center gap-2"
            style={{ color: p.ink }}
          >
            <span
              className="inline-block transition-transform group-open:rotate-90"
              style={{ color: p.accent }}
            >
              ›
            </span>
            Pour aller plus loin
          </summary>
          <p className="text-sm mt-1 mb-3" style={{ color: p.ink2 }}>
            Si vous jouez déjà, mais pas à celui-ci.
          </p>
          <Bullets items={guide.advanced} p={p} />
        </details>

        <div
          className="rounded-2xl p-5 text-center"
          style={{ background: p.card, border: `1px solid ${p.line}` }}
        >
          <p className="text-sm mb-3" style={{ color: p.ink2 }}>
            L&apos;âge conseillé est une moyenne. Avec un compte famille gratuit, Totem
            Avisé calcule un score de compatibilité selon les sensibilités de chacun de
            vos enfants.
          </p>
          <Link
            href="/inscription"
            className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-bold"
            style={{ background: p.accent, color: p.bg }}
          >
            Créer un compte famille
          </Link>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  p,
  children,
}: {
  title: string
  p: typeof APERCU_PALETTE
  children: React.ReactNode
}) {
  return (
    <section className="mb-10">
      <h2 className="font-serif text-xl mb-3" style={{ color: p.ink }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Bullets({
  items,
  p,
  muted,
}: {
  items: string[]
  p: typeof APERCU_PALETTE
  muted?: boolean
}) {
  return (
    <ul className="space-y-2">
      {items.map((t) => (
        <li
          key={t}
          className="relative pl-4 text-sm leading-relaxed"
          style={{ color: muted ? p.ink2 : p.ink }}
        >
          <span
            className="absolute left-0 top-[0.6em] inline-block h-1 w-1 rounded-full"
            style={{ background: muted ? p.ink2 : p.accent }}
          />
          {t}
        </li>
      ))}
    </ul>
  )
}
