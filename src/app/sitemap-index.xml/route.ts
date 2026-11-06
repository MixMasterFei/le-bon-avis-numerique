import { buildSitemapIndex } from "@/lib/sitemap"

// Served at /sitemap.xml through a rewrite (next.config.ts) — the URL that
// robots.txt and Search Console already know. It cannot be a file at
// app/sitemap.xml: Turbopack reserves that path for app/sitemap.ts, and a
// prerendered /sitemap.xml is exported as a static file that never
// regenerates (see src/lib/sitemap.ts). Under this name it is a normal ISR
// route, refreshed hourly.
export const revalidate = 3600

export async function GET() {
  return new Response(await buildSitemapIndex(), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  })
}
