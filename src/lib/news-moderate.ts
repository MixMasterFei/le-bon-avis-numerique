import { getAnthropic, DEFAULT_MODEL as DEFAULT_ANTHROPIC_MODEL } from "@/lib/anthropic"
import { callClaudeWithTimeout } from "@/lib/anthropic-with-timeout"

/**
 * Pass-2 family-safety moderation for news stories.
 *
 * Single-provider Claude Haiku 4.5, text-only (May 2026 redesign).
 * The previous 3-path cascade (OpenAI gpt-5-mini vision → DeepSeek
 * V4-Flash → Claude Haiku) was the source of recurring stalls — when
 * OpenAI hung, the entire run blocked because no per-call timeout
 * existed. Vision moderation is overkill given that we now only use
 * agency + publisher-RSS images (legally vetted by the publishers
 * themselves). Title + summary text moderation catches the editorial
 * red flags we actually care about (horror, true-crime, weird).
 *
 * Audience verdicts:
 *   - "kid_safe"    → ok for a child glancing at the homepage
 *   - "parent_only" → ok for parents/adults, not for kid-eyes
 *   - "unsuitable"  → drop entirely (horror, gore, weird, disturbing)
 *
 * Per-call timeout: 30s. Fail-CLOSED: any timeout / error / unparseable
 * reply → "unsuitable" (the story is dropped, not shipped). An unmoderated
 * story must never reach the family feed just because the moderator had an
 * infra hiccup; the cron still completes (only that one story is skipped),
 * and news is plentiful, so dropping one is cheap insurance.
 */

export type Audience = "kid_safe" | "parent_only" | "unsuitable"

export interface ModerationVerdict {
  audience: Audience
  reason: string
  // Kept for back-compat with the call sites that read this — always
  // false now that we no longer run vision moderation.
  visionUsed: boolean
}

interface CandidateForModeration {
  title: string
  summary: string
  body: string
  category: string
  imageUrl?: string
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

const MODERATION_TIMEOUT_MS = 30_000

export async function moderateStory(c: CandidateForModeration): Promise<ModerationVerdict> {
  const anthropic = getAnthropic()
  const text = await callClaudeWithTimeout(
    async (signal) => {
      const r = await anthropic.messages.create(
        {
          model: DEFAULT_ANTHROPIC_MODEL,
          max_tokens: 200,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildUserPrompt(c) }],
        },
        { signal },
      )
      const block = r.content.find((b) => b.type === "text")
      return block && "text" in block ? (block as { text: string }).text : ""
    },
    MODERATION_TIMEOUT_MS,
    "moderate-story",
  )

  if (text === null) {
    // Timeout / network error — fail CLOSED (drop), never ship unmoderated.
    return { audience: "unsuitable", reason: "moderator timed out — failed closed", visionUsed: false }
  }
  const verdict = parseVerdict(text)
  if (verdict) return { ...verdict, visionUsed: false }
  // Unparseable — fail CLOSED (drop).
  return { audience: "unsuitable", reason: "moderator response unparseable — failed closed", visionUsed: false }
}
