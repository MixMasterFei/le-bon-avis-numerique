/**
 * Blog categories — one list for the Sanity schema (Studio dropdown), the
 * public labels (cards, article header, JSON-LD articleSection), the branded
 * fallback hero card and the markdown importer's validation.
 *
 * The `value` is what Sanity stores on each post: never rename one without
 * migrating the posts that use it.
 */
export const BLOG_CATEGORIES = [
  { value: "temps-ecran", title: "Temps d'écran" },
  { value: "films-series", title: "Films & séries" },
  { value: "jeux-video", title: "Jeux vidéo" },
  { value: "parentalite-numerique", title: "Parentalité numérique" },
  { value: "guides-pratiques", title: "Guides pratiques" },
  { value: "actualites", title: "Actualités" },
] as const

export type BlogCategory = (typeof BLOG_CATEGORIES)[number]["value"]

const LABELS = new Map<string, string>(BLOG_CATEGORIES.map((c) => [c.value, c.title]))

export function isBlogCategory(value: string | null | undefined): value is BlogCategory {
  return typeof value === "string" && LABELS.has(value)
}

/** French label for a stored category value; unknown values are shown as-is. */
export function blogCategoryLabel(value: string | null | undefined): string {
  if (!value) return "Conseils"
  return LABELS.get(value) ?? value
}
