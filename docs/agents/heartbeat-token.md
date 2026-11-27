# Jeton GitHub du battement de cœur (`GITHUB_DISPATCH_TOKEN`)

Le battement de cœur (`/api/cron/heartbeat`, tous les jours à 8 h UTC sur Vercel) repère
les tâches GitHub Actions qui n'ont pas tourné à l'heure prévue et les relance lui-même.
Pour lancer le workflow « Scheduled Maintenance », il lui faut un jeton GitHub. Sans ce
jeton, il nomme toujours les tâches manquées dans l'e-mail d'alerte, mais ne relance rien
(le résumé dit « relance automatique désactivée (GITHUB_DISPATCH_TOKEN absent) »).

Le jeton ne sert qu'à une chose : lancer les workflows de ce dépôt. Il ne peut ni lire
ni modifier le code.

## 1. Créer le jeton sur github.com (≈ 3 minutes)

1. Se connecter à github.com avec le compte **MixMasterFei**.
2. En haut à droite, cliquer sur la photo de profil → **Settings**.
3. Tout en bas du menu de gauche : **Developer settings**.
4. **Personal access tokens** → **Fine-grained tokens** → bouton **Generate new token**.
5. Remplir :
   - **Token name** : `totem-heartbeat-dispatch`
   - **Description** : « Vercel heartbeat : relance des tâches cron manquées »
   - **Resource owner** : `MixMasterFei`
   - **Expiration** : **Custom** → une date dans **1 an** (noter la date dans l'agenda pour
     le renouveler).
   - **Repository access** : **Only select repositories** → choisir
     **le-bon-avis-numerique** (et seulement lui).
   - **Permissions** → **Repository permissions** → **Actions** : **Read and write**.
     Ne rien toucher d'autre (GitHub ajoute tout seul **Metadata : Read-only**, c'est
     normal et obligatoire).
6. **Generate token**, puis **copier le jeton tout de suite** (il commence par
   `github_pat_`). GitHub ne l'affichera plus jamais.

Ne pas coller le jeton dans un e-mail, un chat, un ticket ou un fichier du dépôt : il va
directement dans Vercel, étape suivante.

## 2. L'ajouter dans Vercel

1. vercel.com → le projet du site → **Settings** → **Environment Variables**.
2. **Add New** :
   - **Key** : `GITHUB_DISPATCH_TOKEN`
   - **Value** : coller le jeton
   - **Environments** : cocher **Production** uniquement (pas Preview, pas Development).
   - Si Vercel le propose, cocher **Sensitive**.
3. **Save**.

## 3. Redéployer

Une variable d'environnement n'est prise en compte qu'au déploiement suivant :
**Deployments** → le dernier déploiement de Production → menu **⋯** → **Redeploy**.

## 4. Vérifier

Le lendemain matin (après 8 h UTC, soit 9 h à Paris l'hiver), dans `/admin/operations` →
« Jobs automatiques » → `heartbeat` :

- si rien ne manquait : « OK — les N tâches GitHub attendues sont passées… » ;
- si des tâches manquaient : « Relancés sur GitHub : import, enrich… », et les runs
  correspondants apparaissent dans l'onglet **Actions** du dépôt (déclenchés par
  « workflow_dispatch »).

Si le résumé dit « Relance échouée : … (HTTP 401) » ou « (HTTP 403) », le jeton est
expiré ou n'a pas la permission **Actions : Read and write** sur ce dépôt : en refaire un
(étape 1) et remplacer la valeur dans Vercel (étapes 2 et 3).

## Couper la relance automatique

Dans Vercel, ajouter `HEARTBEAT_AUTODISPATCH` = `false` (Production), puis redéployer.
Le battement de cœur continue d'alerter et de nommer les tâches manquées, mais ne relance
plus rien. Supprimer la variable (ou la passer à `true`) pour la rétablir.

## Ce que la relance s'interdit

- Jamais plus de 6 tâches par matin, jamais deux fois la même tâche en 20 h.
- Seulement les tâches de la liste autorisée : import, release-status, enrich,
  news-discover, supervisor, homepage-watch, games-top-names, family-content-agent, et
  seo-striking-distance / debt-digest uniquement le jour où elles sont prévues.
- Jamais le banc d'essai Totem (`totem-eval`, payant) ni `game-facts`.

Quand le run programmé de GitHub finit par arriver en retard après une relance, il ne
refait pas le travail : la première étape du workflow (« Late scheduled run guard »)
constate que la tâche a déjà tourné depuis son horaire et la saute. Ce saut n'écrit rien
dans le journal des tâches.

Quand toutes les tâches quotidiennes manquées ont été relancées avec succès, le
battement de cœur n'envoie plus d'e-mail d'alerte (statut « partial », « Relancés sur
GitHub : … »). L'e-mail part toujours si une relance échoue, si le jeton manque ou si
GitHub Actions ne tourne plus du tout.

Détail technique : `src/lib/heartbeat-dispatch.ts`.
