import Anthropic from "@anthropic-ai/sdk"

let _client: Anthropic | null = null

export function getAnthropic(): Anthropic {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) {
      throw new Error("ANTHROPIC_API_KEY is not configured")
    }
    _client = new Anthropic({ apiKey: key })
  }
  return _client
}

export const DEFAULT_MODEL = "claude-sonnet-4-6"
