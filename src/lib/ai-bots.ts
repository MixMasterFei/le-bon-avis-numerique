/**
 * AI crawler / AI referrer detection — pure module, edge-safe (no DB, no Node
 * APIs) so the middleware can use it on every request.
 *
 * Two very different signals, one table:
 *  - "crawler"  = an AI bot fetching our pages server-side (GPTBot, ClaudeBot,
 *    PerplexityBot…). Plausible NEVER sees these (bots don't run JS), so
 *    without this logging we are blind to whether the /md layer and fiches
 *    are actually being consumed by answer engines.
 *  - "referral" = a human arriving FROM an AI assistant (chatgpt.com,
 *    perplexity.ai…). Plausible sees these too; logging them here keeps one
 *    unified AI-visibility dashboard.
 *
 * Day-aggregated in the ai_bot_hits table (see /api/track/ai-bot).
 */

export type AiHitKind = "crawler" | "referral"

export interface AiHit {
  kind: AiHitKind
  /** Normalized bot or assistant name, e.g. "GPTBot", "referral:chatgpt". */
  bot: string
}

// Ordered: more specific tokens first (e.g. "OAI-SearchBot" before "GPTBot"
// doesn't matter — tokens are disjoint — but keep live "answer" bots visually
// grouped ahead of training crawlers, mirroring robots.ts).
const AI_BOT_TOKENS: Array<[token: string, name: string]> = [
  // Live answer/search/browse bots
  ["oai-searchbot", "OAI-SearchBot"],
  ["chatgpt-user", "ChatGPT-User"],
  ["perplexity-user", "Perplexity-User"],
  ["perplexitybot", "PerplexityBot"],
  ["claude-searchbot", "Claude-SearchBot"],
  ["claude-user", "Claude-User"],
  ["claude-web", "Claude-Web"],
  ["mistralai-user", "MistralAI-User"],
  ["duckassistbot", "DuckAssistBot"],
  // Index / training crawlers
  ["gptbot", "GPTBot"],
  ["claudebot", "ClaudeBot"],
  ["ccbot", "CCBot"],
  ["google-extended", "Google-Extended"],
  ["applebot-extended", "Applebot-Extended"],
  ["meta-externalagent", "Meta-ExternalAgent"],
  ["bytespider", "Bytespider"],
  ["amazonbot", "Amazonbot"],
  ["cohere-ai", "Cohere"],
]

// Referrer hostnames of AI assistants (suffix-matched so subdomains count).
const AI_REFERRER_HOSTS: Array<[host: string, name: string]> = [
  ["chatgpt.com", "referral:chatgpt"],
  ["chat.openai.com", "referral:chatgpt"],
  ["perplexity.ai", "referral:perplexity"],
  ["gemini.google.com", "referral:gemini"],
  ["claude.ai", "referral:claude"],
  ["copilot.microsoft.com", "referral:copilot"],
  ["chat.mistral.ai", "referral:mistral"],
  ["you.com", "referral:you"],
  ["poe.com", "referral:poe"],
  ["duckduckgo.com", "referral:duckduckgo"],
]

export function detectAiBot(userAgent: string | null): AiHit | null {
  if (!userAgent) return null
  const ua = userAgent.toLowerCase()
  for (const [token, name] of AI_BOT_TOKENS) {
    if (ua.includes(token)) return { kind: "crawler", bot: name }
  }
  return null
}

export function detectAiReferrer(referer: string | null): AiHit | null {
  if (!referer) return null
  let host: string
  try {
    host = new URL(referer).hostname.toLowerCase()
  } catch {
    return null
  }
  for (const [suffix, name] of AI_REFERRER_HOSTS) {
    if (host === suffix || host.endsWith(`.${suffix}`)) {
      return { kind: "referral", bot: name }
    }
  }
  return null
}

/**
 * Coarse surface bucket so the table stays tiny (day × bot × kind × surface)
 * while still answering the questions that matter: "are they reading the md
 * layer?", "are fiches being crawled?", "did they find llms.txt?".
 */
export function classifyAiSurface(pathname: string): string {
  if (pathname === "/llms.txt") return "llms"
  if (pathname === "/md" || pathname.startsWith("/md/")) {
    if (pathname.startsWith("/md/media/")) return "md-fiche"
    if (pathname.startsWith("/md/selection")) return "md-selection"
    return "md"
  }
  if (pathname.startsWith("/media/")) return "fiche"
  if (pathname.startsWith("/jeux/quel-age")) return "games-hub"
  if (pathname.startsWith("/blog")) return "blog"
  if (pathname.startsWith("/guides")) return "guides"
  if (pathname === "/sitemap.xml" || pathname === "/robots.txt") return "seo-infra"
  if (pathname === "/") return "home"
  return "other"
}
