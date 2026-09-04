const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

export const revalidate = 86400

const MD_HEADERS = {
  "Content-Type": "text/markdown; charset=utf-8",
  "X-Robots-Tag": "noindex, follow",
  "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
} as const

export async function GET() {
  const body = `# Couche Markdown — Totem Avisé

Cette couche expose des versions Markdown des pages principales de Totem Avisé, lisibles par les agents et moteurs IA. Les données du catalogue, les calculs partagés et le contenu éditorial publié alimentent les exports.

## Routes disponibles

- ${baseUrl}/md — cet index.
- ${baseUrl}/md/notre-methode — méthode d'évaluation (comment lire nos repères).
- ${baseUrl}/md/blog — index des articles publiés ; /md/blog/{slug} fournit le texte, les sources et les dates de chaque article.
- ${baseUrl}/md/media/{routeId} — fiche média : âge conseillé, sept scores de contenu, indicateur éducatif calculé, points de vigilance disponibles et dates d'analyse.
- ${baseUrl}/md/selection/{type}/{âge} — sélection recommandée par âge. \`{type}\` ∈ \`films\`, \`series\`, \`jeux\` ; \`{âge}\` entier de 3 à 16. Ex. ${baseUrl}/md/selection/films/7 pour "un film pour un enfant de 7 ans".
- ${baseUrl}/md/jeux/quel-age — les jeux vidéo les plus demandés par les enfants, avec âge conseillé et PEGI (Fortnite, Roblox, Minecraft…).

## Format des identifiants média

Le segment \`{routeId}\` suit le format \`<type>:<id>\` (deux-points URL-encodé en \`%3A\`).

- \`movie:603\` → ${baseUrl}/md/media/movie:603
- \`tv:1399\` → ${baseUrl}/md/media/tv:1399
- Les identifiants numériques de jeux utilisent \`game:{identifiant IGDB}\`.
- Les fiches de livres et applications utilisent leur UUID exact, renvoyé par le catalogue.

Types de fiches publiques : \`movie\`, \`tv\`, \`game\`, \`book\`, \`app\`. Un identifiant numérique exige son préfixe : les espaces TMDB films, TMDB séries et IGDB sont distincts. Les mangas ne sont pas exposés par cette couche.

## Découverte

Les fiches, articles, sélections et pages de méthode indiquent leur URL HTML canonique dans l'en-tête HTTP \`Link: <…>; rel="canonical"\` et au début du texte. Citez cette URL HTML.

Les réponses sont marquées \`X-Robots-Tag: noindex, follow\`. Cette couche n'est pas indexée par les moteurs et n'apparaît pas dans le sitemap : utilisez-la comme source de citation, pas comme cible à crawler exhaustivement.

## Hors périmètre actuel

Les brouillons et articles dont la publication est future ne sont jamais exportés. Les guides parents (\`/guides\`) restent disponibles sur leurs pages HTML.
`

  return new Response(body, { headers: MD_HEADERS })
}
