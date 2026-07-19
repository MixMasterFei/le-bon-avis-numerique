"use client"

import Link from "next/link"
import { Hourglass } from "lucide-react"

export interface TotemRateLimitProps {
  retryAfterSec: number
  isAuthenticated: boolean
  /** Server-provided copy (daily cap / repos global); falls back to the hourly-limit line. */
  message?: string
}

function formatRetry(s: number): string {
  if (s < 60) return `${s} s`
  if (s < 3600) return `${Math.ceil(s / 60)} min`
  return `${Math.ceil(s / 3600)} h`
}

export function TotemRateLimit({ retryAfterSec, isAuthenticated, message }: TotemRateLimitProps) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <Hourglass className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        {message ? (
          <p>{message}</p>
        ) : (
          <p>
            On a beaucoup échangé — laissez-moi souffler. Reposez votre question
            dans <strong>{formatRetry(retryAfterSec)}</strong>.
          </p>
        )}
        {/* Signup nudge only for the hourly limit — under a daily/global
            cap a new account wouldn't change anything, so don't imply it. */}
        {!isAuthenticated && !message && (
          <p className="text-xs">
            Avec un compte, j&apos;ai plus de souffle.{" "}
            <Link href="/inscription" className="font-semibold underline">
              Créer un compte
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  )
}
