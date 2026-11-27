import OpenAI from "openai"
import { buildTextCompletionParams, createTextCompletion, modelFailureStatus } from "@/lib/openai-text-model"

/**
 * Synopsis quality audit — checks enriched `synopsisFr` text for two things a
 * French family site can't afford to get wrong:
 *   1. Grammar defects (missing articles/determiners, agreement errors,
 *      dangling clauses) — the kind of bug that slips through an AI
 *      enrichment pass unnoticed (e.g. "doit faire face à mystères" instead
 *      of "à des mystères").
 *   2. Text that reads as machine-generated: stilted, templated, or
 *      translationese phrasing, even when technically grammatical.
 *
 * Pure/testable helpers live here (prompt building, response parsing, the
 * safety gate); the route (src/app/api/admin/synopsis-audit/route.ts) owns
 * the DB querying, batching, OpenAI calls and time budget — same split as
 * seo-autofix.ts.
 */

export const AUDIT_BATCH_SIZE = 12

export interface AuditItemInput {
  id: string
  title: string
  type: string
  synopsis: string
}

export interface AuditVerdict {
  id: string
  hasIssue: boolean
  issueType: "grammar" | "style" | "both" | null
  corrected: string | null
}

const TYPE_LABEL: Record<string, string> = {
  MOVIE: "film",
  TV: "série",
  GAME: "jeu vidéo",
  MANGA: "manga",
}

export function buildAuditPrompt(items: AuditItemInput[]): string {
  const list = items
    .map(
      (item, i) =>
        `${i + 1}. id="${item.id}" (${TYPE_LABEL[item.type] ?? item.type.toLowerCase()}) « ${item.title} »\n   synopsis: "${item.synopsis}"`,
    )
    .join("\n")

  return [
    "Tu relis des synopsis en français pour Totem Avisé, un guide média familial.",
    "Chaque synopsis doit être IRRÉPROCHABLE sur deux points :",
    "",
    "1. GRAMMAIRE : aucun article/déterminant manquant devant un nom (« faire face",
    "   à mystères » doit devenir « à des mystères »), aucune erreur d'accord,",
    "   aucune phrase tronquée ou bancale qui donne l'impression qu'un mot a sauté.",
    "2. NATUREL : le texte doit se lire comme écrit par une personne, pas comme",
    "   généré par une IA — pas de tournure robotique, mécanique ou trop littérale,",
    "   pas de structure de phrase répétitive d'un synopsis à l'autre, pas de ton",
    "   compassé. Chaleureux, clair, informatif : le ton d'un guide familial, pas",
    "   d'un communiqué ou d'une traduction mot à mot.",
    "",
    "Pour CHAQUE synopsis ci-dessous, décide s'il a un problème réel sur l'un de",
    "ces deux points. Un style simple ou concis n'est PAS un problème en soi —",
    "ne signale que les défauts réels.",
    "",
    "Si tu signales un problème, fournis une version corrigée qui :",
    "- corrige uniquement ce qui doit l'être (grammaire et/ou naturel) ;",
    "- garde EXACTEMENT les mêmes faits, personnages, lieux, âges et infos —",
    "  n'invente rien, n'ajoute aucun détail d'intrigue, ne révèle aucun spoiler ;",
    "- reste à peu près la même longueur (2-3 phrases, sois concis) ;",
    "- reste en français.",
    "",
    "SYNOPSIS À VÉRIFIER :",
    list,
    "",
    "Réponds UNIQUEMENT avec un tableau JSON valide (sans markdown), un objet par",
    "synopsis, dans le MÊME ORDRE, en reprenant l'id exact fourni :",
    '[{"id": "<id exact>", "hasIssue": <bool>, "issueType": "grammar"|"style"|"both"|null, "corrected": "<texte corrigé ou null>"}]',
  ].join("\n")
}

function isPlausibleCorrection(text: unknown): text is string {
  return typeof text === "string" && text.trim().length >= 25 && !text.includes("[...]")
}

/** Parses + validates the model's JSON array, dropping any malformed entry. */
export function parseAuditResponse(content: string, expectedIds: string[]): AuditVerdict[] {
  const cleaned = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim()
  const match = cleaned.match(/\[[\s\S]*\]/)
  if (!match) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const known = new Set(expectedIds)
  const verdicts: AuditVerdict[] = []
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue
    const e = entry as Record<string, unknown>
    if (typeof e.id !== "string" || !known.has(e.id)) continue
    const hasIssue = e.hasIssue === true
    const issueType =
      e.issueType === "grammar" || e.issueType === "style" || e.issueType === "both" ? e.issueType : null
    verdicts.push({
      id: e.id,
      hasIssue,
      issueType: hasIssue ? issueType : null,
      corrected: hasIssue && isPlausibleCorrection(e.corrected) ? (e.corrected as string).trim() : null,
    })
  }
  return verdicts
}

/**
 * Factual anchors a rewrite must never drop or alter: numbers, and
 * capitalized words that are genuinely proper nouns — NOT a word that's
 * merely capitalized because it opens a sentence ("Un", "À", "Il"), which a
 * legitimate naturalness rewrite is free to restructure away.
 */
function extractAnchors(text: string): string[] {
  const sentenceStarts = new Set<number>([0])
  for (const m of text.matchAll(/[.!?]\s+/g)) {
    sentenceStarts.add(m.index! + m[0].length)
  }
  const anchors = new Set<string>()
  for (const m of text.matchAll(/[A-ZÀ-Ý][\wÀ-ÿ'-]*|\d+/g)) {
    const token = m[0]
    const isNumber = /^\d+$/.test(token)
    const isSentenceInitial = sentenceStarts.has(m.index)
    if (token.length > 1 && (isNumber || !isSentenceInitial)) anchors.add(token)
  }
  return [...anchors]
}

/**
 * Safety gate before a correction ever touches the DB. Deliberately does NOT
 * use blunt word-overlap — a legitimate "stop sounding like an AI" rewrite
 * can rephrase most of a sentence while staying 100% faithful. Instead it
 * checks the things that must never drift: length stays in the same
 * ballpark (a smoothing pass, not a rewrite), and every factual anchor
 * (names, places, ages, numbers) from the original survives verbatim.
 */
export function correctionPasses(original: string, corrected: string | null): corrected is string {
  if (!corrected) return false
  const a = original.trim()
  const b = corrected.trim()
  if (b.length < 25 || b === a) return false

  const lengthDiff = Math.abs(b.length - a.length)
  if (lengthDiff > Math.max(50, a.length * 0.35)) return false

  const anchors = extractAnchors(a)
  if (anchors.length > 0) {
    const kept = anchors.filter((anchor) => b.includes(anchor))
    if (kept.length / anchors.length < 0.85) return false
  }

  return true
}

/**
 * `cron_logs` status of one audit call. `unverified` = examined rows the model
 * returned no verdict for (failed call, unparseable answer, dropped id).
 *   - every examined row unverified → "error" (failure email: model down?)
 *   - ≥ 50 % unverified → "partial"
 *   - otherwise the historical rule: > 10 unverified or a time bail → "partial".
 * Before 27 Nov 2026 a dead model logged "partial" at most.
 */
export function auditRunStatus(input: {
  examined: number
  unverified: number
  bailedOnTime: boolean
}): "success" | "partial" | "error" {
  const fallback = input.unverified > 10 || input.bailedOnTime ? "partial" : "success"
  return modelFailureStatus({ attempted: input.examined, modelFailures: input.unverified, fallback })
}

/**
 * One batched OpenAI call: sends up to AUDIT_BATCH_SIZE synopses, returns
 * validated verdicts. Never throws — a failed/malformed batch just returns
 * [], leaving those rows unchecked so the next run retries them.
 */
export async function runAuditBatch(openai: OpenAI, items: AuditItemInput[]): Promise<AuditVerdict[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 35_000)
  try {
    const params = buildTextCompletionParams({
      messages: [
        {
          role: "system" as const,
          content:
            "Tu es un relecteur francophone exigeant, spécialisé dans les contenus familiaux. Réponds toujours en JSON valide, sans texte superflu.",
        },
        { role: "user" as const, content: buildAuditPrompt(items) },
      ],
      maxCompletionTokens: 4000,
    })
    const response = await createTextCompletion(openai, params, { signal: controller.signal })
    const content = response.choices[0]?.message?.content
    if (!content) return []
    return parseAuditResponse(
      content,
      items.map((i) => i.id),
    )
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}
