import { getDeepSeek, DEFAULT_DEEPSEEK_MODEL, isDeepSeekAvailable } from "@/lib/deepseek"
import { getAnthropic, DEFAULT_MODEL as DEFAULT_ANTHROPIC_MODEL } from "@/lib/anthropic"
import type { NewsCategory } from "@prisma/client"

/**
 * Pre-publish quality gate for news stories. Runs after moderation
 * but before persistence. Articles below threshold get persisted
 * with status = PENDING_REVIEW (hidden from public surfaces) so a
 * human can decide whether to publish, edit, or drop.
 *
 * Scores 4 dimensions on a 1-5 scale:
 *   - sourceFidelity: claims plausibly attributable to cited sources
 *     (no obvious fabrications — names, numbers, quotes match the
 *     publication style of the cited outlet).
 *   - neutrality: no editorial opinion, no banned vocab, no rhetorical
 *     questions, no Totem-voice conclusions.
 *   - structuralCleanliness: no LLM artifacts ("(article 3)", "[0]",
 *     truncated sentences, broken markdown, "Selon X (article N)").
 *   - lengthFit: matches the format's expected word count window.
 *
 * Threshold: overall ≥ 3 AND no dimension < 2 → publish. Otherwise
 * → pending_review. Tunable by environment if false-positives prove
 * a problem in practice.
 *
 * Provider: DeepSeek (cheapest text model, ~$0.0001/article) →
 * Anthropic Haiku fallback. Fail-open as "publish" so a flaky LLM
 * call never blocks the cron.
 */

export type StoryFormat = "BRIEF" | "DOSSIER"

export interface JudgeInput {
  title: string
  summary: string
  body: string
  category: NewsCategory | string
  format: StoryFormat
  // Source publication names for the fidelity check (we don't fetch
  // the source bodies — too expensive — but the judge can spot
  // obvious mismatches, e.g. claiming Le Monde said something when
  // only Numerama is cited).
  sourceNames: string[]
}

export interface JudgeScores {
  sourceFidelity: number      // 1-5
  neutrality: number          // 1-5
  structuralCleanliness: number // 1-5
  lengthFit: number           // 1-5
}

export interface JudgeVerdict {
  passes: boolean
  scores: JudgeScores
  overall: number
  reason: string
  // True when the LLM call returned a parseable response. False on
  // unparseable / errored responses (in which case we fail-open).
  judged: boolean
}

const MIN_OVERALL = 3
const MIN_PER_DIMENSION = 2

const SYSTEM_PROMPT = `Tu es un évaluateur qualité pour les articles de Totem Avisé, un site d'actualité famille français. Tu reçois un article synthétisé à partir de sources, et tu le notes sur 4 critères.

**Critères (note de 1 à 5 chacun, 5 = excellent, 1 = inacceptable) :**

1. **sourceFidelity** : les affirmations sont-elles plausiblement attribuables aux sources citées, ET l'article relaye-t-il le CONTENU des sources (pas leur existence) ? Pénalise (note basse) si :
   - L'article cite des chiffres précis sans nommer la source qui les a publiés.
   - L'article attribue une déclaration à une publication qui n'est pas dans la liste des sources fournies.
   - L'article invente des citations, noms de chercheurs, ou organisations qui n'apparaissent pas dans les sources.
   - **L'article décrit l'existence d'un article source plutôt que d'en relayer le contenu** : "Numerama publie un guide qui liste 10 jeux", "Le site X présente une sélection", "L'étude révèle des chiffres préoccupants" sans donner les éléments concrets (les jeux, la sélection, les chiffres). C'est de la paraphrase méta, pas du journalisme de relais. Note ≤ 2 obligatoire.
   - L'article paraphrase la STRUCTURE éditoriale du source ("La rédaction précise avoir testé", "Le guide ne se contente pas de…") au lieu de livrer les faits.
   Note 5 = chaque fait fort est nommément attribué ET les éléments concrets (noms, chiffres, dates) sont relayés directement. Note 1 = hallucinations ou méta-paraphrase pure.

2. **neutrality** : voix éditoriale neutre, sans prise de position. Pénalise si :
   - Vocabulaire éditorial : *enfin, malheureusement, fort heureusement, étonnamment, sans surprise, à juste titre, courageux, lucide, alarmant, inquiétant, prometteur, salutaire, catastrophique*.
   - Conclusions Totem ("on ne peut que saluer", "il est temps que…", "voilà qui change la donne").
   - Questions rhétoriques ("Pour combien de temps ?", "Mais à quel prix ?").
   - Titres avec qualificatif ("la semaine où la France a dit assez", "un signal alarmant").
   Note 5 = ton purement descriptif, attributions par nom. Note 1 = éditorial assumé.

3. **structuralCleanliness** : pas d'artefacts LLM. Pénalise si :
   - Mentions de numéros internes : "(article 3)", "[0]", "article numéro 5".
   - Phrases tronquées, markdown cassé, doubles espaces, titres sans corps.
   - Sources citées par numéro plutôt que par nom.
   - Répétitions de paragraphes, formules robotiques ("En conclusion, en résumé").
   Note 5 = propre comme un article édité. Note 1 = artefacts visibles.

4. **lengthFit** : longueur adaptée au format.
   - BRIEF : 200-450 mots (note 5 si dans la fourchette, 3 si 150-200 ou 450-600, 1 si <100 ou >800).
   - DOSSIER : 800-1200 mots (note 5 si dans la fourchette, 3 si 600-800 ou 1200-1500, 1 si <500 ou >1800).

**Sortie** — UNIQUEMENT du JSON sans markdown :
{
  "sourceFidelity": 1-5,
  "neutrality": 1-5,
  "structuralCleanliness": 1-5,
  "lengthFit": 1-5,
  "reason": "phrase courte expliquant la note la plus basse, ou 'OK' si tout est ≥4"
}`

function buildUserPrompt(input: JudgeInput): string {
  return `Format : ${input.format}
Catégorie : ${input.category}
Sources citées : ${input.sourceNames.length > 0 ? input.sourceNames.join(", ") : "(aucune fournie)"}

Titre : ${input.title}

Résumé : ${input.summary}

Corps :
${input.body}`
}

interface ParsedScores {
  sourceFidelity: number
  neutrality: number
  structuralCleanliness: number
  lengthFit: number
  reason: string
}

function clampScore(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v)
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.min(5, Math.round(n)))
}

function parseResponse(raw: string): ParsedScores | null {
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const o = JSON.parse(m[0]) as Record<string, unknown>
    return {
      sourceFidelity: clampScore(o.sourceFidelity),
      neutrality: clampScore(o.neutrality),
      structuralCleanliness: clampScore(o.structuralCleanliness),
      lengthFit: clampScore(o.lengthFit),
      reason: typeof o.reason === "string" ? o.reason.slice(0, 200) : "",
    }
  } catch {
    return null
  }
}

async function callJudge(input: JudgeInput): Promise<string> {
  const prompt = buildUserPrompt(input)
  const MAX_TOKENS = 250

  if (isDeepSeekAvailable()) {
    const ds = getDeepSeek()
    const r = await ds.chat.completions.create({
      model: DEFAULT_DEEPSEEK_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    })
    return r.choices[0]?.message?.content ?? ""
  }

  const anthropic = getAnthropic()
  const r = await anthropic.messages.create({
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  })
  const block = r.content.find((c) => c.type === "text")
  return block && "text" in block ? (block as { text: string }).text : ""
}

export async function judgeStory(input: JudgeInput): Promise<JudgeVerdict> {
  const failOpen: JudgeVerdict = {
    passes: true,
    scores: { sourceFidelity: 3, neutrality: 3, structuralCleanliness: 3, lengthFit: 3 },
    overall: 3,
    reason: "judge unavailable — fail-open",
    judged: false,
  }

  try {
    const raw = await callJudge(input)
    const parsed = parseResponse(raw)
    if (!parsed) return { ...failOpen, reason: "judge response unparseable — fail-open" }

    const scores: JudgeScores = {
      sourceFidelity: parsed.sourceFidelity,
      neutrality: parsed.neutrality,
      structuralCleanliness: parsed.structuralCleanliness,
      lengthFit: parsed.lengthFit,
    }
    const overall =
      (scores.sourceFidelity + scores.neutrality + scores.structuralCleanliness + scores.lengthFit) / 4
    const minDim = Math.min(
      scores.sourceFidelity,
      scores.neutrality,
      scores.structuralCleanliness,
      scores.lengthFit,
    )
    const passes = overall >= MIN_OVERALL && minDim >= MIN_PER_DIMENSION

    return {
      passes,
      scores,
      overall: Math.round(overall * 10) / 10,
      reason: parsed.reason || "no reason given",
      judged: true,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown"
    return { ...failOpen, reason: `judge errored: ${msg}` }
  }
}
