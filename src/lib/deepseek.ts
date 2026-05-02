import OpenAI from "openai"

/**
 * DeepSeek API client. Reuses the OpenAI SDK because DeepSeek exposes
 * the OpenAI Chat Completions schema with a different baseURL — no
 * separate dependency needed.
 *
 * Pricing as of 2026-05:
 *   V4-Flash: $0.14 input / $0.28 output per MTok
 *   V4-Pro:   $0.435 input / $0.87 output per MTok (standard)
 *             — currently 75% off until 2026-05-31, ~$0.109 / $0.218
 *             during promo, basically same cost as Flash
 *
 * Docs: https://api-docs.deepseek.com/
 */

const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"

let _client: OpenAI | null = null

export function getDeepSeek(): OpenAI {
  if (!_client) {
    const key = process.env.DEEPSEEK_API_KEY
    if (!key) {
      throw new Error("DEEPSEEK_API_KEY is not configured")
    }
    _client = new OpenAI({ apiKey: key, baseURL: DEEPSEEK_BASE_URL })
  }
  return _client
}

// V4-Flash is sufficient for clustering / summarization on
// cost-sensitive paths (moderation, quality judge, research extract).
// Used as the general-purpose default.
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat"

// V4-Pro (1.6T params total / 49B activated MoE) — used specifically
// for news-discover synthesis where writing quality is user-visible
// and cheap V4-Flash prose was judged insufficient. ~3x the cost of
// Flash at standard rate (negligible at our news volume), and during
// the May-2026 promo window it costs the same as Flash.
export const SYNTHESIS_MODEL = "deepseek-v4-pro"

export function isDeepSeekAvailable(): boolean {
  return !!process.env.DEEPSEEK_API_KEY
}
