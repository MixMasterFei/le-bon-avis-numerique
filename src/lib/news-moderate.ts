import OpenAI from "openai"
import { getDeepSeek, DEFAULT_DEEPSEEK_MODEL, isDeepSeekAvailable } from "@/lib/deepseek"
import { getAnthropic, DEFAULT_MODEL as DEFAULT_ANTHROPIC_MODEL } from "@/lib/anthropic"

/**
 * Pass-2 family-safety moderation for news stories.
 *
 * Provider escalation (cheapest viable wins):
 *   1. OPENAI_API_KEY + imageUrl → GPT-5-mini vision (multimodal:
 *      text + image safety in one call). Best quality. ~$0.001/story.
 *   2. DEEPSEEK_API_KEY → DeepSeek V4-Flash text-only. Image safety
 *      relies on synthesis-prompt rules. ~$0.0001/story.
 *   3. ANTHROPIC_API_KEY → Claude Haiku 4.5 text-only. Fallback.
 *
 * Audience verdicts (Xavier's brief: parent-only is fine, scary/weird
 * is not):
 *   - "kid_safe"     → ok for a child glancing at the homepage
 *   - "parent_only"  → ok for parents/adults, not for kid-eyes
 *   - "unsuitable"   → drop entirely (horror, gore, weird, disturbing)
 *
 * Fail-open: any moderator error → audience defaults to "parent_only"
 * so the cron never blocks on infra issues.
 */

export type Audience = "kid_safe" | "parent_only" | "unsuitable"

export interface ModerationVerdict {
  audience: Audience
  reason: string
  // True when the verdict actually looked at the image (vision provider
  // ran successfully). False when only the text was reviewed.
  visionUsed: boolean
}

interface CandidateForModeration {
  title: string
  summary: string
  body: string
  category: string
  imageUrl?: string
}

const SYSTEM_PROMPT_BASE = `Tu es un modérateur de contenu pour un site familial français (Totem Avisé). Pour chaque article qu'on te présente, tu dois décider de son audience.

Trois verdicts possibles :

- **kid_safe** : un enfant qui passe devant l'écran ne sera pas perturbé. Annonces de films pour enfants, sorties d'anime, jeux vidéo grand public, conseils éducatifs, études jeunesse, événements culturels famille, sorties cinéma tous publics.

- **parent_only** : adapté aux parents qui lisent, mais pas du contenu à mettre sous les yeux d'un enfant. Documentaires sur sujets durs (violences éducatives, harcèlement scolaire, etc.), analyses sociologiques sérieuses, débats sur la parentalité, articles sur la santé mentale des ados. PAS de horreur, PAS de sang, PAS de bizarrerie — juste du contenu mature mais sain.

- **unsuitable** : à écarter. Horreur, gore, contenu choquant ou bizarre, true-crime sensationnaliste, contenu sexuel, polémiques sans valeur famille, articles avec un ton anxiogène ou alarmiste sans fondement.`

const SYSTEM_PROMPT_TEXT_ONLY = `${SYSTEM_PROMPT_BASE}

Renvoie UNIQUEMENT du JSON sans markdown : { "audience": "kid_safe" | "parent_only" | "unsuitable", "reason": "phrase courte en français expliquant ton choix" }`

const SYSTEM_PROMPT_VISION = `${SYSTEM_PROMPT_BASE}

ATTENTION SPÉCIFIQUE À L'IMAGE : tu vois aussi l'image qui sera affichée sur la page d'accueil. Vérifie qu'elle est appropriée pour un site familial :
- Visages déformés / maquillage d'horreur / créatures monstrueuses gros plan → unsuitable
- Sang, gore, scènes choquantes → unsuitable
- Atmosphère sombre menaçante, expression terrifiée gros plan → au minimum parent_only, généralement unsuitable
- Posters de films d'horreur, true-crime sensationnaliste → unsuitable
- Imagerie sexuelle ou suggestive → unsuitable
- Contenu visuel adulte sain (documentaire mature, photo institutionnelle sobre) → parent_only OK
- Posters officiels, photos promo neutres, captures d'ambiance → kid_safe

Si l'image est inappropriée même si le texte est OK, renvoie unsuitable.

Renvoie UNIQUEMENT du JSON sans markdown : { "audience": "kid_safe" | "parent_only" | "unsuitable", "reason": "phrase courte en français expliquant ton choix (mentionne l'image si c'est elle qui pose problème)" }`

function buildUserPrompt(c: CandidateForModeration): string {
  return `Catégorie : ${c.category}
Titre : ${c.title}
Résumé : ${c.summary}

Corps :
${c.body}

Verdict ?`
}

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI | null {
  if (_openai) return _openai
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  _openai = new OpenAI({ apiKey: key })
  return _openai
}

interface ModerationCallResult {
  text: string
  visionUsed: boolean
}

async function callModerator(
  c: CandidateForModeration,
  prompt: string,
): Promise<ModerationCallResult> {
  const openai = getOpenAI()

  // Path 1: vision-capable. Send image_url alongside the text so the
  // model can refuse on visual content the text didn't flag.
  if (openai && c.imageUrl) {
    const r = await openai.chat.completions.create({
      // GPT-5-mini supports vision via image_url content blocks. Low
      // detail keeps cost ~$0.001 per image. Bump to "high" only if
      // false-negatives prove problematic.
      model: "gpt-5-mini",
      max_completion_tokens: 200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT_VISION },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: c.imageUrl, detail: "low" } },
          ],
        },
      ],
    })
    return { text: r.choices[0]?.message?.content ?? "", visionUsed: true }
  }

  // Path 2: DeepSeek text-only.
  if (isDeepSeekAvailable()) {
    const ds = getDeepSeek()
    const r = await ds.chat.completions.create({
      model: DEFAULT_DEEPSEEK_MODEL,
      max_tokens: 200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT_TEXT_ONLY },
        { role: "user", content: prompt },
      ],
    })
    return { text: r.choices[0]?.message?.content ?? "", visionUsed: false }
  }

  // Path 3: Claude fallback (existing infra).
  const anthropic = getAnthropic()
  const r = await anthropic.messages.create({
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 200,
    system: SYSTEM_PROMPT_TEXT_ONLY,
    messages: [{ role: "user", content: prompt }],
  })
  const block = r.content.find((c) => c.type === "text")
  const text = block && "text" in block ? (block as { text: string }).text : ""
  return { text, visionUsed: false }
}

function parseVerdict(raw: string): Pick<ModerationVerdict, "audience" | "reason"> | null {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0]) as Partial<ModerationVerdict>
    const a = parsed.audience
    if (a !== "kid_safe" && a !== "parent_only" && a !== "unsuitable") return null
    return {
      audience: a,
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : "",
    }
  } catch {
    return null
  }
}

export async function moderateStory(c: CandidateForModeration): Promise<ModerationVerdict> {
  try {
    const { text, visionUsed } = await callModerator(c, buildUserPrompt(c))
    const verdict = parseVerdict(text)
    if (verdict) return { ...verdict, visionUsed }
    // Unparseable → fail-open as parent_only.
    return { audience: "parent_only", reason: "moderator response unparseable", visionUsed }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "moderator error"
    return { audience: "parent_only", reason: `moderator failed: ${msg}`, visionUsed: false }
  }
}
