"use client"

import { useSession } from "next-auth/react"

/**
 * "Connecté · Famille X" indicator shown next to the Réponse rapide kicker,
 * mirroring the prototype. Renders nothing when logged out (the generic
 * answer then spans full width on its own).
 */
export function AccountChip() {
  const { data: session } = useSession()
  if (!session?.user) return null

  const name =
    session.user.name?.split(" ")[0] || session.user.email?.split("@")[0] || ""

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold"
      style={{
        background: "var(--color-warm-bg)",
        border: "1px solid var(--color-warm-line)",
        color: "var(--color-warm-ink2)",
      }}
    >
      <span
        className="inline-block h-[7px] w-[7px] rounded-full"
        style={{ background: "#5C8A66", boxShadow: "0 0 0 3px #E7EFE7" }}
      />
      Connecté{name ? ` · Famille ${name}` : ""}
    </span>
  )
}
