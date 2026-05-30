const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

export const revalidate = 86400

const MD_HEADERS = {
  "Content-Type": "text/markdown; charset=utf-8",
  "X-Robots-Tag": "noindex, follow",
  "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
} as const

export async function GET() {
  const body = `# Couche Markdown — Totem Avisé

Cette couche expose des versions Markdown propres des pages principales de Totem Avisé, lisibles par les agents et moteurs IA. Le contenu est généré à partir des mêmes sources que les pages HTML : pas d'édition parallèle, pas de dérive.

## Routes disponibles

- ${baseUrl}/md — cet index.
- ${baseUrl}/md/notre-methode — méthode d'évaluation (comment lire nos repères).
- ${baseUrl}/md/media/{routeId} — fiche média (films, séries, jeux vidéo, livres, applications).

## Format des identifiants média

Le segment \`{routeId}\` suit le format \`<type>:<id>\` (deux-points URL-encodé en \`%3A\`).

- \`movie:603\` → ${baseUrl}/md/media/movie:603
- \`tv:1399\` → ${baseUrl}/md/media/tv:1399
- \`game:12345\` → ${baseUrl}/md/media/game:12345
- \`book:abc-def\` → ${baseUrl}/md/media/book:abc-def

Types valides : \`movie\`, \`tv\`, \`game\`, \`book\`, \`app\`, \`manga\`.

## Découverte

L'URL de la page HTML équivalente est toujours indiquée par l'en-tête HTTP \`Link: <…>; rel="canonical"\` et par le champ \`URL canonique\` au début de chaque fichier Markdown.

Les réponses sont marquées \`X-Robots-Tag: noindex, follow\`. Cette couche n'est pas indexée par les moteurs et n'apparaît pas dans le sitemap : utilisez-la comme source de citation, pas comme cible à crawler exhaustivement.

## Hors périmètre actuel

Le blog (\`/blog/{slug}\`) et les guides parents (\`/guides\`) ne sont pas encore exposés en Markdown. La conversion fidèle du contenu éditorial est en cours d'évaluation.
`

  return new Response(body, { headers: MD_HEADERS })
}
