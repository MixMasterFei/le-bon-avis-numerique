"use client"

import { useState, useRef, useCallback, useEffect } from "react"

// ── Types ──────────────────────────────────────────────────

export interface OperationProgress {
  processed: number
  total: number | null
  matched?: number
  updated?: number
  errors?: number
  skipped?: number
  chunks: number
}

export interface OperationResult {
  success: boolean
  summary: string
  stats: Record<string, number>
  completedAt: Date
  durationMs: number
  error?: string
}

export type OperationStatus = "idle" | "running" | "done" | "error"

export interface OperationConfig {
  /** Unique key for localStorage persistence */
  key: string
  /** API endpoint URL */
  endpoint: string
  /** HTTP method */
  method?: "POST" | "GET"
  /** JSON body for POST (if any) */
  body?: Record<string, unknown>
  /** Whether this operation loops in chunks until done */
  chunked: boolean
  /** Delay between chunks in ms */
  delayMs?: number
  /** Extract progress from a single API response */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractProgress: (data: any) => {
    processed: number
    total: number | null
    matched?: number
    updated?: number
    errors?: number
    skipped?: number
  }
  /** Build a summary string from accumulated stats */
  buildSummary: (stats: Record<string, number>) => string
  /** For chunked ops: determine if we're done */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isDone?: (data: any) => boolean
  /** For chunked ops: get next URL params (e.g. offset) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getNextParams?: (data: any, currentParams: URLSearchParams) => URLSearchParams | null
  /** Stat keys to accumulate across chunks */
  accumKeys?: string[]
  /** For the screenshots special case: detect rate limiting */
  detectRateLimit?: (data: Record<string, unknown>, consecutiveEmpty: number) => boolean
}

interface UseOperationReturn {
  run: () => void
  cancel: () => void
  status: OperationStatus
  progress: OperationProgress
  result: OperationResult | null
  elapsed: number
}

// ── localStorage helpers ───────────────────────────────────

function loadLastResult(key: string): OperationResult | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(`op_result_${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    parsed.completedAt = new Date(parsed.completedAt)
    return parsed
  } catch {
    return null
  }
}

function saveLastResult(key: string, result: OperationResult) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(`op_result_${key}`, JSON.stringify(result))
  } catch {
    // storage full or unavailable — ignore
  }
}

// ── Hook ───────────────────────────────────────────────────

async function readOperationResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    const preview = text.slice(0, 180).replace(/\s+/g, " ").trim()
    throw new Error(
      `API returned ${res.status} ${res.statusText || "non-JSON response"}: ${preview || "empty response"}`,
    )
  }
}

export function useOperation(config: OperationConfig): UseOperationReturn {
  const [status, setStatus] = useState<OperationStatus>("idle")
  const [progress, setProgress] = useState<OperationProgress>({
    processed: 0,
    total: null,
    chunks: 0,
  })
  const [result, setResult] = useState<OperationResult | null>(() =>
    loadLastResult(config.key)
  )
  const [elapsed, setElapsed] = useState(0)

  const cancelledRef = useRef(false)
  const startTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Elapsed timer
  const startTimer = useCallback(() => {
    startTimeRef.current = performance.now()
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((performance.now() - startTimeRef.current) / 1000))
    }, 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopTimer()
  }, [stopTimer])

  const cancel = useCallback(() => {
    cancelledRef.current = true
  }, [])

  const run = useCallback(async () => {
    cancelledRef.current = false
    setStatus("running")
    setProgress({ processed: 0, total: null, chunks: 0 })
    setResult(null)
    setElapsed(0)
    startTimer()

    const accum: Record<string, number> = {}
    let totalChunks = 0
    let lastTotal: number | null = null
    let consecutiveEmpty = 0

    try {
      if (config.chunked) {
        // ── Chunked operation: loop until done ──
        let params = new URLSearchParams()

        while (!cancelledRef.current) {
          const url = params.toString()
            ? `${config.endpoint}?${params.toString()}`
            : config.endpoint

          const fetchOptions: RequestInit = {
            method: config.method || "POST",
          }
          if (config.body) {
            fetchOptions.headers = { "Content-Type": "application/json" }
            fetchOptions.body = JSON.stringify(config.body)
          }

          const res = await fetch(url, fetchOptions)
          const data = await readOperationResponse(res)

          if (!res.ok || data.success === false) {
            throw new Error(typeof data.error === "string" ? data.error : `API error: ${res.status}`)
          }

          totalChunks++
          const chunkProgress = config.extractProgress(data)

          // Accumulate stats
          const keys = config.accumKeys || ["processed", "matched", "updated", "errors", "skipped"]
          for (const k of keys) {
            const val = (chunkProgress as Record<string, unknown>)[k]
            if (typeof val === "number") {
              accum[k] = (accum[k] || 0) + val
            }
          }

          if (chunkProgress.total !== null) {
            lastTotal = chunkProgress.total
          }

          setProgress({
            processed: accum.processed || 0,
            total: lastTotal,
            matched: accum.matched,
            updated: accum.updated,
            errors: accum.errors,
            skipped: accum.skipped,
            chunks: totalChunks,
          })

          // Rate limit detection (screenshots special case)
          if (config.detectRateLimit) {
            const imported = (chunkProgress as Record<string, unknown>).imported as number | undefined ?? chunkProgress.updated ?? 0
            if (imported === 0 && (chunkProgress.errors || 0) > 0) {
              consecutiveEmpty++
            } else {
              consecutiveEmpty = 0
            }
            if (config.detectRateLimit(data, consecutiveEmpty)) {
              // Treat as done with a warning
              accum._rateLimited = 1
              break
            }
          }

          // Check if done
          if (config.isDone?.(data)) break

          // Get next params
          if (config.getNextParams) {
            const nextParams = config.getNextParams(data, params)
            if (!nextParams) break
            params = nextParams
          }

          // Delay between chunks
          if (config.delayMs) {
            await new Promise((r) => setTimeout(r, config.delayMs))
          }
        }
      } else {
        // ── Single-call operation ──
        const fetchOptions: RequestInit = {
          method: config.method || "POST",
        }
        if (config.body) {
          fetchOptions.headers = { "Content-Type": "application/json" }
          fetchOptions.body = JSON.stringify(config.body)
        }

        const res = await fetch(config.endpoint, fetchOptions)
        const data = await readOperationResponse(res)

        if (!res.ok || data.success === false) {
          throw new Error(typeof data.error === "string" ? data.error : `API error: ${res.status}`)
        }

        totalChunks = 1
        const chunkProgress = config.extractProgress(data)
        const keys = config.accumKeys || ["processed", "matched", "updated", "errors", "skipped"]
        for (const k of keys) {
          const val = (chunkProgress as Record<string, unknown>)[k]
          if (typeof val === "number") {
            accum[k] = val
          }
        }
        if (chunkProgress.total !== null) lastTotal = chunkProgress.total

        setProgress({
          processed: accum.processed || 0,
          total: lastTotal,
          matched: accum.matched,
          updated: accum.updated,
          errors: accum.errors,
          skipped: accum.skipped,
          chunks: 1,
        })
      }

      // Done
      stopTimer()
      const durationMs = Math.floor(performance.now() - startTimeRef.current)
      const summary = config.buildSummary(accum)
      const opResult: OperationResult = {
        success: !accum._rateLimited && (accum.errors || 0) === 0,
        summary,
        stats: accum,
        completedAt: new Date(),
        durationMs,
      }
      if (accum._rateLimited) {
        opResult.error = "API externe : limite de requetes atteinte"
      }
      setResult(opResult)
      saveLastResult(config.key, opResult)
      setStatus(cancelledRef.current ? "idle" : (accum.errors && !accum.processed ? "error" : "done"))
    } catch (err) {
      stopTimer()
      const durationMs = Math.floor(performance.now() - startTimeRef.current)
      const errorMsg = err instanceof Error ? err.message : "Erreur inconnue"
      const opResult: OperationResult = {
        success: false,
        summary: config.buildSummary(accum),
        stats: accum,
        completedAt: new Date(),
        durationMs,
        error: errorMsg,
      }
      setResult(opResult)
      saveLastResult(config.key, opResult)
      setStatus("error")
    }
  }, [config, startTimer, stopTimer])

  return { run, cancel, status, progress, result, elapsed }
}
