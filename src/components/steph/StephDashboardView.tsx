"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ArrowRight,
} from "lucide-react"
import { formatRelativeTimeFr } from "@/lib/utils"
import type {
  StephDashboard,
  StephTask,
  TaskHealth,
  WeatherLevel,
} from "@/lib/steph/dashboard-data"
import { PIPELINE_FAMILY_BY_KEY } from "@/lib/steph/pipeline-glossary"
import { AdminGrowthChart } from "@/components/admin/AdminGrowthChart"
import { StephCard, StephSectionTitle, stephPalette, stephSerif } from "./StephShell"

const p = stephPalette
const serif = stephSerif.className

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n)
}

/** Écart en % vs la semaine précédente, formulé en français. */
function trend(current: number, previous: number): { text: string; tone: "up" | "down" | "flat" } {
  if (previous === 0 && current === 0) return { text: "rien à comparer", tone: "flat" }
  if (previous === 0) return { text: `+${current} vs 0`, tone: "up" }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return { text: "stable", tone: "flat" }
  return {
    text: `${pct > 0 ? "+" : "−"}${Math.abs(pct)} % vs semaine dernière`,
    tone: pct > 0 ? "up" : "down",
  }
}

// ── Briques ───────────────────────────────────────────────────────────

function BigStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: { text: string; tone: "up" | "down" | "flat" }
}) {
  const toneStyle =
    tone?.tone === "up"
      ? { color: "#3E6640", background: "rgba(92,138,92,0.12)" }
      : tone?.tone === "down"
        ? { color: p.accent, background: "rgba(209,106,74,0.12)" }
        : { color: p.ink2, background: "rgba(30,26,21,0.06)" }

  return (
    <StephCard className="flex flex-col gap-1">
      <div
        className="text-[11px] uppercase tracking-[0.12em] font-semibold"
        style={{ color: p.ink2 }}
      >
        {label}
      </div>
      <div
        className={`${serif} text-3xl md:text-4xl font-medium`}
        style={{ color: p.ink, letterSpacing: "-0.02em" }}
      >
        {value}
      </div>
      {hint && (
        <div className="text-sm" style={{ color: p.ink2 }}>
          {hint}
        </div>
      )}
      {tone && (
        <span
          className="mt-1 self-start text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={toneStyle}
        >
          {tone.text}
        </span>
      )}
    </StephCard>
  )
}

const WEATHER_STYLE: Record<
  WeatherLevel,
  { bg: string; border: string; ink: string; Icon: typeof CheckCircle2 }
> = {
  good: { bg: "rgba(92,138,92,0.10)", border: "#5C8A5C", ink: "#3E6640", Icon: CheckCircle2 },
  watch: { bg: "rgba(248,215,117,0.22)", border: "#D9A521", ink: "#7A5A05", Icon: AlertTriangle },
  bad: { bg: "rgba(209,106,74,0.12)", border: "#D16A4A", ink: "#8F3A20", Icon: XCircle },
}

function WeatherBanner({ weather }: { weather: StephDashboard["weather"] }) {
  const s = WEATHER_STYLE[weather.level]
  const Icon = s.Icon
  return (
    <div
      className="rounded-2xl p-5 md:p-7 flex items-start gap-4"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <Icon className="h-7 w-7 shrink-0 mt-0.5" style={{ color: s.border }} aria-hidden />
      <div className="flex flex-col gap-1.5">
        <h2
          className={`${serif} text-xl md:text-2xl font-medium`}
          style={{ color: s.ink, letterSpacing: "-0.01em" }}
        >
          {weather.headline}
        </h2>
        <p className="text-sm md:text-base leading-relaxed" style={{ color: p.ink }}>
          {weather.detail}
        </p>
        {weather.todo && (
          <p className="text-sm font-semibold mt-1" style={{ color: s.ink }}>
            À faire : {weather.todo}
          </p>
        )}
      </div>
    </div>
  )
}

const HEALTH_STYLE: Record<TaskHealth, { label: string; bg: string; fg: string; dot: string }> = {
  ok: { label: "À jour", bg: "rgba(92,138,92,0.12)", fg: "#3E6640", dot: "#5C8A5C" },
  attention: { label: "Quelques ratés", bg: "rgba(248,215,117,0.28)", fg: "#7A5A05", dot: "#D9A521" },
  late: { label: "En retard", bg: "rgba(248,215,117,0.28)", fg: "#7A5A05", dot: "#D9A521" },
  failed: { label: "En panne", bg: "rgba(209,106,74,0.14)", fg: "#8F3A20", dot: "#D16A4A" },
  never: { label: "Jamais lancée", bg: "rgba(30,26,21,0.07)", fg: "#5A5148", dot: "#9B9186" },
}

function TaskRow({ task, now }: { task: StephTask; now: number }) {
  const [open, setOpen] = useState(false)
  const s = HEALTH_STYLE[task.health]

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${p.line}` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-opacity hover:opacity-80"
        style={{ background: p.card }}
      >
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ background: s.dot }}
          aria-hidden
        />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold truncate" style={{ color: p.ink }}>
            {task.label}
          </span>
          <span className="block text-xs truncate" style={{ color: p.ink2 }}>
            {task.cadence} · dernière fois {formatRelativeTimeFr(task.lastRun, { now })}
          </span>
        </span>
        <span
          className="text-[11px] font-semibold px-2 py-1 rounded-full shrink-0"
          style={{ background: s.bg, color: s.fg }}
        >
          {s.label}
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 transition-transform"
          style={{ color: p.ink2, transform: open ? "rotate(180deg)" : undefined }}
          aria-hidden
        />
      </button>

      {open && (
        <div
          className="px-4 py-4 flex flex-col gap-3 text-sm"
          style={{ background: p.bg2, borderTop: `1px solid ${p.line}`, color: p.ink }}
        >
          <div>
            <div
              className="text-[11px] uppercase tracking-[0.12em] font-semibold mb-1"
              style={{ color: p.ink2 }}
            >
              Ce que ça fait
            </div>
            <p className="leading-relaxed">{task.what}</p>
          </div>
          <div>
            <div
              className="text-[11px] uppercase tracking-[0.12em] font-semibold mb-1"
              style={{ color: p.ink2 }}
            >
              Pourquoi c&apos;est important
            </div>
            <p className="leading-relaxed">{task.why}</p>
          </div>
          <div>
            <div
              className="text-[11px] uppercase tracking-[0.12em] font-semibold mb-1"
              style={{ color: p.ink2 }}
            >
              État actuel
            </div>
            <p className="leading-relaxed">{task.statusNote}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/** Barre horizontale proportionnelle — plus lisible qu'un camembert. */
function Bars({
  items,
  color,
  total,
}: {
  items: Array<{ label: string; count: number }>
  color: string
  /** Base du pourcentage. Par défaut, la plus grande valeur. */
  total?: number
}) {
  const max = total ?? Math.max(1, ...items.map((i) => i.count))
  if (items.length === 0) {
    return (
      <p className="text-sm" style={{ color: p.ink2 }}>
        Rien à afficher pour l&apos;instant.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3">
          <span className="text-sm w-32 shrink-0 truncate" style={{ color: p.ink }}>
            {i.label}
          </span>
          <span
            className="h-3 rounded-full flex-1 overflow-hidden"
            style={{ background: p.bg2 }}
            aria-hidden
          >
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.max(2, (i.count / max) * 100)}%`, background: color }}
            />
          </span>
          <span className="text-sm font-semibold w-14 text-right shrink-0" style={{ color: p.ink }}>
            {fmt(i.count)}
          </span>
        </div>
      ))}
    </div>
  )
}

function DecisionTile({
  label,
  count,
  href,
  explain,
}: {
  label: string
  count: number
  href: string
  explain: string
}) {
  return (
    <Link
      href={href}
      className="rounded-xl p-4 flex flex-col gap-1 transition-opacity hover:opacity-80"
      style={{
        background: count > 0 ? "rgba(209,106,74,0.08)" : p.card,
        border: `1px solid ${count > 0 ? "rgba(209,106,74,0.35)" : p.line}`,
      }}
    >
      <span className={`${serif} text-2xl font-medium`} style={{ color: p.ink }}>
        {fmt(count)}
      </span>
      <span className="text-sm font-semibold" style={{ color: p.ink }}>
        {label}
      </span>
      <span className="text-xs leading-snug" style={{ color: p.ink2 }}>
        {explain}
      </span>
      <span
        className="text-xs font-semibold inline-flex items-center gap-1 mt-1"
        style={{ color: p.accent }}
      >
        Ouvrir <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  )
}

// ── Vue ───────────────────────────────────────────────────────────────

export function StephDashboardView({ data, now }: { data: StephDashboard; now: number }) {
  const router = useRouter()
  const [showAllTasks, setShowAllTasks] = useState(false)

  const analysedPct =
    data.catalogue.total > 0
      ? Math.round((data.catalogue.analysed / data.catalogue.total) * 100)
      : 0

  const quizPct =
    data.familles.members > 0
      ? Math.round((data.familles.membersQuizDone / data.familles.members) * 100)
      : 0

  return (
    <div className="flex flex-col gap-12">
      {/* Bouton d'actualisation — la page est rendue à la demande côté
          serveur, un refresh suffit à tout recalculer. */}
      <div className="flex items-center gap-3 flex-wrap -mt-4">
        <button
          type="button"
          onClick={() => router.refresh()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: p.card, border: `1px solid ${p.line}`, color: p.ink }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualiser
        </button>
        <span className="text-xs" style={{ color: p.ink2 }}>
          Chiffres arrêtés {formatRelativeTimeFr(data.generatedAt, { now })}.
        </span>
      </div>

      <WeatherBanner weather={data.weather} />

      {/* 1 — Les 4 chiffres qui résument tout */}
      <section className="flex flex-col gap-4">
        <StephSectionTitle
          step="1"
          title="Les quatre chiffres qui résument tout"
          hint="Si vous ne regardez qu'une chose sur cette page, regardez ceux-là."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <BigStat
            label="Titres au catalogue"
            value={fmt(data.catalogue.total)}
            hint={`dont ${fmt(data.catalogue.analysed)} entièrement analysés (${analysedPct} %)`}
          />
          <BigStat
            label="Comptes créés"
            value={fmt(data.familles.accounts)}
            hint={`${fmt(data.familles.withProfiles)} ont créé au moins un profil enfant`}
            tone={trend(data.familles.accountsWeek, data.familles.accountsPrevWeek)}
          />
          <BigStat
            label="Réactions cette semaine"
            value={fmt(data.engagement.reactionsWeek)}
            hint="ce que les familles disent des titres qu'elles ont vus"
            tone={trend(data.engagement.reactionsWeek, data.engagement.reactionsPrevWeek)}
          />
          <BigStat
            label="Tâches à surveiller"
            value={fmt(data.pipeline.problems.length)}
            hint={`sur ${fmt(data.pipeline.totalCount)} tâches automatiques au total`}
          />
        </div>
      </section>

      {/* 2 — Les tuyaux */}
      <section className="flex flex-col gap-5">
        <StephSectionTitle
          step="2"
          title="Les tuyaux : ce que le site fait tout seul"
          hint="Le site n'est pas mis à jour à la main. Des tâches automatiques tournent chaque nuit pour aller chercher les nouveautés, les analyser et vérifier que tout est cohérent. Cliquez sur une ligne pour comprendre à quoi elle sert."
        />

        <div
          className="rounded-xl px-4 py-3 text-sm flex flex-wrap items-center gap-x-5 gap-y-1"
          style={{ background: p.bg2, color: p.ink }}
        >
          <span className="font-semibold">
            {fmt(data.pipeline.okCount)} / {fmt(data.pipeline.totalCount)} tâches à jour
          </span>
          <span style={{ color: p.ink2 }}>
            {data.pipeline.errors7d === 0
              ? "aucun échec sur les 7 derniers jours"
              : `${fmt(data.pipeline.errors7d)} échec${data.pipeline.errors7d > 1 ? "s" : ""} sur les 7 derniers jours`}
          </span>
        </div>

        {/* Les problèmes d'abord, toujours : c'est la seule chose qui
            demande une action. */}
        {data.pipeline.problems.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold" style={{ color: p.accent }}>
              À regarder en premier
            </h3>
            {data.pipeline.problems.map((t) => (
              <TaskRow key={t.task} task={t} now={now} />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowAllTasks((v) => !v)}
          className="self-start text-sm font-semibold underline transition-opacity hover:opacity-70"
          style={{ color: p.ink }}
        >
          {showAllTasks
            ? "Masquer le détail des tâches"
            : `Voir les ${fmt(data.pipeline.totalCount)} tâches, famille par famille`}
        </button>

        {showAllTasks && (
          <div className="flex flex-col gap-6">
            {data.pipeline.families.map((family) => {
              const info = PIPELINE_FAMILY_BY_KEY[family.key]
              return (
                <div key={family.key} className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span
                      className="h-3 w-3 rounded-full inline-block"
                      style={{ background: info.color }}
                      aria-hidden
                    />
                    <h3 className={`${serif} text-lg font-medium`} style={{ color: p.ink }}>
                      {info.label}
                    </h3>
                    <span className="text-sm" style={{ color: p.ink2 }}>
                      {info.tagline}
                    </span>
                  </div>
                  {family.tasks.map((t) => (
                    <TaskRow key={t.task} task={t} now={now} />
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 3 — Le catalogue */}
      <section className="flex flex-col gap-5">
        <StephSectionTitle
          step="3"
          title="Le catalogue : ce qu'il y a dans la boutique"
          hint="Une fiche passe par deux étapes. D'abord elle entre avec un âge estimé (marqué « à confirmer » sur le site). Ensuite elle est analysée en profondeur, et c'est seulement là qu'elle obtient ses 8 jauges de contenu et son « Pourquoi cet âge ? »."
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StephCard>
            <h3 className="text-sm font-semibold mb-4" style={{ color: p.ink }}>
              Par type de média
            </h3>
            <Bars items={data.catalogue.byType} color="#E8A87C" />
            <p className="text-xs mt-4" style={{ color: p.ink2 }}>
              {fmt(data.catalogue.addedWeek)} titre{data.catalogue.addedWeek > 1 ? "s" : ""} ajouté
              {data.catalogue.addedWeek > 1 ? "s" : ""} sur les 7 derniers jours.
            </p>
          </StephCard>

          <StephCard>
            <h3 className="text-sm font-semibold mb-4" style={{ color: p.ink }}>
              Où en est l&apos;analyse
            </h3>
            <Bars
              items={[
                { label: "Analysés à fond", count: data.catalogue.analysed },
                { label: "Âge « à confirmer »", count: data.catalogue.provisional },
                { label: "En file d'attente", count: data.catalogue.backlog },
              ]}
              color="#5C8A5C"
              total={data.catalogue.total}
            />
            {data.catalogue.backlogByType.length > 0 && (
              <p className="text-xs mt-4 leading-relaxed" style={{ color: p.ink2 }}>
                La file d&apos;attente se compose surtout de{" "}
                {data.catalogue.backlogByType
                  .slice(0, 3)
                  .map((r) => `${r.label.toLowerCase()} (${fmt(r.count)})`)
                  .join(", ")}
                . Elle se vide toute seule, environ 30 titres par nuit.
              </p>
            )}
          </StephCard>
        </div>
      </section>

      {/* 4 — Les familles */}
      <section className="flex flex-col gap-5">
        <StephSectionTitle
          step="4"
          title="Les familles : qui s'inscrit, et va jusqu'au bout"
          hint="Créer un compte ne sert à rien tant qu'on n'a pas créé un profil par enfant, puis répondu au quiz de préférences. Ce sont les trois marches de l'escalier — et c'est à chaque marche qu'on perd du monde."
        />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
          <StephCard className="min-w-0">
            <h3 className="text-sm font-semibold mb-1" style={{ color: p.ink }}>
              Inscriptions sur 30 jours
            </h3>
            <p className="text-xs mb-3" style={{ color: p.ink2 }}>
              En orange, les comptes créés. En vert, ceux qui ont enchaîné en créant leur premier
              profil enfant.
            </p>
            <AdminGrowthChart data={data.familles.dailyGrowth} />
          </StephCard>

          <div className="flex flex-col gap-3">
            <StephCard>
              <h3 className="text-sm font-semibold mb-4" style={{ color: p.ink }}>
                L&apos;escalier
              </h3>
              <Bars
                items={[
                  { label: "Comptes créés", count: data.familles.accounts },
                  { label: "≥ 1 profil enfant", count: data.familles.withProfiles },
                  { label: "≥ 3 profils enfants", count: data.familles.withThreeProfiles },
                ]}
                color="#8DBDC9"
                total={Math.max(1, data.familles.accounts)}
              />
            </StephCard>
            <BigStat
              label="Quiz de préférences"
              value={`${quizPct} %`}
              hint={`${fmt(data.familles.membersQuizDone)} profils sur ${fmt(data.familles.members)} l'ont terminé`}
            />
          </div>
        </div>
      </section>

      {/* 5 — Ce que font les visiteurs */}
      <section className="flex flex-col gap-5">
        <StephSectionTitle
          step="5"
          title="Ce que les visiteurs font sur le site"
          hint="Chiffres des 7 derniers jours. Les réactions sont le signal le plus précieux : elles apprennent au site ce que chaque enfant aime, et améliorent ses recommandations."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <BigStat
            label="Réactions"
            value={fmt(data.engagement.reactionsWeek)}
            hint="« adoré », « a eu peur »…"
            tone={trend(data.engagement.reactionsWeek, data.engagement.reactionsPrevWeek)}
          />
          <BigStat
            label="Votes sur l'âge"
            value={fmt(data.engagement.ageVotesWeek)}
            hint="d'accord ou pas avec notre âge conseillé"
            tone={trend(data.engagement.ageVotesWeek, data.engagement.ageVotesPrevWeek)}
          />
          <BigStat
            label="Avis écrits"
            value={fmt(data.engagement.reviewsWeek)}
            hint="commentaires laissés par les parents"
            tone={trend(data.engagement.reviewsWeek, data.engagement.reviewsPrevWeek)}
          />
          <BigStat
            label="Recommandations suivies"
            value={fmt(data.engagement.recoClicksWeek)}
            hint="clics sur un titre que le site a suggéré"
            tone={trend(data.engagement.recoClicksWeek, data.engagement.recoClicksPrevWeek)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StephCard>
            <h3 className="text-sm font-semibold mb-1" style={{ color: p.ink }}>
              Quelles réactions, cette semaine
            </h3>
            <p className="text-xs mb-4" style={{ color: p.ink2 }}>
              Beaucoup de « a eu peur » sur un titre, c&apos;est le signe que notre âge conseillé
              est peut-être trop bas.
            </p>
            <Bars items={data.engagement.reactionsByType} color="#A79BC7" />
          </StephCard>

          <StephCard>
            <h3 className="text-sm font-semibold mb-1" style={{ color: p.ink }}>
              Les actualités
            </h3>
            <p className="text-xs mb-4" style={{ color: p.ink2 }}>
              Les brèves famille publiées automatiquement quatre fois par jour. C&apos;est le
              contenu qui donne une raison de revenir.
            </p>
            <Bars
              items={[
                { label: "Cette semaine", count: data.editorial.newsWeek },
                { label: "Depuis le début", count: data.editorial.newsTotal },
              ]}
              color="#F8D775"
            />
            <p className="text-xs mt-4" style={{ color: p.ink2 }}>
              Dernière brève publiée {formatRelativeTimeFr(data.editorial.lastNewsAt, { now })}.
            </p>
          </StephCard>
        </div>
      </section>

      {/* 6 — Décisions humaines */}
      <section className="flex flex-col gap-5">
        <StephSectionTitle
          step="6"
          title="Ce qui attend une décision humaine"
          hint="Tout ce qui suit est arrivé par des visiteurs et ne peut pas être tranché par une machine. Ces écrans-là sont sur l'interface technique, mais rien n'y est irréversible : on peut regarder sans risque."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DecisionTile
            label="Corrections proposées"
            count={data.decisions.corrections}
            href="/admin/corrections"
            explain="Un parent signale une erreur sur une fiche."
          />
          <DecisionTile
            label="Titres réclamés"
            count={data.decisions.requests}
            href="/admin/requests"
            explain="Un visiteur demande l'ajout d'un film, d'une série ou d'un jeu."
          />
          <DecisionTile
            label="Commentaires signalés"
            count={data.decisions.signalements}
            href="/admin/news-reports"
            explain="Un commentaire d'actualité signalé comme problématique."
          />
          <DecisionTile
            label="Désaccords sur l'âge"
            count={data.decisions.desaccords}
            href="/admin/disagreed-items"
            explain="Les familles votent majoritairement contre notre âge conseillé."
          />
        </div>
      </section>

      <div
        className="rounded-2xl p-5 md:p-6 text-sm leading-relaxed"
        style={{ background: p.bg2, color: p.ink }}
      >
        <strong>Un mot sur ce qui n&apos;est pas ici.</strong> Le nombre de visiteurs et leur
        provenance ne sont pas stockés dans notre base : il n&apos;existe aucune table de pages
        vues. Ces chiffres-là vivent dans trois outils séparés — Google Search Console (sur quelles
        recherches on apparaît, à quelle position, avec combien de clics), Plausible (la
        fréquentation, sans cookie) et les statistiques de l&apos;hébergeur. Cette page ne montre
        que ce que le site sait de lui-même : son catalogue, ses comptes, ses tâches. Pour la
        partie « d&apos;où viennent les visiteurs », demandez à Xavier un accès à Search Console et
        à Plausible — ce sont les deux à réclamer en premier.
      </div>
    </div>
  )
}
