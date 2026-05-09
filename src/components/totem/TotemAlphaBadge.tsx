import { cn } from "@/lib/utils"

export interface TotemAlphaBadgeProps {
  variant?: "compact" | "full"
  className?: string
}

export function TotemAlphaBadge({ variant = "full", className }: TotemAlphaBadgeProps) {
  if (variant === "compact") {
    return (
      <span
        aria-label="Phase Alpha"
        title="Phase Alpha"
        className={cn(
          "inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white shadow-sm",
          className,
        )}
      >
        α
      </span>
    )
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700",
        className,
      )}
    >
      <span aria-hidden>α</span>
      <span>Phase Alpha</span>
    </span>
  )
}
