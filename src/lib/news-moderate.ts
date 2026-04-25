import { getDeepSeek, DEFAULT_DEEPSEEK_MODEL, isDeepSeekAvailable } from "@/lib/deepseek"
import { getAnthropic, DEFAULT_MODEL as DEFAULT_ANTHROPIC_MODEL } from "@/lib/anthropic"

/**
 * Pass-2 family-safety moderation for news stories.
 *
 * Run after the synthesis step but BEFORE persisting. The synthesis
 * model can produce a well-written story whose subject (slasher film
 * release, true-crime documentary) is fine for adults but unsuitable
 * for a family-context homepage. This pass classifies each candidate
 * into one of three audiences:
 *
 *   - "kid_safe"     — safe for children to glimpse on the homepage
 *   - "parent_only"  — fine for parents/adults but not kid-eyes
 *                      (true crime, war reporting, mature documentary)
 *   - "unsuitable"   — drop entirely (horror, gore, weird/disturbing)
 *
 * Xavier's brief: "I'm okay with articles that are not kid-friendly
 * but parent-friendly or adult-friendly, as long as it's not scary or
 * weird." → kid_safe + parent_only ship; unsuitable is dropped.
 *
 * Provider: DeepSeek V4-Flash by default (essentially free at this
 * volume — ~$0.001 per cron run for 10 stories). Falls back to Claude
 * Haiku if DeepSeek isn't configured.
 */

export type Audience = "kid_safe" | "parent_only" | "unsuitable"

export interface ModerationVerdict {
  audience: Audience
  reason: string
}

interface CandidateForModeration {
  title: string
  summary: string
  body: string
  category: string
}

const SYSTEM_PROMPT = `Tu es un modérateur de contenu pour un site familial français (Totem Avisé). Pour chaque article qu'on te présente, tu dois décider de son audience.

Trois verdicts possibles :

- **kid_safe** : un enfant qui passe devant l'écran ne sera pas perturbé. Annonces de films pour enfants, sorties d'anime, jeux vidéo grand public, conseils éducatifs, études jeunesse, événements culturels famille, sorties cinéma tous publics.

- **parent_only** : adapté aux parents qui lisent, mais pas du contenu à mettre sous les yeux d'un enfant. Documentaires sur sujets durs (violences éducatives, harcèlement scolaire, etc.), analyses sociologiques sérieuses, débats sur la parentalité, articles sur la santé mentale des ados. PAS de horreur, PAS de sang, PAS de bizarrerie — juste du contenu mature mais sain.

- **unsuitable** : à écarter. Horreur, gore, contenu choquant ou bizarre, true-crime sensationnaliste, contenu sexuel, polémiques sans valeur famille, articles avec un ton anxiogène ou alarmiste sans fondement.

Renvoie UNIQUEMENT du JSON sans markdown : { "audience": "kid_safe" | "parent_only" | "unsuitable", "reason": "phrase courte en français expliquant ton choix" }`

function buildUserPrompt(c: CandidateForModeration): string {
  return `Catégorie : ${c.category}
Titre : ${c.title}
Résumé : ${c.summary}

Corps :
${c.body}

Verdict ?`
}

async function callModerator(prompt: string): Promise<string> {
  // Try DeepSeek first; fall back to Anthropic if it fails or isn't
  // configured. Pass-2 should never block the cron — if moderation
  // can't run, we err on the side of letting the story through and
  // log the failure (see runModeration caller).
  if (isDeepSeekAvailable()) {
    const ds = getDeepSeek()
    const r = await ds.chat.completions.create({
      model: DEFAULT_DEEPSEEK_MODEL,
      max_tokens: 200,
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
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  })
  const block = r.content.find((c) => c.type === "text")
  return block && "text" in block ? (block as { text: string }).text : ""
}

function parseVerdict(raw: string): ModerationVerdict | null {
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
    const raw = await callModerator(buildUserPrompt(c))
    const verdict = parseVerdict(raw)
    if (verdict) return verdict
    // Unparseable response → fail-open as parent_only so the story
    // ships but doesn't get the kid_safe badge.
    return { audience: "parent_only", reason: "moderator response unparseable" }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "moderator error"
    return { audience: "parent_only", reason: `moderator failed: ${msg}` }
  }
}
