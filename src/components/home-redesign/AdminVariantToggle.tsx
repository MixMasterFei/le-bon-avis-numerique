import Link from "next/link"

/**
 * Admin-only chip to flip between the V2 redesign and the classic homepage.
 * Rendered by page.tsx in both branches (only for admins). Bottom-center to
 * avoid the global Totem dock (bottom-right) and the V2 family nudge (left).
 */
export function AdminVariantToggle({ variant }: { variant: "v2" | "classic" }) {
  const toV2 = variant === "classic"
  return (
    <Link
      href={toV2 ? "/" : "/?v=classic"}
      className="fixed bottom-4 left-1/2 z-[70] inline-flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold shadow-lg"
      style={{ background: "var(--color-card)", color: "var(--color-ink)", border: "1px solid var(--color-line2)" }}
    >
      <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: "var(--color-accent)" }}>
        Admin
      </span>
      {toV2 ? "Voir la nouvelle page →" : "Revenir à l'ancienne page"}
    </Link>
  )
}
