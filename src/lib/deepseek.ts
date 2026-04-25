import OpenAI from "openai"

/**
 * DeepSeek API client. Reuses the OpenAI SDK because DeepSeek exposes
 * the OpenAI Chat Completions schema with a different baseURL — no
 * separate dependency needed.
 *
 * Pricing (as of 2026-04-21, while the launch discount runs until
 * 2026-05-05): V4-Flash $0.14 input / $0.28 output per MTok — roughly
 * 17× cheaper on output than Claude Haiku 4.5. Used for high-volume
 * jobs (news-discover) where the marginal quality gap doesn't justify
 * Claude's premium.
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

// V4-Flash is sufficient for news clustering/summarization. Bump to
// "deepseek-v4-pro" if a downstream task needs stronger reasoning.
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat"

export function isDeepSeekAvailable(): boolean {
  return !!process.env.DEEPSEEK_API_KEY
}
