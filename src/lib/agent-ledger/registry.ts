import { prisma } from "@/lib/prisma"
import type { AutonomyLevel } from "./policy"

/**
 * Every action an agent may propose is declared here, with its default
 * autonomy and the code that applies — and undoes — it. An action type that
 * isn't registered can't be proposed, approved or reverted: the admin panel
 * can only ever execute code that lives in this file.
 *
 * Writes are COMPARE-AND-SET against the value the agent saw: an approval that
 * lands three weeks after the proposal must not overwrite a synopsis a human
 * edited in the meantime. Same for a revert: it only restores the old value if
 * the field still holds what the agent wrote.
 */

export class AgentActionConflict extends Error {}

export interface ActionHandler {
  type: string
  agent: string
  /** French, admin-facing. */
  label: string
  /** What the default level means for this action, for the policy table. */
  defaultLevel: AutonomyLevel
  defaultMinConfidence: number | null
  /** Short French field name shown above the before/after diff. */
  fieldLabel: string
  apply(targetId: string, payload: unknown, previous: unknown): Promise<void>
  revert(targetId: string, payload: unknown, previous: unknown): Promise<void>
  /** Before/after strings for the panel diff. */
  diff(payload: unknown, previous: unknown): { before: string | null; after: string | null }
}

function field(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== "object") return null
  const v = (obj as Record<string, unknown>)[key]
  return typeof v === "string" ? v : null
}

/**
 * One string column on media_items, compare-and-set both ways. `extra` is
 * merged into every write (e.g. re-queue the synopsis for the grammar audit).
 */
function mediaStringField(
  column: "synopsisFr" | "seoTitle",
  extra: Record<string, unknown> = {},
) {
  async function swap(targetId: string, expected: string | null, next: string | null) {
    const res = await prisma.mediaItem.updateMany({
      where: { id: targetId, [column]: expected },
      data: { [column]: next, ...extra },
    })
    if (res.count === 1) return
    const exists = await prisma.mediaItem.findUnique({ where: { id: targetId }, select: { id: true } })
    throw new AgentActionConflict(
      exists
        ? "La fiche a été modifiée depuis : rien n'a été écrasé."
        : "La fiche n'existe plus.",
    )
  }
  return {
    apply: (targetId: string, payload: unknown, previous: unknown) => {
      const next = field(payload, column)
      if (!next) throw new AgentActionConflict("Proposition vide : rien à appliquer.")
      return swap(targetId, field(previous, column), next)
    },
    revert: (targetId: string, payload: unknown, previous: unknown) =>
      swap(targetId, field(payload, column), field(previous, column)),
    diff: (payload: unknown, previous: unknown) => ({
      before: field(previous, column),
      after: field(payload, column),
    }),
  }
}

export const ACTION_HANDLERS: Record<string, ActionHandler> = {
  "seo.synopsis_rewrite": {
    type: "seo.synopsis_rewrite",
    agent: "seo-striking-distance",
    label: "Réécriture du synopsis (mot-clé de recherche)",
    fieldLabel: "Synopsis",
    // act_report = the behaviour the SEO agent has had since 2026-07-10
    // (writes by default), now with an undo button and a review list.
    defaultLevel: "act_report",
    defaultMinConfidence: null,
    // Fresh text: put it back in the synopsis-audit queue.
    ...mediaStringField("synopsisFr", { synopsisFrCheckedAt: null }),
  },
  "seo.seo_title": {
    type: "seo.seo_title",
    agent: "seo-striking-distance",
    label: "Titre SEO (balise <title> uniquement)",
    fieldLabel: "Balise <title>",
    defaultLevel: "act_report",
    defaultMinConfidence: null,
    ...mediaStringField("seoTitle"),
  },
}

export const AGENT_LABELS: Record<string, string> = {
  "seo-striking-distance": "Agent SEO",
}

export function getHandler(type: string): ActionHandler | null {
  return ACTION_HANDLERS[type] ?? null
}
