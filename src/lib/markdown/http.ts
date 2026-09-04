export function markdownUnavailable(): Response {
  return new Response("Contenu temporairement indisponible. Réessayez dans un instant.", {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": "60",
      "X-Robots-Tag": "noindex, follow",
    },
  })
}
