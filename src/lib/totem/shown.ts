import type { ModelMessage } from "ai"

/**
 * What the parent has already been shown in this conversation, read on the
 * server from the stored model messages — so « un autre ? » never brings
 * back the same titles.
 *
 * Baseline (2026-11-08): three asks for a cartoon for Léa returned Piper,
 * Winnie and Knick Knack twice; « elle les a déjà vus » re-ran the same rail
 * and got Nemo, WALL·E and Toy Story back, then told the parent to go and
 * press a « Déjà vu » button on each card.
 */

export interface ShownMedia {
  id: string
  title: string
}

/** Cards the chat displays per tool output (mirrors TotemMessage.tsx). */
const DISPLAYED_CARDS: Record<string, number> = { searchMedia: 4, getDiscoveryRail: 6 }

/** Titles shorter than this are only « shown » as a card, never by name match. */
const MIN_NAMED_TITLE_LENGTH = 4

/** At most this many titles are listed in the prompt note. */
const NOTE_MAX_TITLES = 24

function normTitle(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function asItem(v: unknown): ShownMedia | null {
  if (!v || typeof v !== "object") return null
  const r = v as Record<string, unknown>
  return typeof r.id === "string" && typeof r.title === "string" ? { id: r.id, title: r.title } : null
}

/**
 * Media the parent has seen in earlier answers: the cards the chat displays
 * (first 4 of a search, first 6 of a rail, a details card), plus any title a
 * tool returned that the answer then named in its text.
 */
export function collectShownMedia(messages: readonly ModelMessage[]): ShownMedia[] {
  const shown = new Map<string, string>()
  const returned = new Map<string, string>()
  const texts: string[] = []

  for (const m of messages) {
    if (m.role === "assistant") {
      if (typeof m.content === "string") texts.push(m.content)
      else for (const p of m.content) if (p.type === "text") texts.push(p.text)
      continue
    }
    if (m.role !== "tool") continue
    for (const p of m.content) {
      if (p.type !== "tool-result" || p.output.type !== "json") continue
      const value = p.output.value as Record<string, unknown> | null
      if (!value || typeof value !== "object") continue
      if (p.toolName === "getMediaDetails") {
        const item = value.found ? asItem(value) : null
        if (item) shown.set(item.id, item.title)
        continue
      }
      const cards = DISPLAYED_CARDS[p.toolName]
      if (cards == null || !Array.isArray(value.results)) continue
      value.results.forEach((r: unknown, i: number) => {
        const item = asItem(r)
        if (!item) return
        if (i < cards) shown.set(item.id, item.title)
        else returned.set(item.id, item.title)
      })
    }
  }

  const said = ` ${normTitle(texts.join("\n"))} `
  for (const [id, title] of returned) {
    if (shown.has(id)) continue
    const t = normTitle(title)
    if (t.length >= MIN_NAMED_TITLE_LENGTH && said.includes(` ${t} `)) shown.set(id, title)
  }
  return [...shown].map(([id, title]) => ({ id, title }))
}

/** The parent says the titles (or one of them) were already seen. */
export function saysAlreadySeen(text: string): boolean {
  const t = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
  // « elle a vu la bande-annonce » is not « elle l'a vu »: without « déjà »,
  // only the object-pronoun form counts.
  return /\b(deja (vue?s?|regardee?s?|joue|lue?s?)|connai(t|ssent) deja|(on|il|elle|ils|elles|je|nous) (l'|les )(a|ai|ont|avons) (deja )?(vue?s?|regardee?s?)|vue?s? et revue?s?)\b/.test(
    t,
  )
}

/** Dynamic-tail note: what not to propose again, and how to take « déjà vu ». */
export function buildShownNote(opts: {
  shown: readonly ShownMedia[]
  alreadySeen: boolean
  userIsAnonymous: boolean
}): string | null {
  const lines: string[] = []
  if (opts.shown.length > 0) {
    const titles = opts.shown.slice(-NOTE_MAX_TITLES).map((s) => s.title)
    lines.push(
      `- Déjà montrés au parent dans cette conversation : ${titles.join(", ")}. Les outils de recommandation les excluent déjà ; pour « un autre », rappelle un outil et ne repropose aucun de ces titres de mémoire.`,
    )
  }
  if (opts.alreadySeen) {
    lines.push(
      opts.userIsAnonymous
        ? "- Le parent dit que ces titres ont déjà été vus : dis-lui que tu ne les reproposeras plus dans cette conversation, puis propose d'autres titres."
        : "- Le parent dit que ces titres ont déjà été vus : propose de les enregistrer comme vus (proposeReaction, réaction WATCHED, pour le membre concerné — son id via getUserFamilyContext ; au plus trois cartes, pour les titres que tu avais nommés), puis propose d'autres titres. Ne lui demande pas d'aller toucher un bouton sur les fiches.",
    )
  }
  return lines.length ? `# Déjà montré\n${lines.join("\n")}` : null
}
