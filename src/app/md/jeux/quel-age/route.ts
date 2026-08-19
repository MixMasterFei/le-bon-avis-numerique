import { fetchTopGameRows } from "@/app/jeux/quel-age/gamesAgeData"
import { toMediaRouteId } from "@/lib/media-route"
import { buildQuickAnswer } from "@/lib/quick-answer"
import { getOfficialRatingDisplay } from "@/lib/utils"

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

// Request-time rendered, CDN-cached via s-maxage below. NOT `revalidate`:
// this is the md layer's only STATIC route handler that queries the DB, so
// ISR would make Next prerender it at build time — which breaks the CI
// build (no database in CI). The dynamic-segment md routes don't have this
// problem; this one must opt out explicitly.
export const dynamic = "force-dynamic"

// Markdown mirror of the games "À partir de quel âge ?" pillar — the unowned
// "fortnite quel âge / roblox quel âge" query class. Same data source and the
// same shared verdict builder as the HTML page: zero drift.
export async function GET() {
  let rows
  try {
    rows = await fetchTopGameRows()
  } catch (error) {
    console.error("[md/jeux/quel-age] DB query failed:", error instanceof Error ? error.message : error)
    return new Response("Temporairement indisponible", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "300" },
    })
  }
  const htmlUrl = `${baseUrl}/jeux/quel-age`

  const lines: string[] = []
  lines.push(`# Jeux vidéo : à partir de quel âge ?`, "")
  lines.push(`URL canonique: ${htmlUrl}`)
  lines.push(`Langue: français`)
  lines.push("")
  lines.push(
    "Les jeux que les enfants réclament le plus par leur nom. Pour chacun : " +
      "l'âge conseillé par Totem Avisé (repère indépendant qui tient compte du jeu en ligne, " +
      "du chat, des achats intégrés), la classification PEGI officielle et les points à vérifier. " +
      "PEGI indique un âge légal selon le contenu ; l'âge Totem Avisé est un repère de parentalité — les deux se complètent.",
    "",
  )

  for (const r of rows) {
    const canonical = `${baseUrl}/media/${toMediaRouteId("GAME", r.id)}`
    const pegi = getOfficialRatingDisplay(r.officialRating, "GAME")
    const qa = r.contentMetrics
      ? buildQuickAnswer({
          title: r.seed.name,
          type: "GAME",
          expertAgeRec: r.expertAgeRec,
          contentMetrics: r.contentMetrics,
        })
      : null

    lines.push(`## ${r.seed.name}`, "")
    if (r.expertAgeRec != null) lines.push(`Âge conseillé Totem: dès ${r.expertAgeRec} ans`)
    if (pegi?.label) lines.push(`Classification officielle: ${pegi.label}`)
    lines.push(`Fiche complète: ${canonical}`)
    lines.push("")
    lines.push(r.seed.parentNote, "")
    if (qa) lines.push(qa.sensitiveText, "")
    // Named mechanics and settings — the citable part for answer engines,
    // and the reason this page is worth quoting over a bare PEGI number.
    if (r.seed.familyIssues?.length) {
      lines.push("Points concrets pour les familles :", "")
      for (const issue of r.seed.familyIssues) lines.push(`- ${issue}`)
      lines.push("")
    }
  }

  lines.push("## Adapter ces repères à votre enfant", "")
  lines.push(
    `L'âge conseillé est une moyenne : un compte famille gratuit sur Totem Avisé permet d'obtenir, ` +
      `pour chaque jeu, un score de compatibilité personnalisé selon l'âge et les sensibilités de chaque enfant (${baseUrl}/inscription).`,
    "",
  )

  lines.push("## Pages liées", "")
  lines.push(`- [Version complète avec visuels](${htmlUrl})`)
  lines.push(`- [Tous les jeux vidéo](${baseUrl}/jeux)`)
  lines.push(`- [Notre méthode](${baseUrl}/notre-methode)`)
  lines.push("")

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Robots-Tag": "noindex, follow",
      "Link": `<${htmlUrl}>; rel="canonical"`,
      // s-maxage: the CDN does the hourly caching that `revalidate` used to
      // (the route is force-dynamic — see note at the top).
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
