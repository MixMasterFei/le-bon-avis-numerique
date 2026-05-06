/**
 * Per-call timeout wrapper used by every Claude call site in the news
 * pipeline (moderation, research, quality-judge, catalog-verify). The
 * news-discover Lambda has a 300s ceiling and previously each LLM call
 * inherited that — a single stuck call could starve the rest of the
 * pipeline. This wrapper bounds each call to its own deadline and
 * returns null on timeout / error so callers can fail-open uniformly.
 *
 * Usage:
 *
 *   const result = await callClaudeWithTimeout(
 *     (signal) => anthropic.messages.create({ ... }, { signal }),
 *     30_000,
 *     "moderate-story",
 *   )
 *   if (!result) return defaultVerdict()
 */
export async function callClaudeWithTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fn(ctrl.signal)
  } catch (err) {
    if (ctrl.signal.aborted) {
      console.warn(`[${label}] aborted on ${timeoutMs}ms timeout`)
    } else {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[${label}] failed:`, msg)
    }
    return null
  } finally {
    clearTimeout(timer)
  }
}
