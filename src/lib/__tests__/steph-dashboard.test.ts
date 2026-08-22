import { describe, it, expect } from "vitest"
import { classifyTask, computeWeather, type StephTask } from "@/lib/steph/dashboard-data"
import { PIPELINE_TASKS, PIPELINE_TASK_BY_ID, describeTask } from "@/lib/steph/pipeline-glossary"

const NOW = Date.UTC(2026, 7, 22, 12, 0, 0) // 22 août 2026, midi UTC
const HOUR = 3_600_000

function hoursAgo(h: number): string {
  return new Date(NOW - h * HOUR).toISOString()
}

describe("classifyTask", () => {
  it("marque « à jour » une tâche récente et réussie", () => {
    const t = classifyTask(
      { task: "enrich", lastRun: hoursAgo(6), lastStatus: "success", errors7d: 0 },
      NOW,
    )
    expect(t.health).toBe("ok")
    expect(t.label).toBe("Analyse des contenus")
  })

  it("marque « en panne » une tâche dont la dernière exécution a échoué, même récente", () => {
    const t = classifyTask(
      { task: "enrich", lastRun: hoursAgo(1), lastStatus: "error", errors7d: 1 },
      NOW,
    )
    expect(t.health).toBe("failed")
  })

  it("marque « en retard » au-delà du seuil de la tâche, et pas avant", () => {
    // `enrich` tourne quotidiennement : seuil à 36 h, aligné sur le superviseur.
    const encoreBon = classifyTask(
      { task: "enrich", lastRun: hoursAgo(30), lastStatus: "success", errors7d: 0 },
      NOW,
    )
    const enRetard = classifyTask(
      { task: "enrich", lastRun: hoursAgo(40), lastStatus: "success", errors7d: 0 },
      NOW,
    )
    expect(encoreBon.health).toBe("ok")
    expect(enRetard.health).toBe("late")
  })

  it("n'applique pas le seuil quotidien à une tâche mensuelle", () => {
    // La relecture des guides tourne le 1er du mois : 200 h sans exécution est
    // parfaitement normal. Une régression ici ferait clignoter la page en rouge
    // trois semaines sur quatre.
    const t = classifyTask(
      { task: "game-guides-check", lastRun: hoursAgo(200), lastStatus: "partial", errors7d: 0 },
      NOW,
    )
    expect(t.health).toBe("ok")
  })

  it("traite « partiel » comme normal seulement pour les tâches concernées", () => {
    const normal = classifyTask(
      { task: "age-floor", lastRun: hoursAgo(2), lastStatus: "partial", errors7d: 0 },
      NOW,
    )
    const anormal = classifyTask(
      { task: "enrich", lastRun: hoursAgo(2), lastStatus: "partial", errors7d: 0 },
      NOW,
    )
    expect(normal.health).toBe("ok")
    expect(anormal.health).toBe("attention")
  })

  it("signale une tâche jamais lancée", () => {
    const t = classifyTask(
      { task: "enrich", lastRun: null, lastStatus: null, errors7d: 0 },
      NOW,
    )
    expect(t.health).toBe("never")
  })

  it("habille une tâche inconnue du glossaire sans planter", () => {
    const t = classifyTask(
      { task: "tache-inventee-demain", lastRun: hoursAgo(1), lastStatus: "success", errors7d: 0 },
      NOW,
    )
    expect(t.label).toBe("tache-inventee-demain")
    expect(t.health).toBe("ok")
    expect(t.what).toContain("glossaire")
  })
})

describe("computeWeather", () => {
  const task = (health: StephTask["health"], label: string): StephTask => ({
    task: label,
    label,
    family: "catalogue",
    cadence: "Tous les jours",
    what: "",
    why: "",
    health,
    lastRun: null,
    errors7d: 0,
    statusNote: "",
  })

  it("est au vert quand rien ne cloche", () => {
    expect(computeWeather([], 0).level).toBe("good")
  })

  it("reste au vert avec une file de modération, mais donne une consigne", () => {
    const w = computeWeather([], 4)
    expect(w.level).toBe("good")
    expect(w.todo).not.toBeNull()
  })

  it("passe au rouge dès qu'une tâche est en panne", () => {
    expect(computeWeather([task("failed", "Import films & séries")], 0).level).toBe("bad")
  })

  it("un simple retard ne déclenche que l'orange", () => {
    expect(computeWeather([task("late", "Actualités")], 0).level).toBe("watch")
  })

  it("la panne l'emporte sur le retard dans le message affiché", () => {
    const w = computeWeather([task("late", "Actualités"), task("failed", "Analyse")], 0)
    expect(w.level).toBe("bad")
    expect(w.detail).toContain("Analyse")
  })
})

describe("glossaire des tuyaux", () => {
  it("n'a aucun identifiant de tâche en double", () => {
    const ids = PIPELINE_TASKS.map((t) => t.task)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("décrit chaque tâche avec ses trois phrases obligatoires", () => {
    for (const t of PIPELINE_TASKS) {
      expect(t.what.length, `${t.task}: what`).toBeGreaterThan(20)
      expect(t.why.length, `${t.task}: why`).toBeGreaterThan(20)
      expect(t.cadence.length, `${t.task}: cadence`).toBeGreaterThan(3)
    }
  })

  /**
   * Le garde-fou qui compte : /steph doit décrire toutes les tâches que
   * l'admin surveille. Sans lui, une nouvelle tâche ajoutée à KNOWN_CRON_TASKS
   * apparaîtrait sur cette page avec son identifiant technique brut — soit
   * exactement le jargon que cet espace existe pour éviter.
   *
   * La liste est recopiée plutôt qu'importée : `admin-kpis` tire `prisma`, donc
   * une base de données, dans un test qui n'en a pas besoin. En contrepartie,
   * ce test échoue si les deux listes divergent — ce qui est le but.
   */
  it("couvre toutes les tâches planifiées connues de l'admin", () => {
    const knownFromAdmin = [
      "import",
      "import-games",
      "import-preschool",
      "release-alerts",
      "enrich",
      "enrich-deep",
      "quality",
      "backfill-ratings",
      "synopsis-audit",
      "streaming",
      "similarity",
      "age-floor",
      "news-discover",
      "news.pressKitScout",
      "weekly-dossier",
      "family-content-agent",
      "debt-digest",
      "seo-striking-distance",
      "revert-unreleased",
      "game-guides-check",
      "cron-supervisor",
      "heartbeat",
    ]
    const missing = knownFromAdmin.filter((t) => !PIPELINE_TASK_BY_ID[t])
    expect(missing).toEqual([])
  })

  it("renvoie un habillage neutre pour une tâche inconnue", () => {
    const info = describeTask("inconnue")
    expect(info.label).toBe("inconnue")
    expect(info.family).toBe("surveillance")
  })
})
