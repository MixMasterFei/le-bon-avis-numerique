"use client"

import { AlertCircle, RotateCcw } from "lucide-react"

export interface TotemErrorProps {
  onRetry: () => void
}

export function TotemError({ onRetry }: TotemErrorProps) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <p>Désolé, je me suis emmêlé les pinceaux. Pouvez-vous reformuler ?</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-red-700"
        >
          <RotateCcw className="h-3 w-3" />
          Réessayer
        </button>
      </div>
    </div>
  )
}
