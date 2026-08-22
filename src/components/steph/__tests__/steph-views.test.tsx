import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

/**
 * Tests de rendu des trois écrans de l'espace /steph.
 *
 * Ils existent parce que le `next build` de l'intégration continue compile ces
 * pages mais ne les rend jamais : elles sont protégées par une session admin.
 * Une erreur de rendu (frontière client/serveur, accès à une clé absente,
 * boucle infinie dans l'arbre de la carte) ne se verrait donc qu'en
 * production, sur l'écran de la personne à qui ces pages sont destinées.
 */

// next/font est un plugin de compilation Next : sous vitest il faut le
// remplacer par un objet de même forme.
vi.mock("next/font/google", () => ({
  Fraunces: () => ({ className: "font-fraunces", variable: "--font-fraunces", style: {} }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/steph",
  useSearchParams: () => new URLSearchParams(),
}))

// Recharts mesure son conteneur : en jsdom la largeur est nulle et le graphe
// ne se dessine pas. On le remplace par un marqueur, le composant lui-même
// étant déjà utilisé (et éprouvé) sur /admin.
vi.mock("@/components/admin/AdminGrowthChart", () => ({
  AdminGrowthChart: () => <div data-testid="graphe-croissance" />,
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let StephDashboardView: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let StephDeckView: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let StephMindmapView: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dashboardData: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let knowledge: any

beforeAll(async () => {
  StephDashboardView = (await import("../StephDashboardView")).StephDashboardView
  StephDeckView = (await import("../StephDeckView")).StephDeckView
  StephMindmapView = (await import("../StephMindmapView")).StephMindmapView
  dashboardData = await import("@/lib/steph/dashboard-data")
  knowledge = await import("@/lib/steph/knowledge")
})

const NOW = Date.UTC(2026, 7, 22, 12, 0, 0)

function buildDashboard() {
  const tasks = [
    { task: "enrich", lastRun: new Date(NOW - 6 * 3_600_000).toISOString(), lastStatus: "success" as const, errors7d: 0 },
    { task: "news-discover", lastRun: new Date(NOW - 90 * 3_600_000).toISOString(), lastStatus: "success" as const, errors7d: 0 },
    { task: "import", lastRun: new Date(NOW - 2 * 3_600_000).toISOString(), lastStatus: "error" as const, errors7d: 3 },
  ]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const classified = tasks.map((t: any) => dashboardData.classifyTask(t, NOW))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const problems = classified.filter((t: any) => t.health !== "ok")

  return {
    generatedAt: new Date(NOW).toISOString(),
    weather: dashboardData.computeWeather(problems, 2),
    catalogue: {
      total: 11500,
      analysed: 9600,
      provisional: 1200,
      backlog: 700,
      byType: [
        { type: "MOVIE", label: "Films", count: 7000 },
        { type: "TV", label: "Séries", count: 2500 },
        { type: "GAME", label: "Jeux vidéo", count: 2000 },
      ],
      backlogByType: [{ type: "MOVIE", label: "Films", count: 500 }],
      addedWeek: 42,
    },
    familles: {
      accounts: 120,
      accountsWeek: 9,
      accountsPrevWeek: 6,
      accountsMonth: 30,
      withProfiles: 45,
      withThreeProfiles: 8,
      members: 90,
      membersQuizDone: 27,
      dailyGrowth: [{ day: "2026-08-22", users: 2, families: 1 }],
    },
    engagement: {
      reactionsWeek: 31,
      reactionsPrevWeek: 40,
      reactionsByType: [{ reaction: "LOVED", label: "Adoré", count: 12 }],
      reviewsWeek: 2,
      reviewsPrevWeek: 2,
      ageVotesWeek: 5,
      ageVotesPrevWeek: 0,
      recoClicksWeek: 14,
      recoClicksPrevWeek: 10,
    },
    editorial: { newsWeek: 12, newsTotal: 480, lastNewsAt: new Date(NOW - 3_600_000).toISOString() },
    decisions: { corrections: 1, requests: 1, signalements: 0, desaccords: 0, total: 2 },
    pipeline: {
      families: [{ key: "catalogue" as const, tasks: classified }],
      problems,
      okCount: classified.length - problems.length,
      totalCount: classified.length,
      errors7d: 3,
    },
  }
}

describe("StephDashboardView", () => {
  it("affiche le verdict global, les grands chiffres et les files d'attente", () => {
    render(<StephDashboardView data={buildDashboard()} now={NOW} />)

    // La panne de l'import doit remonter tout en haut, en rouge.
    expect(screen.getByText(/Une tâche automatique est en panne/i)).toBeInTheDocument()
    expect(screen.getByText(/Titres au catalogue/i)).toBeInTheDocument()
    expect(screen.getByText("11 500")).toBeInTheDocument()
    expect(screen.getByText(/Corrections proposées/i)).toBeInTheDocument()
  })

  it("déplie le détail d'une tâche au clic", async () => {
    const user = userEvent.setup()
    render(<StephDashboardView data={buildDashboard()} now={NOW} />)

    expect(screen.queryByText(/Pourquoi c'est important/i)).not.toBeInTheDocument()
    await user.click(screen.getAllByRole("button", { name: /Import films & séries/i })[0])
    expect(screen.getAllByText(/Pourquoi c'est important/i).length).toBeGreaterThan(0)
  })

  it("liste les tâches famille par famille à la demande", async () => {
    const user = userEvent.setup()
    render(<StephDashboardView data={buildDashboard()} now={NOW} />)

    await user.click(screen.getByRole("button", { name: /Voir les .* tâches/i }))
    expect(screen.getByText(/Remplir le catalogue/i)).toBeInTheDocument()
  })
})

describe("StephDeckView", () => {
  const live = {
    catalogueTotal: 11500,
    movies: 7000,
    series: 2500,
    games: 2000,
    analysed: 9600,
    accounts: 120,
    members: 90,
    newsTotal: 480,
  }

  it("rend les douze chapitres avec leur sommaire", () => {
    render(<StephDeckView live={live} />)

    const toc = screen.getByRole("navigation", { name: /Sommaire/i })
    expect(within(toc).getAllByRole("listitem")).toHaveLength(knowledge.DECK.length)
    for (const chapter of knowledge.DECK) {
      expect(document.getElementById(chapter.id)).not.toBeNull()
    }
  })

  it("remplace les chiffres vivants par les valeurs de la base", () => {
    render(<StephDeckView live={live} />)
    // 11 500 titres au catalogue — écrit nulle part dans le texte source.
    expect(screen.getAllByText("11 500").length).toBeGreaterThan(0)
    expect(screen.getAllByText("9 600").length).toBeGreaterThan(0)
  })
})

describe("StephMindmapView", () => {
  it("dessine le schéma et ouvre la première branche", () => {
    render(<StephMindmapView />)

    expect(screen.getByRole("img", { name: /carte des sept grands thèmes/i })).toBeInTheDocument()
    expect(screen.getAllByText(knowledge.MINDMAP[0].question).length).toBeGreaterThan(0)
  })

  it("change de branche au clic sur le schéma", async () => {
    const user = userEvent.setup()
    render(<StephMindmapView />)

    const cible = knowledge.MINDMAP[3]
    // On vise la pastille du schéma, pas le raccourci du bas de page : seule
    // la première porte le nombre de sous-thèmes dans son libellé accessible.
    await user.click(
      screen.getByRole("button", {
        name: new RegExp(`${cible.label} — \\d+ sous-thèmes`, "i"),
      })
    )
    expect(screen.getAllByText(cible.question).length).toBeGreaterThan(0)
  })

  it("déplie toutes les branches en vue imprimable", async () => {
    const user = userEvent.setup()
    render(<StephMindmapView />)

    await user.click(screen.getByRole("button", { name: /Tout déplier/i }))
    for (const branch of knowledge.MINDMAP) {
      expect(screen.getAllByText(branch.question).length).toBeGreaterThan(0)
    }
  })
})

describe("StephShell", () => {
  it("rend la coquille, sa navigation et le contenu qu'on lui passe", async () => {
    const { StephShell } = await import("../StephShell")
    render(
      <StephShell active="tableau" eyebrow="Tableau de bord" title="Un titre" subtitle="Un sous-titre">
        <p>Contenu de la page</p>
      </StephShell>
    )

    const nav = screen.getByRole("navigation", { name: /Navigation de l'espace/i })
    expect(within(nav).getAllByRole("link")).toHaveLength(3)
    expect(screen.getByRole("heading", { level: 1, name: "Un titre" })).toBeInTheDocument()
    expect(screen.getByText("Contenu de la page")).toBeInTheDocument()
    // Le lien de repli vers l'interface technique doit rester accessible.
    expect(screen.getByRole("link", { name: /Interface technique/i })).toHaveAttribute(
      "href",
      "/admin"
    )
  })

  it("marque la section active comme page courante", async () => {
    const { StephShell } = await import("../StephShell")
    render(
      <StephShell active="carte" eyebrow="La carte" title="Titre">
        <span />
      </StephShell>
    )
    expect(screen.getByRole("link", { name: /La carte/i })).toHaveAttribute("aria-current", "page")
  })
})

describe("cohérence du contenu", () => {
  it("n'a aucun identifiant en double dans la carte", () => {
    const ids: string[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walk = (node: any) => {
      ids.push(node.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      node.children?.forEach((c: any) => walk(c))
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    knowledge.MINDMAP.forEach((b: any) => walk(b))
    const doublons = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(doublons).toEqual([])
  })

  it("n'a aucun identifiant de chapitre en double dans la présentation", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = knowledge.DECK.map((c: any) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("ne pointe que vers des liens internes (pas de dépendance à un site tiers)", () => {
    const hrefs: string[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walk = (node: any) => {
      if (node.href) hrefs.push(node.href)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      node.children?.forEach((c: any) => walk(c))
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    knowledge.MINDMAP.forEach((b: any) => walk(b))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    knowledge.DECK.forEach((chapter: any) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chapter.blocks.forEach((block: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (block.kind === "links") block.items.forEach((i: any) => hrefs.push(i.href))
      })
    )
    expect(hrefs.length).toBeGreaterThan(0)
     
    expect(hrefs.filter((h: string) => !h.startsWith("/"))).toEqual([])
  })
})
