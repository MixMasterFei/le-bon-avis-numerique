import type { MetadataRoute } from "next"
import { SITEMAP_IDS, buildSitemap } from "@/lib/sitemap"

// ISR: each section is regenerated in the background at most every 6 h —
// picks up new cron imports. This only works BECAUSE the sitemap is split:
// a single prerendered /sitemap.xml is shipped as a static file that never
// regenerates (see src/lib/sitemap.ts). The index lives at
// app/sitemap-index.xml and is served at /sitemap.xml by a rewrite.
export const revalidate = 21600

// → /sitemap/pages.xml, /sitemap/films.xml, /sitemap/series.xml, /sitemap/jeux.xml
export async function generateSitemaps() {
  return SITEMAP_IDS.map((id) => ({ id }))
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  return buildSitemap(await props.id)
}
