import Link from "next/link"

/**
 * Admin-only chip to flip between the V2 redesign and the classic page.
 * Rendered (only for admins) on both the homepage and the catalogue V2/classic
 * branches. Bottom-center to avoid the global Totem dock (bottom-right) and the
 * V2 family nudge (left).
 *
 * Route-aware: pass `route` (e.g. "/films") and the page's `currentQuery`
 * (filter/pagination params, no leading "?") so toggling preserves the user's
 * filters + page and only flips the `v` param.
 */
export function AdminVariantToggle({
  variant,
  route = "/",
  currentQuery = "",
}: {
  variant: "v2" | "classic"
  route?: string
  currentQuery?: string
}) {
  const toV2 = variant === "classic"

  const sp = new URLSearchParams(currentQuery)
  if (toV2) {
    // Going to V2 = remove the classic override.
    sp.delete("v")
  } else {
    // Going to classic = force the override, keep everything else.
    sp.set("v", "classic")
  }
  const qs = sp.toString()
  const href = qs ? `${route}?${qs}` : route

  return (
    <Link
      href={href}
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
