import { getAnthropic, DEFAULT_MODEL as DEFAULT_ANTHROPIC_MODEL } from "@/lib/anthropic"
import { callClaudeWithTimeout } from "@/lib/anthropic-with-timeout"
import type { NewsCategory } from "@prisma/client"

/**
 * Editorial supervision tag — classifies a synthesized news story so
 * the V3 feed balancer can prevent stacking heavy stories at the top.
 *
 * Per-story call, Haiku 4.5 (~$0.0002 each), ~3-8s. Fail-open: any
 * timeout / parse error → `{ tone: "neutral", cluster: null }` so the
 * pipeline never blocks on this step. The story still ships; the
 * balancer just treats it as neutral.
 */

export type EditorialTone = "positive" | "neutral" | "concerning" | "grave"

export interface EditorialVerdict {
  /** Emotional weight as perceived by a parent reading the headline +
   *  summary on the homepage. Not a quality signal — a "grave" story
   *  can be high-quality and important. The tag only constrains
   *  feed-level placement (e.g. never the hero card). */
  tone: EditorialTone
  /** Short kebab-case tag grouping stories on the same heavy subject
   *  so two of them can't sit side-by-side. Examples: `teen-suicide`,
   *  `screen-time`, `addiction`, `harassment`, `cinema-release`,
   *  `gaming-launch`, `school`, `sport`. Null when the story doesn't
   *  belong to a recognisable cluster (one-off cultural / lifestyle
   *  pieces) — the balancer treats those as `_unclustered`. */
  cluster: string | null
}

interface JudgeInput {
  title: string
  summary: string
  body: string
  category: NewsCategory
}

const JUDGE_TIMEOUT_MS = 15_000

const SYSTEM_PROMPT = `Tu es l'éditeur en chef de Totem Avisé, un guide familial.

Pour chaque article publié, attribue DEUX étiquettes au format JSON STRICT :

1. "tone" : poids émotionnel perçu par un parent qui lit le titre + résumé sur la page d'accueil.
   - "positive"    : nouvelle réjouissante ou inspirante (sortie attendue, succès culturel, exploit familial, initiative positive, fait du jour léger).
   - "neutral"     : information factuelle sans charge émotionnelle marquée (sortie cinéma standard, lancement de jeu, classement, étude au ton modéré).
   - "concerning"  : sujet qui éveille la vigilance parentale sans choc (étude sur les écrans, polémique modérée, contenu sensible discuté avec recul).
   - "grave"       : sujet lourd qui pourrait perturber un parent en arrivant sur la page (suicide adolescent, agression sexuelle, attentat, mort d'enfant, abus, automutilation, drogue dure).

   Règle : "grave" est rare et réservé aux sujets qui demanderaient un avertissement éditorial. La plupart des articles sont "neutral" ou "concerning".

2. "cluster" : tag court (kebab-case, max 24 caractères) qui groupe les articles sur le MÊME sujet lourd. Utilisé pour empêcher deux articles sur le même thème de se côtoyer dans le feed.

   Exemples : "teen-suicide", "harcelement-scolaire", "addiction-ecran", "violence-conjugale", "drogue-mineurs", "cinema-sortie", "jeu-lancement", "console-actu", "sport-jeunesse", "etude-parental", "tiktok-mineurs", "ia-jeunes".

   - Préfère un cluster existant si l'article s'y rapporte clairement.
   - Réponds avec null si l'article est un one-off culturel/lifestyle ou ne s'inscrit pas dans une vague.

Réponds UNIQUEMENT avec du JSON brut, pas de markdown, pas de texte autour :
{"tone":"neutral","cluster":"cinema-sortie"}`

function parseVerdict(raw: string): EditorialVerdict | null {
  // Strip code fences if the model wraps despite the instruction.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
  try {
    const parsed = JSON.parse(cleaned) as { tone?: unknown; cluster?: unknown }
    const tone = String(parsed.tone ?? "").toLowerCase()
    if (tone !== "positive" && tone !== "neutral" && tone !== "concerning" && tone !== "grave") {
      return null
    }
    let cluster: string | null = null
    if (typeof parsed.cluster === "string") {
      const c = parsed.cluster.trim().toLowerCase()
      if (c && c !== "null" && c.length <= 32) cluster = c
    }
    return { tone: tone as EditorialTone, cluster }
  } catch {
    return null
  }
}

export const DEFAULT_EDITORIAL_VERDICT: EditorialVerdict = { tone: "neutral", cluster: null }

/**
 * Returns null when the call fails (no API key, timeout, parse error).
 * Callers in the live pipeline coalesce with DEFAULT_EDITORIAL_VERDICT
 * so the story still ships with a neutral tag. The backfill script
 * uses the null signal to skip the DB write, so a transient outage
 * doesn't pin every row to "neutral" forever.
 */
export async function judgeEditorial(input: JudgeInput): Promise<EditorialVerdict | null> {
  const userPrompt = `Catégorie : ${input.category}
Titre : ${input.title}

Résumé :
${input.summary}

Corps (extrait) :
${input.body.slice(0, 1200)}`

  let result
  try {
    result = await callClaudeWithTimeout(
      (signal) =>
        getAnthropic().messages.create(
          {
            model: DEFAULT_ANTHROPIC_MODEL,
            max_tokens: 80,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userPrompt }],
          },
          { signal },
        ),
      JUDGE_TIMEOUT_MS,
      "editorial-judge",
    )
  } catch {
    return null
  }
  if (!result) return null
  const first = result.content[0]
  if (!first || first.type !== "text") return null
  return parseVerdict(first.text)
}
