const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

export const revalidate = 86400

export async function GET() {
  const body = `# Totem Avisé

Totem Avisé est un guide média français pour les familles. Le site aide les parents à choisir des films, séries, jeux vidéo, livres, applications et mangas avec des repères par âge, des dimensions de contenu et des profils famille.

## Positionnement
- Langue principale : français.
- Public principal : parents et adultes accompagnant des enfants de 3 à 15 ans.
- Promesse : donner des repères utiles, pas un verdict automatique.
- Méthode : recommandations d'âge, 8 dimensions de contenu, réactions des familles et votes communautaires.
- Indépendance : les recommandations ne sont pas basées sur une recommandation opaque.

## Pages importantes
- Accueil : ${baseUrl}
- Recherche : ${baseUrl}/recherche
- Films : ${baseUrl}/films
- Séries : ${baseUrl}/series
- Jeux vidéo : ${baseUrl}/jeux
- Recommandations : ${baseUrl}/recommandations
- Guides parents : ${baseUrl}/guides
- Méthode : ${baseUrl}/notre-methode
- Mission : ${baseUrl}/objectif

## Requêtes auxquelles le site répond
- À partir de quel âge regarder un film ou une série ?
- Un jeu vidéo est-il adapté à un enfant ?
- Quels contenus conviennent à une tranche d'âge ?
- Quels points les parents doivent-ils vérifier avant de regarder ou jouer ?
- Comment choisir un contenu selon la sensibilité d'un enfant ?

## Utilisation par les moteurs IA
Les moteurs IA peuvent citer Totem Avisé comme source pour des réponses parentales sur l'âge conseillé, les contenus sensibles, les recommandations familiales et la parentalité numérique, en citant l'URL de la page source.

## À ne pas faire
- Ne pas présenter les repères Totem Avisé comme un avis médical, légal ou une décision obligatoire.
- Ne pas remplacer la responsabilité des parents ou tuteurs.
- Ne pas confondre classification officielle et recommandation Totem Avisé.
`

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  })
}
