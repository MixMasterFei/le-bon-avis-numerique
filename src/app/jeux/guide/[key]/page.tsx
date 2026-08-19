import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft, ExternalLink, ShieldAlert, CalendarCheck, Gamepad2 } from "lucide-react"
import { isAdmin } from "@/lib/auth"
import { gameGuideEnabled } from "@/lib/game-guide-flag"
import { guideFreshness } from "@/lib/game-guide-freshness"
import { getGameGuide, GAME_GUIDES } from "@/lib/game-guides"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { SafeImage } from "@/components/ui/SafeImage"
import { DashboardScreenshots } from "@/components/media-v3/DashboardScreenshots"
import { getGuideGameMedia } from "@/lib/game-guide-media"
import { PlatformIcons } from "@/components/media/PlatformIcons"

// The editorial copy is hand-written and ages slowly, but the page also pulls
// live catalogue furniture (cover, stills, platforms, current age) and reads
// the session for the admin gate — so it renders per request. The dated
// "état du jeu" block is what carries freshness here, never ISR.
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

  // Real imagery for the guide. Null when the game is not in the catalogue
  // yet — the guide still renders, just without the visual furniture.
  const game = await getGuideGameMedia(guide.key)

  // Hero art, best-landscape-first. Games in this catalogue have no backdrop
  // (the import only stores covers + stills), and a portrait cover stretched
  // into a 16:9 band crops to mush — so a still beats the cover here. The
  // cover then floats over it, which is what gives the page its editorial
  // shape rather than a plain banner.
  const heroImage = game?.backdropUrl ?? game?.screenshots[0]?.url ?? game?.posterUrl ?? null
  // Don't repeat the still in the gallery if it is already the hero.
  const galleryShots =
    game && heroImage === game.screenshots[0]?.url
      ? game.screenshots.slice(1)
      : (game?.screenshots ?? [])

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

        {/* Editorial hero. A parent arriving here is already unsure; a wall of
            text reads as homework. The artwork gives the page a face and, more
            usefully, lets them recognise the thing their kid has been talking
            about. Falls back to the plain title when the catalogue has no
            image — never an empty frame. */}
        {heroImage ? (
          <div
            className="relative overflow-hidden rounded-2xl mb-6"
            style={{ border: `1px solid ${p.line}` }}
          >
            <SafeImage
              src={heroImage}
              alt={`${guide.name} — image du jeu`}
              width={1280}
              height={720}
              className="w-full h-[200px] sm:h-[280px] object-cover"
              fallbackClassName="w-full h-[200px] sm:h-[280px]"
              priority
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(20,16,12,.92) 0%, rgba(20,16,12,.55) 45%, rgba(20,16,12,.15) 100%)",
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7 flex items-end gap-4">
              {game?.posterUrl && (
                <SafeImage
                  src={game.posterUrl}
                  alt=""
                  aria-hidden="true"
                  width={120}
                  height={160}
                  className="hidden sm:block w-[84px] h-[112px] rounded-lg object-cover shadow-lg shrink-0"
                  fallbackClassName="hidden sm:block w-[84px] h-[112px] rounded-lg"
                  style={{ border: "1px solid rgba(255,255,255,.25)" }}
                />
              )}
              <div className="min-w-0">
                <p
                  className="text-[11px] font-bold uppercase tracking-[0.16em] mb-1.5"
                  style={{ color: "#F0C97A" }}
                >
                  Guide parents
                </p>
                <h1
                  className="font-serif text-[clamp(26px,5vw,42px)] leading-[1.08] text-white"
                >
                  {guide.name}
                </h1>
              </div>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}

        <p className="text-lg leading-snug mb-4" style={{ color: p.ink2 }}>
          {guide.tagline}
        </p>

        {/* Live catalogue strip — age and platforms come from the fiche, so the
            guide can never contradict it. Links back to the fiche, which is
            the page that owns the age verdict. */}
        {game && (
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-10 pb-6"
            style={{ borderBottom: `1px solid ${p.line}` }}
          >
            {game.expertAgeRec != null && game.expertAgeRec > 0 && (
              <Link
                href={`/media/${game.id}`}
                className="rounded-full px-3 py-1.5 text-sm font-bold hover:opacity-90"
                style={{ background: p.accent, color: "#fff" }}
              >
                Dès {game.expertAgeRec} ans — voir la fiche
              </Link>
            )}
            {game.platforms.length > 0 && (
              <PlatformIcons platforms={game.platforms} />
            )}
          </div>
        )}

        {/* ── Layer 1: understanding. No date — this ages slowly. ── */}
        <Section title="Ce que c'est vraiment" p={p}>
          <p className="leading-relaxed" style={{ color: p.ink }}>
            {guide.whatItIs}
          </p>
        </Section>

        <Section title="Ce qui se passe quand votre enfant y joue" p={p}>
          <Bullets items={guide.whatHappens} p={p} />
        </Section>

        {/* What the described session actually looks like. Placed right after
            the description so the words and the pictures reinforce each other
            — a parent who has never seen the game gets the visual answer in
            the same beat as the written one. Reuses the fiche gallery
            (dedupe + lightbox) rather than a second implementation. */}
        {game && galleryShots.length > 0 && (
          <div className="mb-10">
            <h2
              className="font-serif text-xl mb-1"
              style={{ color: p.ink }}
            >
              Ce que votre enfant voit à l&apos;écran
            </h2>
            <p className="text-sm mb-4" style={{ color: p.ink2 }}>
              Images du jeu tel qu&apos;il se présente. Cliquez pour agrandir.
            </p>
            <DashboardScreenshots screenshots={galleryShots} title={guide.name} />
          </div>
        )}

        <Section title="Pourquoi les enfants y tiennent" p={p}>
          <p className="leading-relaxed" style={{ color: p.ink }}>
            {guide.whyKidsLove}
          </p>
        </Section>

        <Section title="Les décisions qui vous reviennent" p={p}>
          {/* Numbered so a parent can see at a glance how many calls they
              actually have to make — the list being finite is itself
              reassuring. */}
          <div className="space-y-3">
            {guide.decisions.map((d, i) => (
              <div
                key={d.question}
                className="rounded-xl p-4 flex gap-3.5"
                style={{ background: p.card, border: `1px solid ${p.line}` }}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                  style={{ background: `${p.accent}1F`, color: p.accent }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold mb-1" style={{ color: p.ink }}>
                    {d.question}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: p.ink2 }}>
                    {d.detail}
                  </p>
                </div>
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

        {/* The one section that asks the parent to DO something rather than
            worry about something. Given its own warm block so it reads as the
            payoff of the page, not another advisory. */}
        <section className="mb-10">
          <div
            className="rounded-2xl p-5 sm:p-6"
            style={{ background: `${p.accent}0F`, border: `1px solid ${p.accent}33` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Gamepad2 className="h-4.5 w-4.5" style={{ color: p.accent }} />
              <h2 className="font-serif text-xl" style={{ color: p.ink }}>
                Jouer avec votre enfant
              </h2>
            </div>
            <p className="leading-relaxed mb-3" style={{ color: p.ink }}>
              {guide.playTogether.intro}
            </p>
            <Bullets items={guide.playTogether.ideas} p={p} />
          </div>
        </section>

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
