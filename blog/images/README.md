# Images des articles

Tant qu'un article n'a pas d'image, le site affiche une **carte Totem provisoire**
(titre + catégorie, générée automatiquement par `/api/blog/card/<slug>`). Elle sert aussi
d'image de partage. On la remplace par une vraie image dès qu'elle est prête — y compris
après la publication.

## Produire les images

La demande complète à donner à ChatGPT est dans
[`demande-images-gpt.md`](./demande-images-gpt.md) : style commun, règles (aucun visage,
aucun texte, aucun logo, écrans neutres), format 1536 × 1024 et une scène par article,
avec le nom de fichier attendu. Elle demande aussi un `descriptions.md` (une phrase
factuelle par image) qui sert de base aux textes alternatifs.

## Brancher une image sur un article

1. Déposer l'image dans ce dossier sous le nom prévu, par exemple
   `blog/images/12-bon-age-film-enfant.png` (`.png`, `.jpg` ou `.webp`, moins de 3 Mo).
2. Vérifier qu'elle respecte les règles de la demande : aucun visage, aucun texte, aucun
   logo, aucun écran reconnaissable.
3. Ajouter ces lignes au frontmatter de l'article (`blog/12-bon-age-film-enfant.md`) :

   ```yaml
   heroImage: "blog/images/12-bon-age-film-enfant.png"
   heroAlt: "Vue de dos, un adulte et un enfant choisissent un film sur une tablette"
   heroCredit: "Image générée par IA"
   ```

   - `heroAlt` est obligatoire : il décrit **ce que montre l'image** en une phrase, pas le titre.
   - `heroCredit` est affiché sous l'image. Ne citez pas l'outil (pas de « ChatGPT »).
4. Vérifier puis envoyer :

   ```bash
   npx tsx scripts/publish-blog.ts --publish --only 12 --dry-run
   npx tsx scripts/publish-blog.ts --publish --only 12
   ```

   Sur un article déjà en ligne, la date de publication est conservée : seule l'image
   (et le texte, s'il a changé) est mise à jour. Pour un article pas encore publié, sans
   `--publish`, l'image part dans le brouillon Studio.

Le cadrage fin se règle ensuite dans `/studio` (point focal de l'image principale).

## Recadrages

Le site recadre la même image de trois façons : vignette 16:9 sur `/blog`, image de
partage 1,91:1, et bandeau très large en haut de l'article sur ordinateur. Le sujet doit
donc rester dans la bande centrale, comme le précise la demande.
