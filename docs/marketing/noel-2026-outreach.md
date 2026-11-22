# Noël 2026 : textes de contact (brouillons, rien n'a été envoyé)

Préparé par le Growth Scout le 22 novembre 2026. Tout est prêt à coller, mais **rien
n'est parti** : chaque envoi est une décision de Xavier.

Pages concernées (en ligne depuis le 21 novembre 2026) :

- https://totemavise.com/noel
- https://totemavise.com/noel/films-en-famille
- https://totemavise.com/noel/jeux-video-a-offrir

Règles suivies : pas de nom de service tiers, pas de superlatif, âges lus dans la base et
datés, aucune mention du CSA (le PEGI pour les jeux ; pour un film, « CNC au cinéma,
Arcom à la télévision »).

---

## (a) Note aux parents : « GTA VI : ce qu'il faut savoir avant de l'offrir »

**Source des chiffres.** Lus dans le catalogue Totem Avisé le **22 novembre 2026**
(fiche `57065822-8280-4fe1-9598-5ed442f4319c`) : classification `PEGI_18`, pictogrammes
PEGI « Violence, Sexualité, Drogues, Langage grossier, Achats intégrés », âge conseillé
Totem Avisé **18 ans**, plateformes PS5 et Xbox Series, sortie le 19 novembre 2026.
**Relire la fiche avant tout envoi** : si l'âge ou le PEGI a changé, corriger la note.

Liens :

- Fiche du jeu : https://totemavise.com/media/game:57065822-8280-4fe1-9598-5ed442f4319c
- Jeux vidéo, à partir de quel âge : https://totemavise.com/jeux/quel-age

Texte (environ 190 mots, liens non compris) :

> **GTA VI : ce qu'il faut savoir avant de l'offrir**
>
> Grand Theft Auto VI est sorti le 19 novembre 2026 sur PS5 et Xbox Series. À
> l'approche de Noël, de nombreux parents entendent la demande, souvent venue des
> camarades de classe.
>
> **La classification officielle.** Le jeu est classé PEGI 18, le niveau le plus élevé
> du système européen, qui désigne des jeux destinés aux adultes. Les pictogrammes
> imprimés sur la boîte signalent de la violence, de la sexualité, des drogues, un
> langage grossier et des achats intégrés.
>
> **L'âge conseillé par Totem Avisé.** Le guide familial indépendant Totem Avisé conseille
> ce jeu à partir de 18 ans, comme le PEGI. Ces deux informations ont été relevées le
> 22 novembre 2026 ; la fiche du jeu fait foi si elles évoluent :
> https://totemavise.com/media/game:57065822-8280-4fe1-9598-5ed442f4319c
>
> **Avant l'achat.** Le logo PEGI figure au dos de chaque boîte. Les consoles proposent
> un contrôle parental qui permet de bloquer les jeux au-dessus d'un âge choisi et de
> plafonner les dépenses.
>
> **Si la demande revient.** La page « Jeux vidéo : à partir de quel âge ? » donne, pour
> les jeux les plus réclamés, la classification PEGI, l'âge conseillé et les points à
> vérifier à la maison : https://totemavise.com/jeux/quel-age

Pour une newsletter d'APE ou de FCPE, le bloc peut être repris tel quel, sans le titre
en gras si la mise en page ne s'y prête pas. Ne pas ajouter de jugement sur le jeu : la
note s'en tient aux faits.

---

## (b) Courriel de présentation à la presse

À envoyer depuis `presse@totemavise.com`, une personne par rédaction, sans pièce jointe.

**Objets possibles (en choisir un) :**

1. GTA VI sous le sapin ? Le point PEGI pour vos lecteurs parents
2. Note prête à reprendre : GTA VI, PEGI 18, ce que les parents doivent savoir
3. Noël 2026 : les repères d'âge pour les jeux vidéo les plus demandés

**Corps :**

> Bonjour,
>
> GTA VI est sorti le 19 novembre et figure déjà sur des listes au Père Noël. Beaucoup
> de parents ne savent pas ce que recouvre sa classification PEGI 18.
>
> Nous avons rédigé une note factuelle d'environ 200 mots que vous pouvez reprendre librement,
> en tout ou en partie, avec un lien vers la source. Elle est copiée sous ce message.
>
> Totem Avisé est un guide français indépendant qui donne, pour chaque film, série et
> jeu vidéo, un âge conseillé et le détail de ce qui peut gêner un enfant. Notre méthode
> est publiée : https://totemavise.com/notre-methode
>
> Pour les fêtes, nous avons aussi rangé par âge des films de Noël et des idées de jeux à
> offrir : https://totemavise.com/noel
>
> Je reste à votre disposition pour toute précision.
>
> Bien cordialement,
> [Prénom Nom], Totem Avisé
> presse@totemavise.com
>
> [coller ici la note (a)]

---

## (c) Courriel de Noël aux membres

**À lire avant tout envoi.**

- **L'envoi est une décision de Xavier.** Ce texte ne part pas tant qu'il n'a pas dit oui.
- **Seuls les membres qui ont donné leur accord peuvent le recevoir.** Créer un compte
  n'est pas un consentement à recevoir des courriels de ce type : la table `users` n'a
  aucun champ d'accord marketing (vérifié dans `prisma/schema.prisma` le 22 novembre 2026).
  On n'écrit donc pas à « tous les inscrits ».
- **Liste à utiliser.** La seule liste à consentement du code est l'audience newsletter
  Resend désignée par `RESEND_NEWSLETTER_AUDIENCE_ID` (`src/lib/newsletter.ts`,
  alimentée par `POST /api/newsletter/subscribe`). L'inscription y est encore réservée aux
  administrateurs tant que `NEWSLETTER_PUBLIC` n'est pas à `"true"` : l'audience compte
  donc probablement très peu de contacts aujourd'hui. Vérifier le nombre dans le tableau de
  bord Resend avant d'écrire, et envoyer en « broadcast » vers cette audience, avec le lien
  de désinscription que Resend ajoute.
- Si Xavier veut toucher davantage de familles cette année, il faut d'abord ouvrir
  l'inscription (`NEWSLETTER_PUBLIC=true`) et proposer la case à cocher. Ce texte peut
  alors servir de premier envoi.

**Objet :** Noël en famille : nos repères par âge

**Pré-en-tête :** Films de Noël, sorties au cinéma et jeux vidéo à offrir, rangés selon
l'âge de vos enfants.

**Corps (environ 120 mots) :**

> Bonjour,
>
> Les vacances approchent, avec leurs soirées film et leurs paquets à préparer. Nous
> avons rassemblé nos repères pour Noël sur trois pages.
>
> **Films de Noël en famille, par âge** : des tout-petits aux ados, chaque film avec
> l'âge que nous conseillons et ce qui peut gêner.
> https://totemavise.com/noel/films-en-famille
>
> **Jeux vidéo à offrir, par âge** : des idées sur console actuelle, jamais rangées plus
> jeunes que leur PEGI.
> https://totemavise.com/noel/jeux-video-a-offrir
>
> **Noël en famille** : les deux listes, plus les films à l'affiche dont nous avons
> vérifié l'âge.
> https://totemavise.com/noel
>
> Chaque titre renvoie à sa fiche : la raison de l'âge retenu et ce qui peut gêner un
> enfant. Ces pages se mettent à jour d'elles-mêmes quand une fiche change. L'âge reste
> un repère : vous connaissez votre enfant mieux que personne.
>
> Bonnes fêtes,
> L'équipe Totem Avisé

---

## (d) Où proposer la note et les pages

Types de médias et de communautés, sans nom de personne. La colonne « Contact » dit si
un humain doit chercher l'interlocuteur.

| Cible | Pourquoi | Contact |
|---|---|---|
| Newsletters d'APE (associations de parents d'élèves locales) | Lues par les parents d'une école, souvent en manque de contenu avant les vacances | **Humain** : passer par les parents connus, l'ENT ou le site de l'école |
| Fédérations de parents d'élèves (FCPE, PEEP) : sites et bulletins départementaux | Relais vers les conseils locaux | **Humain** : chercher la page contact du comité départemental |
| UDAF / associations familiales locales | Ateliers parentalité numérique en fin d'année | **Humain** |
| Rubriques famille, parentalité ou « consommation » de la presse quotidienne régionale | Marronnier « quels jeux offrir à Noël » chaque année | **Humain** : chercher l'adresse de la rubrique, pas celle d'un journaliste au hasard |
| Magazines et sites parentalité nationaux | Dossiers cadeaux et écrans en décembre | **Humain** |
| Médias jeu vidéo grand public avec une rubrique pour les parents | Leurs lecteurs sont aussi des parents qui offrent | **Humain** |
| Radios locales (émissions du matin, conso, famille) | Format court, sujet de saison | **Humain** |
| Forums de parents (sections famille et enfants) | Questions « à partir de quel âge GTA ? » déjà posées | Pas de contact à trouver ; respecter les règles de chaque forum, répondre à une question existante plutôt que publier une annonce |
| Groupes Facebook de parents (écrans, jeux vidéo en famille) | Même demande | **Humain** : accord de l'administrateur avant de poster |
| Sous-forums francophones consacrés à la parentalité | Même demande | Règles d'autopromotion à lire avant de poster |
| Médiathèques et ludothèques (programmes de vacances) | Conseillent des jeux aux familles en décembre | **Humain** |
| Enseignants du primaire et du collège (groupes et listes de diffusion) | Relais vers les parents avant les vacances | **Humain** |
| Pédiatres, PMI, infirmiers scolaires (affichage, lettres d'information) | Public parent, prescripteurs de confiance | **Humain** ; démarche plus lente, viser surtout l'an prochain |

Rappel : pas de message identique copié dans dix groupes le même jour. Une réponse utile à
une question posée vaut mieux qu'une annonce.

---

## Après l'envoi

- Noter dans le tableau ci-dessus ce qui est parti, quand et à qui (la rédaction, pas la
  personne).
- Lire les visites des trois pages /noel et de la fiche GTA VI une semaine plus tard, avec
  la source et la date de la mesure.
