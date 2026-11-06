# Registre des agents : note de relecture pour Xavier

> Branche `claude/blissful-cori-knkti4`, à jour de `main` (sortie #107) au 6 novembre 2026.
> Vérifications sur la branche fusionnée : types OK, 1 299 tests OK, lint sans erreur.
> **Rien n'est en ligne.** La migration 015 est déjà passée en production (tes trois
> nouvelles tables existent), mais elles sont **vides** et le site actuel ne s'en sert pas.
> Rien ne bouge tant que tu n'as pas fusionné.

---

## En deux phrases

Aujourd'hui, les agents automatiques écrivent sur le site sans que tu puisses dire « non »
ou « annule ». Avec ce registre, chaque écriture d'un agent est notée avec son
explication et son coût, et tu règles, type d'action par type d'action, ce qu'un agent a
le droit de faire seul. Tu n'as plus à déclencher les tâches : tu tranches.

---

## Ce qui change le jour de la fusion

**Pour les visiteurs du site : rien.** Aucune page publique ne change.

**Pour toi :**

1. **Une nouvelle section « Agents »** en haut de `/admin/operations` (lien « Agents » dans
   la barre de sections). Décrite plus bas.
2. **Le mail SEO du jeudi** renvoie désormais vers ce panneau, et compte les propositions
   qui t'attendent.
3. **Le digest du mercredi** (« Dette technique & données ») gagne une ligne
   « Agents : N proposition(s) à valider · M écriture(s) à relire », plus un rappel dans
   « Action pour toi » s'il y a quelque chose à regarder.

---

## Les agents automatiques qui changent de comportement

### L'agent SEO (`seo-striking-distance`, le jeudi à 6 h 23 UTC) : le seul concerné

Il regarde les recherches Google où une fiche est presque en première page, puis il
réécrit le **synopsis** quand le mot-clé y manque, et le **titre SEO**, c'est-à-dire
uniquement la balise `<title>` qui s'affiche dans Google, jamais le nom visible sur la
fiche.

| | Avant la fusion | Après la fusion (réglage par défaut) |
|---|---|---|
| Écrit-il les synopsis et titres SEO ? | Oui, directement | **Oui, exactement comme avant** |
| Combien par passage ? | Jusqu'à 12 synopsis + 12 titres (et un budget de temps de 3 min 30) | Pareil |
| Où voir ce qu'il a écrit ? | Seulement dans le mail du jeudi | Dans le mail **et** dans « À relire », avec l'avant/après |
| Annuler une écriture ? | À la main, en base de données | **Un clic** sur « Annuler » |
| Coût visible ? | Non | Oui, par passage (estimation) |
| Liens internes entre fiches (« maillage ») | Automatiques | **Inchangé** : toujours automatiques, pas dans le registre |

Deux détails techniques, sans effet visible en temps normal :

- **Il n'écrase plus jamais une modification faite entre-temps.** Il vérifie que le
  synopsis est toujours celui qu'il a lu avant d'écrire. Si quelqu'un l'a changé dans
  l'intervalle, il s'abstient et note « échec » avec la raison.
- **Il ne repaie plus une deuxième réécriture** d'une fiche dont une proposition attend
  déjà ta décision. Cela ne joue que si des propositions attendent, donc au niveau
  « Proposer » ou avec un seuil de confiance.

### Le digest du mercredi

Il gagne les lignes « Agents » décrites plus haut. C'est tout.

### Ce qui ne change pas

Totem (l'assistant), la Recherche magique, les actus, l'enrichissement du catalogue,
l'agent « contenu famille », le superviseur et tous les imports se comportent exactement
comme aujourd'hui. Ils **ne passent pas encore** par le registre : ce sera la suite, un
agent à la fois. Seule la table des prix de Totem a été déplacée dans un fichier partagé,
avec des prix identiques, vérifiés par un test.

---

## Les niveaux d'autonomie

Quatre crans, du plus prudent au plus libre :

| Niveau | Ce que fait l'agent |
|---|---|
| **Observation** | Il note ce qu'il *ferait*. Il n'écrit rien et ne demande rien. Pour essayer un nouvel agent sur de vraies données. |
| **Proposer** | Chaque proposition attend dans « À valider ». Rien n'est écrit tant que tu n'as pas cliqué « Appliquer ». |
| **Agir et signaler** | Il écrit, puis l'écriture apparaît dans « À relire » : tu cliques « Vu » ou « Annuler ». |
| **Autonome** | Il écrit seul. L'action reste dans l'historique, mais ne te demande rien. |

**Réglage par défaut de chaque type d'action** (il n'en existe que deux pour l'instant) :

| Action | Agent | Niveau par défaut | Seuil de confiance |
|---|---|---|---|
| Réécriture du synopsis | Agent SEO | **Agir et signaler** | aucun |
| Titre SEO (balise `<title>`) | Agent SEO | **Agir et signaler** | aucun |

« Agir et signaler » a été choisi parce que c'est **le comportement actuel** de l'agent
SEO, avec en plus la relecture et l'annulation. La fusion ne retire donc rien et n'ajoute
aucun blocage.

Le **seuil de confiance** est optionnel. Une action moins sûre que le seuil repart en
validation, même en « Autonome ». **Attention :** l'agent SEO ne donne pas de score de
confiance aujourd'hui. Si tu mets un seuil sur ses actions, **toutes** iront dans
« À valider ». C'est voulu (« sans preuve qu'il est sûr, il demande »), mais autant le savoir.

Le panneau te **suggère** de monter d'un cran après 10 validations sans refus, ou de
redescendre si plus d'une action sur cinq est refusée ou annulée. Il ne change jamais un
niveau tout seul : toi seul le fais.

---

## À quoi ressemble la section « Agents » dans `/admin/operations`

De haut en bas :

1. **Trois compteurs** : « À valider », « À relire », « Coût IA estimé (30 j) ».
2. **« À valider »** : une carte par proposition, avec :
   - le nom de la fiche (le lien ouvre la page publique dans un nouvel onglet) ;
   - l'agent, le type d'action, la date et la confiance si l'agent en donne une ;
   - **le pourquoi**, par exemple « Requête Google « vaiana 2 age » (position 11) : le
     mot-clé manque dans le synopsis. » ;
   - deux encadrés côte à côte, **Avant** et **Proposé** ;
   - deux boutons : **Appliquer** et **Refuser**.

   Au réglage par défaut, cette liste reste **vide** : elle ne se remplit que si tu passes
   un type d'action en « Proposer » ou si tu mets un seuil. Une proposition non tranchée
   **expire au bout de 30 jours**, sans jamais être appliquée.
3. **« À relire »** : la même carte, avec **Avant** et **Écrit**, et deux boutons : **Vu**
   et **Annuler**. « Annuler » demande confirmation, puis remet l'ancien texte sur la fiche.
4. **« Autonomie par type d'action »** : pour chaque action, un menu à quatre niveaux, un
   champ « Seuil % », un bouton « Enregistrer » (il n'apparaît que si tu as changé
   quelque chose), le bilan des 90 derniers jours (validées, relues, refusées, annulées)
   et la suggestion éventuelle.
5. **« Coûts par agent (30 jours, estimation) »** : un tableau avec passages, appels à
   l'IA, coût, actions appliquées sur proposées, et dernier passage.
6. **« Historique »** (replié) : les 40 dernières actions avec leur statut (Appliquée,
   Refusée, Annulée, Échec, Expirée, Observation), et un bouton « Annuler » sur celles qui
   sont encore appliquées.

Seul un compte **ADMIN connecté** peut cliquer. Les tâches automatiques ne peuvent ni
valider ni changer un niveau, même avec la clé des crons : un agent ne peut donc pas
approuver ses propres propositions. Steph (compte MODERATOR) ne voit pas ce panneau.

---

## Ce que veulent dire les chiffres de coût

- C'est une **estimation en dollars**, pas la facture. Pour chaque appel à l'IA, on compte
  le texte envoyé et le texte reçu, puis on applique les **prix publics** notés dans le
  code au 6 novembre 2026. Pour le modèle de l'agent SEO : 0,25 $ par million de « jetons »
  (des morceaux de mots) envoyés, 2 $ par million reçus.
- **Ordre de grandeur attendu pour l'agent SEO : quelques centimes par passage**, au
  maximum. C'est mon estimation : le premier vrai passage donnera le vrai chiffre.
- **« Non mesurable »** veut dire qu'un appel a utilisé un modèle dont le prix n'est pas
  dans la table. Ce n'est jamais compté comme zéro.
- **Ce n'est pas la dépense IA totale du site** : seul l'agent SEO est branché pour
  l'instant. Totem garde son propre coût estimé dans `/admin/totem`. Les actus,
  l'enrichissement et l'agent famille ne sont pas encore comptés.
- Une simulation (`dryRun`, ou tout ce qui ne tourne pas en production) n'est pas comptée,
  parce qu'elle n'écrit rien.

---

## Revenir en arrière, du plus léger au plus lourd

1. **Annuler une écriture** : « Annuler » dans « À relire » ou dans l'historique. Effet
   immédiat sur la fiche.
2. **Baisser le niveau** : dans la section « Agents », passer l'agent SEO en « Proposer »
   (rien n'est écrit sans ton accord) ou en « Observation » (rien n'est écrit du tout).
   Pas de déploiement : c'est pris en compte au passage suivant.
3. **Couper l'agent SEO** : mettre `SEO_AGENT_AUTOFIX` à `false` dans les variables Vercel,
   **puis redéployer** (Vercel n'applique une variable qu'aux nouveaux déploiements).
   L'agent ne fait plus que son rapport. C'est l'interrupteur qui existe déjà depuis juillet.
4. **Retirer toute la fonctionnalité** : annuler le commit de fusion sur `main` (« revert »).
   L'agent SEO redevient comme avant. Les trois tables restent en base, inutilisées et sans
   danger. Les supprimer serait une modification de la base de production, donc
   uniquement sur ton feu vert.

---

## Ce dont je ne suis pas sûr, et ce qu'il faut surveiller

- **Le panneau n'a jamais tourné contre la vraie base.** Il est testé, mais avec des
  données simulées. Le premier vrai usage aura lieu après la fusion. Je propose donc de
  lancer l'agent SEO à la main juste après (onglet Actions, « Scheduled Maintenance »,
  tâche `seo-striking-distance`) et de regarder le panneau aussitôt.
- **« À relire » s'accumule.** Au réglage par défaut, chaque écriture SEO y arrive (jusqu'à
  24 par semaine) et y reste jusqu'à ton « Vu » : contrairement à « À valider », cette
  liste n'expire pas. Si tu ne veux pas relire, passe en « Autonome » : les écritures
  restent alors dans l'historique, sans te solliciter.
- **« Annuler » peut être refusé**, et c'est voulu : si la fiche a été modifiée après
  l'écriture de l'agent, à la main, par l'enrichissement ou par l'audit des synopsis
  (tâche manuelle `synopsis-audit`, qui corrige la grammaire), le registre refuse d'écraser
  ce changement et l'explique.
- **Un trou volontaire au niveau « Agir et signaler ».** Si la base refuse d'enregistrer
  l'action au moment où l'agent écrit (panne passagère), l'écriture a quand même lieu, mais
  n'apparaît pas dans « À relire » (trace seulement dans les journaux du serveur). J'ai
  préféré que l'agent continue de marcher comme aujourd'hui. Au niveau « Proposer », c'est
  l'inverse : sans enregistrement, rien n'est écrit. Dis-moi si tu préfères le même
  verrou partout.
- **Les prix sont recopiés à la main.** Si un fournisseur change ses tarifs, l'estimation
  dérive jusqu'à ce qu'on mette la table à jour.
- **Une documentation à corriger, sans rapport avec cette branche** : CLAUDE.md parle de
  « 3 synopsis + 3 titres maximum par passage », alors que le code en autorise 12 + 12
  depuis plusieurs semaines. Je n'ai rien changé au plafond.

---

## Ma recommandation pour la mise en route

1. Fusionner tel quel : le réglage par défaut reproduit le comportement actuel.
2. Lancer l'agent SEO à la main et vérifier que « À relire » et le coût s'affichent.
3. Pendant deux ou trois jeudis, cliquer « Vu » ou « Annuler » sur ses écritures.
   Le panneau te dira quand le bilan justifie « Autonome ».
4. Ensuite, brancher les agents suivants un par un. Mon ordre proposé : les décisions de
   publication des actus d'abord, puis le futur agent blog (brouillons dans « À valider »).
