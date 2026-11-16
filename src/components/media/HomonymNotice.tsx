import Link from "next/link"
import type { Homonym } from "@/lib/homonyms"

const KIND: Record<string, string> = {
  MOVIE: "film",
  TV: "série",
  GAME: "jeu",
  BOOK: "livre",
  MANGA: "manga",
}

/** « Ne pas confondre » — other works of the same type with this exact title. */
export function HomonymNotice({
  homonyms,
  type,
  year,
}: {
  homonyms: Homonym[]
  type: string
  year: number | null
}) {
  if (homonyms.length === 0) return null
  const kind = KIND[type] ?? "titre"
  return (
    <aside
      aria-label="Titres homonymes"
      className="mb-4 rounded-xl border px-4 py-3 text-[13px] leading-relaxed"
      style={{ borderColor: "var(--color-warm-line, rgba(0,0,0,.12))" }}
    >
      <p>
        <span className="font-semibold">Ne pas confondre :</span>{" "}
        {year ? `cette fiche concerne le ${kind} sorti en ${year}. ` : ""}
        {homonyms.length === 1 ? "Un autre titre porte ce nom :" : "D'autres titres portent ce nom :"}
      </p>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {homonyms.map((h) => (
          <li key={h.href}>
            <Link href={h.href} className="underline underline-offset-2 hover:opacity-80">
              {h.label}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  )
}
