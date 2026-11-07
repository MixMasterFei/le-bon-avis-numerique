# Totem Avisé comme connecteur IA : dossier de référencement

> Branche `claude/agentic-master-connectors` (depuis `main` au 7 novembre 2026), non fusionnée.
> Rien n'a été soumis à aucun annuaire. Ce dossier sert à remplir le formulaire de Claude
> (`claude.ai/directory/manage` → « MCP connector ») et à écrire à Mistral.
> Sources des exigences : [submission](https://claude.com/docs/connectors/building/submission)
> et [review criteria](https://claude.com/docs/connectors/building/review-criteria), lues le 7 novembre 2026.

**À faire dans cet ordre.** Ne soumets qu'**après** la fusion et le déploiement de cette
branche : le portail relit les outils sur le serveur en ligne, et le serveur actuel porte encore
les deux formulations qu'un relecteur refuserait (voir l'audit).

---

## 1. Audit du serveur face aux critères de Claude

Serveur : `https://totemavise.com/api/mcp/mcp` (streamable HTTP), trois outils, sans authentification.

| Critère | Avant | Maintenant (cette branche) |
|---|---|---|
| Chaque outil a un `title` et `readOnlyHint` ou `destructiveHint` | ✅ déjà fait | ✅ inchangé, désormais vérifié par un test |
| Noms d'outils de 64 caractères maximum | ✅ | ✅ vérifié par un test |
| Pas d'outil « fourre-tout » mêlant lecture et écriture | ✅ trois outils fixes, lecture seule | ✅ |
| Descriptions exactes : ce que fait l'outil et quand l'appeler | ✅ | ✅ |
| Descriptions sans promotion d'un produit ni consigne qui détourne l'assistant | ❌ deux descriptions finissaient sur le « compte famille gratuit », et les instructions du serveur contenaient le lien d'inscription et « Répondez en français » | ✅ retirés. La mention du compte reste dans les **réponses** des outils, à titre d'information, pas dans les descriptions. Un test l'empêche de revenir. |
| Réponse réussie pour tout paramètre valide | ❌ une recherche sans résultat était renvoyée comme une **erreur** | ✅ « aucun titre » est une réponse normale. Un identifiant qui ne correspond à rien reste une erreur, comme prévu. Testé. |
| Messages d'erreur précis et actionnables | ⚠️ précis, mais techniques et en anglais pour les arguments invalides (« Too small: expected number to be >=3 ») | ✅ messages en français : « L'âge doit être compris entre 3 et 16 ans. » Testé. |
| Réponses de taille raisonnable | ✅ 10 résultats maximum par recherche, 20 par sélection | ✅ |
| Pas de collecte de la conversation | ✅ journaux limités à l'outil, au résultat et à la durée | ✅ inchangé ; le nouveau compteur d'usage (§ 6) ne garde ni le texte de la question, ni l'IP |
| Chaque réponse crédite Totem Avisé et renvoie au site | ⚠️ la sélection oui ; le verdict avait le lien de la fiche mais pas de mention claire de la source ; la recherche ne donnait aucun lien | ✅ ligne « Source : Totem Avisé — lien » sur toute réponse utile (fiche, sélection ou site), lien de fiche sur chaque résultat de recherche. Testé. |
| API propre, même domaine que le service | ✅ totemavise.com | ✅ |
| Politique de confidentialité | ⚠️ existe, mais ne parle pas du connecteur | ✅ section 3.6 ajoutée (à relire, voir plus bas) |
| Documentation publique d'installation | ❌ aucune page | ✅ `/assistants-ia`, construite mais **fermée** tant que tu n'as pas donné ton accord (voir § 4) |
| Fiche d'identité du serveur | nom technique `totem-avise` seulement | ✅ titre affiché « Totem Avisé », site, icône 256×256, version 1.2.0 |

**Non fait, à décider (plus gros) :**

- **Limite de débit.** `/api/mcp` partage la limite générique du site : 100 requêtes par minute
  et par adresse IP, comptées par instance du serveur. Or tous les utilisateurs de Claude arrivent
  depuis quelques adresses partagées. Si le référencement marche, ils risquent des refus « trop de
  requêtes ». Il faudra alors une limite propre à ce point d'entrée, sans doute un plafond
  global plutôt que par IP. Je n'y ai pas touché : c'est un choix entre ouverture et protection.
- **Politique de confidentialité à rafraîchir** (juridique, à toi) : elle date du 29 décembre 2024,
  cite « Neon/PostgreSQL » alors que la base est chez Supabase, et ne liste ni l'envoi d'e-mails,
  ni le blog, ni les prestataires d'IA utilisés par l'assistant Totem et la Recherche magique. J'ai
  seulement ajouté la section sur le connecteur, sans changer la date.
- **Icône plus grande.** Le portail ne donne pas de format. L'icône du site fait 256×256
  (`src/app/icon.png`, servie à `https://totemavise.com/icon.png`). `public/logo-icon.png` (80×80)
  est trop petite. S'il faut du 512×512, il faut repartir du fichier source du logo, qui n'est pas
  dans le dépôt.
- **Le transport SSE** (`/api/mcp/sse`) dépend de Redis : ne communiquer que l'adresse
  `/api/mcp/mcp`.

---

## 2. Champs du formulaire Claude

**Connexion**
- URL : `https://totemavise.com/api/mcp/mcp`. Une seule adresse pour tout le monde (ni « Multiple
  URLs » ni « URL pattern »).

**Outils.** Synchronisés automatiquement : 3 outils, tous avec un titre et `readOnlyHint: true`.

**Fiche**

| Champ | Valeur |
|---|---|
| Nom (100 car. max) | Totem Avisé |
| Accroche EN (200 max, 130 utilisés) | Age ratings, content scores and family picks for films, TV series and video games, from the independent French family media guide. |
| Accroche FR (143 utilisés) | Âges conseillés, indicateurs de contenu et sélections par âge pour les films, séries et jeux vidéo, par le guide familial français indépendant. |
| Catégories (1 à 5) | La liste du portail n'est pas publique. Choisir les plus proches de : Éducation, Divertissement / médias, Famille. |
| Documentation | `https://totemavise.com/assistants-ia` (à rendre publique avant de soumettre) |
| Confidentialité | `https://totemavise.com/confidentialite` (section 3.6) |
| Contact support | contact@totemavise.com |
| Icône | `https://totemavise.com/icon.png` (PNG 256×256, source `src/app/icon.png`) |
| Identifiant d'URL (définitif) | `totem-avise` |

**Description EN (2 000 car. max, 1 080 utilisés)**

> Totem Avisé is an independent French family media guide. For every film, TV series and video game in its catalogue, it gives a recommended age with the reasoning behind it, content scores (violence, sex and nudity, language, alcohol and drugs, consumerism, positive messages, role models), points of attention for parents and a link to the full review page.
>
> With this connector, your assistant can:
> - find a title in the catalogue, including by its original title (search_media);
> - give the full age verdict for a film, series or game (get_age_verdict);
> - suggest films, series or games suited to a child aged 3 to 16 (recommend_for_age).
>
> The connector is public and read-only: no account, no sign-in, no personal data. It receives only the parameters of the question (a title, an age, a media type) and does not store them; usage is counted per day (calls and titles consulted), never the question itself. Content is in French; your assistant can answer in your language. Provisional age estimates are flagged as such, and missing data is never presented as an absence of risk.

**Description FR (1 202 utilisés)**

> Totem Avisé est le guide familial français indépendant des films, séries et jeux vidéo. Pour chaque titre de son catalogue, il donne un âge conseillé et son raisonnement, des indicateurs de contenu (violence, sexualité et nudité, langage, alcool et drogues, consumérisme, messages positifs, modèles), des points de vigilance pour les parents et le lien vers la fiche complète.
>
> Avec ce connecteur, votre assistant peut :
> - trouver un titre dans le catalogue, y compris par son titre original (search_media) ;
> - donner le verdict d'âge complet d'un film, d'une série ou d'un jeu (get_age_verdict) ;
> - proposer des films, séries ou jeux adaptés à un enfant de 3 à 16 ans (recommend_for_age).
>
> Le connecteur est public et en lecture seule : aucun compte, aucune connexion, aucune donnée personnelle. Il ne reçoit que les paramètres de la question (un titre, un âge, un type de média) et ne les conserve pas ; l'usage est compté par jour (appels et fiches consultées), jamais la question elle-même. Les fiches sont en français ; votre assistant peut vous répondre dans votre langue. Les âges encore estimés sont signalés comme tels, et une donnée absente n'est jamais présentée comme une absence de risque.

**Cas d'usage**
1. Un parent vérifie qu'un film, une série ou un jeu convient à l'âge de son enfant avant de le lancer.
2. Un parent cherche des idées adaptées à un âge pour une soirée en famille.
3. Un parent veut comprendre *pourquoi* un titre est conseillé à partir d'un âge donné.

Prérequis : aucun (ni compte, ni abonnement). Le connecteur **lit** seulement, il n'écrit rien.

**Exemples de questions** (tous les titres existent dans le catalogue, vérifié le 7 novembre)
- « Vice-Versa 2, c'est adapté à ma fille de 6 ans ? » (fiche : dès 8 ans)
- « À partir de quel âge peut-on jouer à Minecraft ? »
- « La série Mercredi est-elle trop effrayante pour un enfant de 11 ans ? » (fiche : dès 13 ans)
- « Propose-moi des films pour une soirée en famille avec un enfant de 7 ans. »
- « Quels jeux vidéo conseilles-tu pour un enfant de 9 ans ? »
- EN : “Is The Wild Robot okay for a 5-year-old?” · “From what age can kids play Minecraft?” · “Suggest family films for a 7-year-old.”

**Société.** Totem Avisé, édité par Xavier Manzanares (personne physique, d'après les mentions
légales). Site : https://totemavise.com. Contact principal : toi.

**Authentification.** Aucune.

**Données.** L'API est la nôtre (premier parti). Aucune donnée de santé. Aucun contenu sponsorisé.

**Test et lancement.** Aucun identifiant à fournir. Texte proposé pour les relecteurs :

> No credentials needed. Add `https://totemavise.com/api/mcp/mcp` as a custom connector (no authentication), then ask: “Is The Wild Robot okay for a 5-year-old?” (search_media + get_age_verdict: recommended from 6, with reasons and a link), “Suggest family films for a 7-year-old.” (recommend_for_age) and “From what age can kids play Minecraft?”. All tools are read-only and answer in French; Claude can translate. Documentation: https://totemavise.com/assistants-ia

**Conformité.** Sept cases à cocher (règles de l'annuaire, API propre, transactions financières,
génération de médias, injection de consignes, collecte de conversation, documentation publique).
Rien ne pose problème, mais c'est à toi de les cocher.

---

## 3. Tester en 2 minutes (ce que fera le relecteur, à faire avant lui)

1. Claude → « Personnaliser » → « Connecteurs » → « Ajouter un connecteur personnalisé ».
   Nom : Totem Avisé ; adresse : `https://totemavise.com/api/mcp/mcp` ; pas d'authentification.
2. Demander : « Is The Wild Robot okay for a 5-year-old? ». Attendu : l'assistant cherche le
   titre, lit le verdict (dès 6 ans) et donne le lien de la fiche.
3. Demander : « Propose-moi des films pour une soirée en famille avec un enfant de 7 ans. ».
   Attendu : une sélection.
4. Optionnel, côté technique : `npx @modelcontextprotocol/inspector`, transport « Streamable
   HTTP », même adresse, puis appeler chacun des trois outils. Le formulaire demande de confirmer
   que chaque outil a été essayé.

---

## 4. Ce que tu dois faire toi-même

1. **Accorder (ou non) l'exception à la règle de CLAUDE.md** pour `/assistants-ia` : la page cite
   Claude, Le Chat et ChatGPT comme endroits où utiliser Totem. Elle ne dit jamais quelle IA
   Totem utilise en interne, et un test le vérifie. Si c'est oui : fusionner, mettre
   `AI_CONNECTORS_PAGE_PUBLIC=true` dans Vercel, puis redéployer. Avant cela, la page est
   invisible (404) sauf pour les admins, et absente du sitemap.
2. **Relire la section 3.6 de la politique de confidentialité**, et décider du rafraîchissement
   du reste de la page (date, prestataires).
3. **Tester toi-même** dans Claude (§ 3) et dans Le Chat, une fois la branche en ligne.
4. **Soumettre** dans `claude.ai/directory/manage` → « MCP connector », avec les champs du § 2.
5. **Envoyer le courriel à Mistral** (§ 5).

---

## 5. Courriel à Mistral AI (Le Chat)

L'annuaire des connecteurs de Le Chat est choisi par Mistral. Je n'ai trouvé ni formulaire de
candidature ni adresse « partenariats » publique : passe par la page de contact de mistral.ai
ou par un contact direct. N'importe quel administrateur peut déjà ajouter Totem dans Le Chat
comme connecteur personnalisé. Pouvoir montrer qu'il est utilisé ainsi renforcera la demande.

> **Objet :** Totem Avisé : demande de référencement dans l'annuaire des connecteurs de Le Chat
>
> Bonjour,
>
> Je suis Xavier Manzanares, fondateur de Totem Avisé (totemavise.com), le guide familial français indépendant des films, séries et jeux vidéo. Pour chaque titre, nous donnons un âge conseillé argumenté, des indicateurs de contenu et des points de vigilance pour les parents.
>
> Nous avons ouvert un connecteur MCP public, en lecture seule et sans authentification : https://totemavise.com/api/mcp/mcp. Il propose trois outils (recherche d'un titre, verdict d'âge complet, sélection par âge de 3 à 16 ans) et fonctionne déjà comme connecteur personnalisé dans Le Chat. Il ne demande ni ne conserve aucune donnée personnelle.
>
> Nous aimerions qu'il rejoigne l'annuaire des connecteurs de Le Chat. C'est une source française, pensée pour les familles, qui répond à l'une des questions que les parents posent le plus : « ce film est-il adapté à mon enfant ? ».
>
> Documentation : https://totemavise.com/assistants-ia
> Confidentialité : https://totemavise.com/confidentialite
>
> Je vous enverrai volontiers tout élément utile (logo, descriptions, statistiques d'usage) et j'adapterai le connecteur à vos exigences.
>
> Bien cordialement,
> Xavier Manzanares
> Totem Avisé · contact@totemavise.com

*Avant l'envoi :* vérifier soi-même que l'ajout dans Le Chat fonctionne, puisque le courriel
l'affirme, et que la page de documentation est publique.

---

## 6. Mesurer si le référencement rapporte

Chaque appel d'outil est compté, sans migration, dans la table existante `ai_bot_hits`
(une ligne par jour, assistant, type et « surface », avec un compteur) :

- `kind = "mcp"` : séparé des visites de robots ;
- `bot` : l'assistant appelant, réduit à un jeton court (« Claude-User », « ChatGPT-User »,
  « MistralAI-User »…), jamais l'en-tête brut ;
- `surface = "mcp-<outil>"` : appels par outil et par jour (suffixe `:erreur` si l'appel échoue) ;
- `surface = "mcp-fiche:<identifiant>"` : pour un verdict, la fiche consultée.

Jamais conservés : le texte de la question, l'adresse IP, quoi que ce soit de la conversation.
L'écriture se fait après la réponse et ne peut pas faire échouer un appel (`src/lib/mcp/usage.ts`).

Pour lire : `npx tsx scripts/check-ai-bots.ts 30` (bloc « AI connector (MCP) » : appels par
outil, par assistant, fiches les plus consultées). Comparer avant et après chaque référencement :
la ligne de l'assistant concerné doit monter.
