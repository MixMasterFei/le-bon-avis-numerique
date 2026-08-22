import { prisma } from "@/lib/prisma"
import { fetchAdminKpis, type SerializedCronTask } from "@/lib/admin-kpis"
import { describeTask, type PipelineFamily } from "@/lib/steph/pipeline-glossary"

/**
 * Données du tableau de bord /steph.
 *
 * Volontairement construit PAR-DESSUS `fetchAdminKpis()` plutôt qu'à côté :
 * les deux tableaux de bord doivent donner les mêmes chiffres, sinon on passe
 * son temps à se demander lequel a raison. On n'ajoute ici que ce que
 * l'espace /steph montre en plus (répartition du catalogue, actualités,
 * verdict « météo »), et on traduit tout en français lisible.
 *
 * Tout est sérialisable (aucun objet Date) : la page serveur passe l'objet tel
 * quel au composant client.
 */

const MS_PER_HOUR = 3_600_000

// ── Statut d'une tâche ────────────────────────────────────────────────

export type TaskHealth = "ok" | "late" | "failed" | "never" | "attention"

export interface StephTask {
  task: string
  label: string
  family: PipelineFamily
  cadence: string
  what: string
  why: string
  health: TaskHealth
  /** ISO, ou null si la tâche n'a jamais tourné. */
  lastRun: string | null
  /** Nombre d'erreurs sur les 7 derniers jours. */
  errors7d: number
  /** Phrase prête à afficher expliquant le statut. */
  statusNote: string
}

export interface StephTaskFamily {
  key: PipelineFamily
  tasks: StephTask[]
}

// ── Verdict global ────────────────────────────────────────────────────

export type WeatherLevel = "good" | "watch" | "bad"

export interface StephWeather {
  level: WeatherLevel
  /** Titre en une ligne. */
  headline: string
  /** Explication en français simple. */
  detail: string
  /** Ce qu'il y a à faire, ou null si rien. */
  todo: string | null
}

// ── Forme complète ────────────────────────────────────────────────────

export interface StephTypeCount {
  type: string
  label: string
  count: number
}

export interface StephReactionCount {
  reaction: string
  label: string
  count: number
}

export interface StephDashboard {
  generatedAt: string

  weather: StephWeather

  catalogue: {
    total: number
    /** Fiches analysées en profondeur (les 8 dimensions existent). */
    analysed: number
    /** Fiches avec un âge estimé en attente de confirmation. */
    provisional: number
    /** Fiches restant à analyser et déjà sorties. */
    backlog: number
    byType: StephTypeCount[]
    backlogByType: StephTypeCount[]
    /** Titres ajoutés sur les 7 derniers jours. */
    addedWeek: number
  }

  familles: {
    accounts: number
    accountsWeek: number
    accountsPrevWeek: number
    accountsMonth: number
    /** Comptes ayant créé au moins un profil enfant. */
    withProfiles: number
    /** Comptes ayant créé au moins trois profils. */
    withThreeProfiles: number
    /** Profils enfants au total. */
    members: number
    /** Profils enfants ayant terminé le quiz de préférences. */
    membersQuizDone: number
    /** 30 derniers jours : inscriptions et premières familles créées. */
    dailyGrowth: Array<{ day: string; users: number; families: number }>
  }

  engagement: {
    reactionsWeek: number
    reactionsPrevWeek: number
    reactionsByType: StephReactionCount[]
    reviewsWeek: number
    reviewsPrevWeek: number
    ageVotesWeek: number
    ageVotesPrevWeek: number
    recoClicksWeek: number
    recoClicksPrevWeek: number
  }

  editorial: {
    /** Brèves publiées sur les 7 derniers jours. */
    newsWeek: number
    newsTotal: number
    /** ISO de la dernière brève publiée. */
    lastNewsAt: string | null
  }

  decisions: {
    corrections: number
    requests: number
    signalements: number
    desaccords: number
    total: number
  }

  pipeline: {
    families: StephTaskFamily[]
    /** Tâches qui ne vont pas (en retard, en erreur, jamais lancées). */
    problems: StephTask[]
    okCount: number
    totalCount: number
    errors7d: number
  }
}

// ── Libellés ──────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  MOVIE: "Films",
  TV: "Séries",
  GAME: "Jeux vidéo",
  MANGA: "Mangas",
  BOOK: "Livres",
  APP: "Applications",
}

const REACTION_LABELS: Record<string, string> = {
  WATCHED: "Déjà vu",
  LOVED: "Adoré",
  LIKED: "Bien aimé",
  OK: "Bof",
  SCARED: "A eu peur",
  BORED: "S'est ennuyé",
  TOO_YOUNG: "Trop jeune",
  TOO_OLD: "Trop grand",
  NOT_FOR_ME: "Pas pour moi",
  WANTS_TO_WATCH: "Veut le voir",
}

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type
}

// ── Santé d'une tâche ─────────────────────────────────────────────────

/**
 * Traduit une ligne brute de `cron_logs` en statut lisible.
 *
 * Les seuils de retard viennent du glossaire, lui-même aligné sur
 * EXPECTED_TASKS (src/lib/cron-supervisor.ts) : /steph n'invente pas ses
 * propres règles d'alerte, il affiche celles qui déclenchent réellement
 * les e-mails.
 */
export function classifyTask(row: SerializedCronTask, now: number): StephTask {
  const info = describeTask(row.task)
  const lastRunMs = row.lastRun ? new Date(row.lastRun).getTime() : null
  const hoursSince = lastRunMs === null ? null : (now - lastRunMs) / MS_PER_HOUR
  const isLate = hoursSince !== null && hoursSince > info.staleAfterHours

  let health: TaskHealth
  let statusNote: string

  if (lastRunMs === null) {
    health = "never"
    statusNote = "Cette tâche n'a encore jamais tourné."
  } else if (row.lastStatus === "error") {
    health = "failed"
    statusNote = "La dernière exécution a échoué."
  } else if (isLate) {
    health = "late"
    const days = Math.floor((hoursSince as number) / 24)
    statusNote =
      days >= 1
        ? `Rien depuis ${days} jour${days > 1 ? "s" : ""}, alors qu'elle devrait tourner ${info.cadence.toLowerCase()}.`
        : "Elle a dépassé son délai habituel."
  } else if (row.lastStatus === "partial" && !info.partialIsNormal) {
    health = "attention"
    statusNote = "Elle a tourné, mais n'a pas fait tout son travail."
  } else if (row.errors7d > 0) {
    health = "attention"
    statusNote = `Elle fonctionne, mais a échoué ${row.errors7d} fois cette semaine.`
  } else {
    health = "ok"
    statusNote =
      row.lastStatus === "partial"
        ? "Tout va bien (« partiel » est normal pour cette tâche : il n'y avait rien à faire)."
        : "Tout va bien."
  }

  return {
    task: row.task,
    label: info.label,
    family: info.family,
    cadence: info.cadence,
    what: info.what,
    why: info.why,
    health,
    lastRun: row.lastRun,
    errors7d: row.errors7d,
    statusNote,
  }
}

/**
 * Verdict « météo » du site.
 *
 * Une panne (tâche en erreur ou jamais lancée) l'emporte sur tout le reste ;
 * un simple retard ou une file de modération qui grossit se contentent de
 * « à surveiller ». L'idée est qu'un rouge à l'écran veuille toujours dire
 * « il faut prévenir Xavier », jamais « c'est peut-être rien ».
 */
export function computeWeather(problems: StephTask[], decisionsTotal: number): StephWeather {
  const broken = problems.filter((t) => t.health === "failed" || t.health === "never")
  const late = problems.filter((t) => t.health === "late")
  const shaky = problems.filter((t) => t.health === "attention")

  if (broken.length > 0) {
    const names = broken.map((t) => t.label).join(", ")
    return {
      level: "bad",
      headline:
        broken.length === 1
          ? "Une tâche automatique est en panne"
          : `${broken.length} tâches automatiques sont en panne`,
      detail: `Concernée${broken.length > 1 ? "s" : ""} : ${names}. Tant que ce n'est pas réparé, la partie du site qui en dépend n'avance plus.`,
      todo: "Prévenir Xavier : c'est une intervention technique, rien à faire depuis cet écran.",
    }
  }

  if (late.length > 0) {
    const names = late.map((t) => t.label).join(", ")
    return {
      level: "watch",
      headline: late.length === 1 ? "Une tâche a du retard" : `${late.length} tâches ont du retard`,
      detail: `Concernée${late.length > 1 ? "s" : ""} : ${names}. Elles n'ont pas planté, elles n'ont simplement pas tourné à l'heure prévue — souvent un contretemps passager.`,
      todo: "À revérifier demain. Si le retard persiste deux jours, en parler à Xavier.",
    }
  }

  if (shaky.length > 0) {
    return {
      level: "watch",
      headline: "Tout tourne, avec quelques ratés",
      detail: `${shaky.length} tâche${shaky.length > 1 ? "s ont" : " a"} connu des échecs cette semaine mais fonctionne${shaky.length > 1 ? "nt" : ""} à nouveau. Rien d'urgent.`,
      todo: null,
    }
  }

  if (decisionsTotal > 0) {
    return {
      level: "good",
      headline: "La machine tourne",
      detail: `Toutes les tâches automatiques sont à jour. ${decisionsTotal} élément${decisionsTotal > 1 ? "s attendent" : " attend"} en revanche une décision humaine.`,
      todo: "Jeter un œil à la section « Ce qui attend une décision ».",
    }
  }

  return {
    level: "good",
    headline: "Tout va bien",
    detail:
      "Toutes les tâches automatiques sont à jour et aucune décision humaine n'est en attente. Le site tourne tout seul.",
    todo: null,
  }
}

// ── Récupération ──────────────────────────────────────────────────────

export async function fetchStephDashboard(): Promise<StephDashboard> {
  const now = new Date()
  const week = new Date(now.getTime() - 7 * 24 * MS_PER_HOUR)

  const kpis = await fetchAdminKpis()

  // Les compléments propres à /steph. Chaque requête sur une table
  // « récente » est protégée : une table absente ne doit pas faire tomber
  // toute la page (même posture que fetchAdminKpis).
  const [
    byTypeRaw,
    analysed,
    provisional,
    addedWeek,
    accountsTotal,
    membersTotal,
    membersQuizDone,
    newsWeek,
    newsTotal,
    lastNews,
  ] = await Promise.all([
    prisma.mediaItem.groupBy({ by: ["type"], _count: { _all: true } }),
    prisma.mediaItem.count({ where: { isEnriched: true } }),
    prisma.mediaItem.count({ where: { isEnriched: false, expertAgeRec: { not: null } } }),
    prisma.mediaItem.count({ where: { createdAt: { gte: week } } }),
    prisma.user.count(),
    prisma.familyMember.count(),
    prisma.familyMember.count({ where: { quizCompletedAt: { not: null } } }).catch(() => 0),
    prisma.newsStory
      .count({ where: { status: "PUBLISHED", publishedAt: { gte: week } } })
      .catch(() => 0),
    prisma.newsStory.count({ where: { status: "PUBLISHED" } }).catch(() => 0),
    prisma.newsStory
      .findFirst({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        select: { publishedAt: true },
      })
      .catch(() => null),
  ])

  const nowMs = now.getTime()
  const tasks = kpis.cronTasks
    .map((t) => classifyTask({ ...t, lastRun: t.lastRun?.toISOString() ?? null }, nowMs))
    // Alphabétique à l'intérieur d'une famille : l'ordre d'affichage est
    // porté par les familles, pas par l'ordre de la base.
    .sort((a, b) => a.label.localeCompare(b.label, "fr"))

  const problems = tasks.filter((t) => t.health !== "ok")

  const familiesOrder: PipelineFamily[] = [
    "catalogue",
    "comprehension",
    "editorial",
    "visibilite",
    "familles",
    "surveillance",
  ]
  const pipelineFamilies: StephTaskFamily[] = familiesOrder
    .map((key) => ({ key, tasks: tasks.filter((t) => t.family === key) }))
    .filter((f) => f.tasks.length > 0)

  const decisions = {
    corrections: kpis.correctionsPending,
    requests: kpis.requestsPending,
    signalements: kpis.newsReportsPending,
    desaccords: kpis.disagreedAgeItems,
    total:
      kpis.correctionsPending +
      kpis.requestsPending +
      kpis.newsReportsPending +
      kpis.disagreedAgeItems,
  }

  const byType: StephTypeCount[] = byTypeRaw
    .map((r) => ({ type: String(r.type), label: typeLabel(String(r.type)), count: r._count._all }))
    .sort((a, b) => b.count - a.count)

  return {
    generatedAt: now.toISOString(),

    weather: computeWeather(problems, decisions.total),

    catalogue: {
      total: kpis.catalogTotal,
      analysed,
      provisional,
      backlog: kpis.catalogUnenriched,
      byType,
      backlogByType: kpis.catalogUnenrichedByType.map((r) => ({
        type: r.type,
        label: typeLabel(r.type),
        count: r.count,
      })),
      addedWeek,
    },

    familles: {
      accounts: accountsTotal,
      accountsWeek: kpis.usersWeek,
      accountsPrevWeek: kpis.usersPrevWeek,
      accountsMonth: kpis.usersMonth,
      withProfiles: kpis.familiesTotal,
      withThreeProfiles: kpis.familiesCompleteThree,
      members: membersTotal,
      membersQuizDone,
      dailyGrowth: kpis.dailyGrowth,
    },

    engagement: {
      reactionsWeek: kpis.reactionsWeek,
      reactionsPrevWeek: kpis.reactionsPrevWeek,
      reactionsByType: kpis.reactionsByType
        .map((r) => ({
          reaction: String(r.reaction),
          label: REACTION_LABELS[String(r.reaction)] ?? String(r.reaction),
          count: r.count,
        }))
        .sort((a, b) => b.count - a.count),
      reviewsWeek: kpis.reviewsWeek,
      reviewsPrevWeek: kpis.reviewsPrevWeek,
      ageVotesWeek: kpis.ageVotesWeek,
      ageVotesPrevWeek: kpis.ageVotesPrevWeek,
      recoClicksWeek: kpis.recoClicksWeek,
      recoClicksPrevWeek: kpis.recoClicksPrevWeek,
    },

    editorial: {
      newsWeek,
      newsTotal,
      lastNewsAt: lastNews?.publishedAt.toISOString() ?? null,
    },

    decisions,

    pipeline: {
      families: pipelineFamilies,
      problems,
      okCount: tasks.length - problems.length,
      totalCount: tasks.length,
      errors7d: kpis.cronErrors7d,
    },
  }
}
