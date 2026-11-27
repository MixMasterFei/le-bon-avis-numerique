import Link from "next/link"
import { toMediaRouteId, type MediaType } from "@/lib/media-route"
import { getMediaVersions } from "@/lib/media-versions"

// « Autres versions et suites » on a fiche: the titles an editor tied to this
// one as the same work (src/lib/media-versions.ts). Server component, so the
// links are in the crawled HTML; low on the page, next to « Titres
// similaires », and the callers wrap it in <Suspense>. Each entry shows its
// own age — no « younger or equal » filter here, on purpose.

const PALETTES = {
  classic: {
    card: "var(--color-warm-card)",
    line: "var(--color-warm-line)",
    ink: "var(--color-warm-ink)",
    ink2: "var(--color-warm-ink2)",
    accent: "var(--color-warm-accent)",
  },
  v3: {
    card: "var(--f-card)",
    line: "var(--f-border)",
    ink: "var(--f-ink)",
    ink2: "var(--f-muted)",
    accent: "var(--f-accent)",
  },
} as const

export async function MediaVersions({
  mediaId,
  title,
  variant = "classic",
  className,
}: {
  mediaId: string
  title: string
  variant?: keyof typeof PALETTES
  className?: string
}) {
  const block = await getMediaVersions(mediaId, title)
  if (!block) return null

  const c = PALETTES[variant]
  return (
    <section
      data-testid="media-versions"
      aria-labelledby="media-versions-heading"
      className={`rounded-2xl p-5 sm:p-6 ${className ?? ""}`}
      style={{ background: c.card, border: `1px solid ${c.line}` }}
    >
      <h2
        id="media-versions-heading"
        className={variant === "v3" ? "font-serif text-lg font-medium mb-3" : "font-serif text-xl md:text-2xl font-medium mb-4"}
        style={{ color: c.ink, letterSpacing: "-0.02em" }}
      >
        {block.heading}
      </h2>
      <ul className="flex flex-col gap-2">
        {block.items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/media/${toMediaRouteId(item.type as MediaType, item.id)}`}
              className="text-[15px] underline-offset-2 hover:underline"
              style={{ color: c.ink }}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
