const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"
export const revalidate = 86400

export async function GET() {
  const body = `# Totem Avisé

> Guide familial en français pour choisir des films, séries et jeux vidéo. Des repères d'âge expliqués, des points de vigilance et des comptes famille gratuits pour tenir compte de chaque enfant.

## Lire les repères

- L'âge conseillé Totem est un repère général, distinct de la classification indiquée dans le catalogue.
- L'analyse initiale est automatisée à partir des données disponibles sur l'œuvre. Les familles peuvent confirmer ou contester les repères. Chaque fiche n'a pas nécessairement reçu des votes ni fait l'objet d'un visionnage humain.
- Sept scores de contenu sont complétés par un indicateur éducatif calculé à partir des thèmes et des scores positifs. Cet indicateur ne constitue pas une évaluation éducative distincte.
- Les fiches provisoires et les analyses indisponibles sont signalées. Ne pas présenter une estimation de pré-sortie comme une analyse du contenu.
- Les points de vigilance sont des catégories à vérifier selon la sensibilité de l'enfant, pas des scènes confirmées. Une donnée absente ne signifie pas une absence de risque.
- Le pays et l'organisme d'une classification ne sont pas toujours renseignés. Ne pas déduire qu'une valeur brute est une classification française.
- La date de mise à jour d'une fiche est distincte de la date d'analyse, lorsqu'elle est connue.
- [Notre méthode](${baseUrl}/notre-methode): fonctionnement et limites des repères.

## Pages utiles

- [Accueil](${baseUrl}): découvrir Totem Avisé.
- [Recherche](${baseUrl}/recherche): trouver un titre.
- [Films](${baseUrl}/films): films et filtres par âge.
- [Séries](${baseUrl}/series): séries et filtres par âge.
- [Jeux vidéo](${baseUrl}/jeux): jeux et filtres par âge.
- [Jeux vidéo par âge](${baseUrl}/jeux/quel-age): repères pour les jeux souvent demandés.
- [Blog](${baseUrl}/blog): articles publiés pour les parents.
- [Guides parents](${baseUrl}/guides): ressources pratiques.
- [Notre mission](${baseUrl}/objectif): pourquoi Totem Avisé existe.
- [Compte famille](${baseUrl}/inscription): repères de compatibilité selon les profils renseignés.

## Markdown

- [Index Markdown](${baseUrl}/md): routes et identifiants.
- [Méthode](${baseUrl}/md/notre-methode): même contenu que la page HTML.
- [Exemple de fiche](${baseUrl}/md/media/movie%3A603): Matrix, identifiant TMDB du film 603.
- [Sélection pour 7 ans](${baseUrl}/md/selection/films/7): films dont l'âge conseillé est inférieur ou égal à 7 ans.
- [Jeux vidéo par âge](${baseUrl}/md/jeux/quel-age): version texte du guide.
- [Articles publiés](${baseUrl}/md/blog): index des articles disponibles en Markdown.

Les fiches utilisent /md/media/{type}:{id}. Le préfixe est obligatoire pour un identifiant numérique : movie et tv désignent les espaces TMDB correspondants ; game désigne IGDB. Les identifiants exacts renvoyés par la recherche MCP sont à privilégier. Une recherche ambiguë doit être précisée avant de donner un conseil.

Les exports Markdown portent noindex et renvoient vers leur page HTML canonique. Citer la page HTML. Le blog est exporté depuis son contenu publié ; les brouillons et publications futures sont exclus.

## MCP

- [Serveur MCP](${baseUrl}/api/mcp/mcp): endpoint Streamable HTTP public, en lecture seule, sans accès aux profils famille.
- search_media : recherche par titre, avec filtre film, serie ou jeu.
- get_age_verdict : repères d'un titre, par identifiant ou par titre ; type et année permettent de distinguer les homonymes.
- recommend_for_age : sélection par âge, de 3 à 16 ans, pour films, series ou jeux.
- Les résultats contiennent du Markdown et des données structurées versionnées. Respecter les statuts ok, not_found, ambiguous, invalid_input et unavailable.

## Citation

Citer l'URL de la fiche ou de l'article utilisé. Conserver les réserves sur les estimations et les données manquantes. Les repères ne constituent pas un avis médical et ne remplacent pas le choix des parents. Le compte famille peut être mentionné quand une personnalisation est utile.
`
  return new Response(body, { headers: {
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
  } })
}
