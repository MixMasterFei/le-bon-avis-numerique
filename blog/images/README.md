# Illustrations des articles

Tant qu'un article n'a pas d'illustration, le site affiche une **carte Totem provisoire**
(titre + catégorie, générée automatiquement par `/api/blog/card/<slug>`). Elle sert aussi
d'image de partage. On la remplace par une vraie image dès qu'elle est prête — y compris
après la publication.

## Remplacer la carte par une illustration

1. Générez l'image (par exemple avec ChatGPT) en suivant la charte plus bas.
2. Enregistrez-la dans ce dossier sous le nom de l'article :
   `blog/images/12-bon-age-film-enfant.png` (`.png`, `.jpg` ou `.webp`).
3. Ajoutez ces lignes au frontmatter de l'article (`blog/12-bon-age-film-enfant.md`) :

   ```yaml
   heroImage: "blog/images/12-bon-age-film-enfant.png"
   heroAlt: "Un parent et son enfant choisissent un film, assis sur un canapé"
   heroCredit: "Illustration générée par IA"
   ```

   - `heroAlt` est obligatoire : décrivez **ce que montre l'image** en une phrase, pas le titre.
   - `heroCredit` est affiché sous l'image. Ne citez pas l'outil (pas de « ChatGPT »), seulement « Illustration générée par IA ».
4. Vérifiez puis envoyez :

   ```bash
   npx tsx scripts/publish-blog.ts --publish --only 12 --dry-run
   npx tsx scripts/publish-blog.ts --publish --only 12
   ```

   Sur un article déjà en ligne, la date de publication est conservée : seule l'image
   (et le texte, s'il a changé) est mise à jour. Pour un article pas encore publié, sans
   `--publish`, l'image part dans le brouillon Studio.

Le cadrage fin se règle ensuite dans `/studio` (point focal de l'image principale).

## Format

- **Paysage, 1536 × 1024 px minimum** (ou 1792 × 1024). Fichier de moins de 3 Mo.
- Le site recadre la même image de trois façons : vignette 16:9, partage 1,91:1, bandeau
  très large en haut de l'article sur ordinateur. **Gardez le sujet dans la bande centrale**,
  rien d'important près des bords haut et bas.

## Charte à coller dans la demande

> Illustration éditoriale pour un magazine familial français, style dessin plat aux textures
> douces, lumière chaude. Palette : crème #F5F1E9, terracotta #D16A4A, vert sauge #5C8A5C,
> brun encre #1E1A15. Format paysage, sujet centré, espace libre autour. Aucun texte, aucune
> lettre, aucun chiffre, aucun logo, aucune marque. Écrans neutres : aucune interface ni image
> reconnaissable. Personnages non photoréalistes et non identifiables.

À éviter, toujours :

- les personnages, décors ou affiches de films et jeux existants (Coco, WALL-E, Kirby,
  Minecraft, Overcooked…) : leurs droits ne nous appartiennent pas ;
- les interfaces de vraies applications (Netflix, YouTube, TikTok, ChatGPT…) ;
- un enfant en détresse montré frontalement (cyberharcèlement, peur) : préférez le geste
  d'un adulte qui accompagne ;
- les pictogrammes d'âge ou de classification dessinés (ils deviendraient du texte faux).

## Pistes par article

| N° | Article | Idée de scène |
|---|---|---|
| 01 | Temps d'écran : des règles qui tiennent | Une cuisine le soir ; la famille prépare le repas, tablette et téléphones rangés sur une station de charge. |
| 02 | ChatGPT et devoirs | Un enfant à son bureau, cahier ouvert ; un parent assis à côté ; ordinateur portable entrouvert, écran neutre. |
| 03 | Réseaux sociaux avant 15 ans | Un ado et un parent côte à côte sur un banc, regardant ensemble un téléphone à l'écran vierge. |
| 04 | Films pour parler des émotions | Une famille sous un plaid devant un écran lumineux, reflets colorés sur les visages, livres sur la table basse. |
| 05 | Cyberharcèlement | Un parent assis au bord du lit d'un enfant, main posée sur son épaule ; téléphone retourné sur la couette. |
| 06 | Premier téléphone | Une boîte de téléphone ouverte sur la table ; parent et enfant cochent ensemble une liste sur papier. |
| 07 | Au-delà du compteur de minutes | Trois vignettes : un pliage en papier guidé par une vidéo, un épisode regardé à deux, un fil de vidéos qui défile. |
| 08 | Jeux vidéo en famille | Deux enfants et un parent sur un canapé, manettes en main, qui rient ; écran de télé abstrait. |
| 09 | Un film qui fait peur | Un enfant sous un plaid, regard un peu inquiet vers une lueur bleutée ; un parent à côté, télécommande à portée de main. |
| 10 | Réviser avec un écran | Un bureau d'enfant : tablette, cartes mémoire en papier, cahier et minuteur de cuisine. |
| 11 | Dessins animés pour les 3-6 ans | Un tout-petit sur les genoux d'un parent devant un petit écran ; pile d'albums jeunesse à côté. |
| 12 | À quel âge voir un film ? | Un parent et un enfant de 9 ans regardent ensemble une tablette au salon, bol de pop-corn entre eux. |
| 13 | Expliquer les recommandations | Parent et enfant, loupe à la main, devant un écran où des vignettes abstraites sont reliées par des fils lumineux. |
| 14 | Quel film ce soir ? | Une famille dans le salon qui hésite entre deux pochettes de films imaginaires sans texte, lumière du soir. |
| 15 | IA et ados | Un ado et un parent discutent à la table de la cuisine, un ordinateur portable entre eux avec une bulle de dialogue abstraite. |
