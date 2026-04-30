import Parser from "rss-parser"
import { prisma } from "@/lib/prisma"
import { getAnthropic, DEFAULT_MODEL } from "@/lib/anthropic"
import { getDeepSeek, DEFAULT_DEEPSEEK_MODEL, isDeepSeekAvailable } from "@/lib/deepseek"
import { moderateStory, type Audience } from "@/lib/news-moderate"
import { judgeStory } from "@/lib/news-quality-judge"
import { loadCatalogIndex, linkifyStoryBody, findInCatalog, type LinkableMedia } from "@/lib/news-linkify"

// Stories whose primary catalog match has a recommended age at or
// above this threshold get demoted to PENDING_REVIEW instead of
// auto-publishing on the family-news page. Catches Kill Bill,
// Mortal Kombat, Saw, and similar violent/mature franchises that
// slip past the synthesis prompt's "adult content" rule.
const ADULT_CONTENT_AGE_FLOOR = 14
import { extractResearch, type ResearchSidebar } from "@/lib/news-research"
import { NEWS_SOURCES, type NewsSource } from "@/lib/news-sources"
import { resolveImage, type RssLikeItem } from "@/lib/news-image"
import { slugify, faviconFor } from "@/lib/news-slug"
import { uploadNewsImage, isStorageEnabled } from "@/lib/supabase-storage"
import { Prisma } from "@prisma/client"
import type { NewsCategory } from "@prisma/client"

// ── Title-fingerprint dedup ───────────────────────────────────────────
// Catches paraphrased duplicates that the URL-overlap check misses
// (Claude rewriting the same event with different wording on different
// runs). Tokens are 4+ chars, accent-stripped, lowercased; Jaccard
// similarity ≥ 0.5 = same story.

function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersect = 0
  for (const t of a) if (b.has(t)) intersect++
  return intersect / (a.size + b.size - intersect)
}

const TITLE_DEDUP_THRESHOLD = 0.5

interface HydratedItem {
  sourceName: string
  sourceCategory: NewsCategory
  sourceRegion: "FR" | "INTL"
  sourceCountry?: string
  title: string
  link: string
  summary: string
  imageUrl: string
  publishedAt: Date
}

interface SynthesizedStory {
  slug: string
  title: string
  summary: string
  body: string
  category: NewsCategory
  relevanceScore: number
  imageUrl: string
  sourceIndexes: number[]
  // "FR" = synthesized from at least one French source. "INTL" = all
  // sources are international (Vu d'ailleurs tab). Computed at persist
  // time from the cited sourceIndexes.
  region: "FR" | "INTL"
  // Filled in by the pass-2 moderation step. Defaults to "parent_only"
  // if moderation fails (fail-open) — story still ships, just doesn't
  // get the kid-safe badge.
  audience?: Audience
  // Optional "Ce que dit la recherche" sidebar. Populated by the
  // research extraction pass when the body cites a qualifying study.
  research?: ResearchSidebar | null
}

type RssParser = Parser<Record<string, unknown>, RssLikeItem & Record<string, unknown>>

const MAX_ITEMS_PER_SOURCE = 5
const MAX_TOTAL_ITEMS = 60

function makeParser(): RssParser {
  return new Parser({
    timeout: 6000,
    customFields: {
      item: [
        ["media:content", "media:content", { keepArray: false }],
        ["media:thumbnail", "media:thumbnail", { keepArray: false }],
        ["content:encoded", "content:encoded"],
      ],
    },
    headers: { "user-agent": "Mozilla/5.0 (compatible; TotemAviseBot/1.0)" },
  }) as RssParser
}

async function fetchOne(parser: RssParser, source: NewsSource, since: Date) {
  try {
    const feed = await parser.parseURL(source.url)
    const items = (feed.items ?? [])
      .filter((it) => {
        const t = it.isoDate ? new Date(it.isoDate) : it.pubDate ? new Date(it.pubDate) : null
        return t !== null && t > since && !!it.link && !!it.title
      })
      .sort((a, b) => {
        const ta = new Date(a.isoDate ?? a.pubDate ?? 0).getTime()
        const tb = new Date(b.isoDate ?? b.pubDate ?? 0).getTime()
        return tb - ta
      })
      .slice(0, MAX_ITEMS_PER_SOURCE)
    return items.map((it) => ({ source, item: it }))
  } catch (err) {
    console.warn(`[news-discover] Skipping ${source.name}: ${(err as Error).message}`)
    return []
  }
}

async function parallelMap<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return out
}

function buildPrompt(
  items: HydratedItem[],
  existingTitles: string[],
  recentImageUrls: string[],
): string {
  const list = items
    .map((it, idx) => {
      const summary = (it.summary ?? "").slice(0, 400).replace(/\s+/g, " ")
      // Tag international items so the synthesizer knows to translate
      // and frame for French readers ("Aux États-Unis…", "En Allemagne…").
      const regionTag =
        it.sourceRegion === "INTL" ? ` · INTL${it.sourceCountry ? "/" + it.sourceCountry : ""}` : ""
      return `[${idx}] (${it.sourceName} · ${it.sourceCategory}${regionTag}) ${it.title}\n  URL: ${it.link}\n  IMG: ${it.imageUrl}\n  ${summary}`
    })
    .join("\n\n")

  const alreadyPublished =
    existingTitles.length > 0
      ? `\n\n## Histoires DÉJÀ publiées (à ÉCARTER absolument)\n\nCes événements sont déjà couverts ces 72 dernières heures. N'émets AUCUNE histoire les concernant, même si de nouveaux articles les évoquent :\n${existingTitles.map((t) => `- "${t}"`).join("\n")}\n`
      : ""

  // Anti-image-collision: list the images already used by recent
  // PUBLISHED stories. The model must not pick any of these as the
  // imageUrl for new stories, even when the same brief is cited.
  const recentImagesNote =
    recentImageUrls.length > 0
      ? `\n\n## Images DÉJÀ utilisées (à ÉCARTER absolument)\n\nCes URLs d'image sont déjà attribuées à des histoires publiées récemment. NE PAS les choisir comme imageUrl, même si tu cites le même article source. Choisis une image alternative parmi les autres articles du cluster, ou écarte l'histoire si aucune image alternative n'existe.\n${recentImageUrls.map((u) => `- ${u}`).join("\n")}\n`
      : ""

  return `Tu es l'éditeur de Totem Avisé, un guide d'actualité pour les foyers français — parents, grands-parents, enseignants, mais aussi tous les adultes qui suivent les sujets famille / éducation / numérique sans forcément avoir d'enfants. Ton lecteur ouvre la page pour S'INFORMER vite — il veut le SUJET, pas un compte-rendu de quel article a publié quoi.

**ATTENDU EN SORTIE : sur les ${items.length} articles fournis, retiens 3 à 8 histoires.** La page ne peut pas vivre sans contenu — un retour à 0 ou 1 histoire signifie que tu es trop strict sur les ÉVÉNEMENTS (annonces, sorties, études, décisions). Mais à l'inverse, retenir 8 histoires faibles est pire que 3 fortes : la qualité prime sur la quantité. **Si tu hésites pour une histoire, écarte-la** — surtout pour les LISTE/GUIDE sans éléments nommés et les contenus mature/adulte sans angle parental.

Voici ${items.length} articles publiés ces 48 dernières heures, chacun avec un index, une source, une catégorie, un titre, une URL, une image et un résumé.

## TROIS PRINCIPES (par ordre de priorité)

**1. Relayer le CONTENU, pas la méta-information.**
   Tu écris sur le sujet, pas sur l'article. La règle s'applique à toutes les histoires, mais le seuil dépend du TYPE d'article :

   **(a) Articles de type ÉVÉNEMENT** — sortie, annonce, étude, décision, polémique, fait nouveau. Tu peux écrire dès que le résumé fourni te donne **au moins** : qui (la personne / institution / œuvre), quoi (l'événement nommé), quand (la date ou la fenêtre temporelle). Tu n'as pas besoin de détails exhaustifs — tu rapportes ce que les sources disent, en attribuant. Une sortie de film avec titre + date suffit pour 300 mots.

   **(b) Articles de type LISTE / GUIDE / SÉLECTION / TOP-N / CLASSEMENT** — ici la valeur EST la liste. Si le résumé fourni ne nomme PAS les éléments concrets de la liste (les jeux du top 10, les séries de la sélection, les outils du guide), ÉCARTE. Tu ne peux pas relayer une liste dont tu n'as pas les éléments.

   **EXEMPLE NÉGATIF — à NE PAS retenir** : un article intitulé "4 séries Netflix à ne pas manquer en avril selon AlloCiné" dont le résumé fourni dit simplement "AlloCiné liste quatre séries Netflix à rattraper avant la fin du mois d'avril." → **ÉCARTE**. Le résumé ne nomme aucune série. Écrire "AlloCiné a sélectionné quatre séries Netflix pour ce mois d'avril, en privilégiant des productions récentes…" serait de la méta-paraphrase exactement comme l'exemple Numerama interdit plus bas. Tu ne peux pas inventer les noms des séries pour combler le manque.

   **(c) Articles d'analyse / d'étude chiffrée** — si l'angle est "X% de…", "tendance à…", il te faut au moins UN chiffre ou UNE conclusion concrète dans le résumé. Sinon écarte.

   **INTERDIT (toutes catégories)** :
   - "Numerama publie un guide qui liste 10 jeux" → on attend les jeux, pas l'existence du guide.
   - "Le site X présente une sélection de 5 séries" → pareil, vide.
   - "La rédaction précise avoir testé" / "Le guide ne se contente pas de…" → paraphrase de la structure éditoriale du source, pas du contenu.
   - "L'article du Monde explique que la situation est complexe" → traite le sujet directement avec attribution.

   **EXIGÉ** : attribution nommée des affirmations fortes ("Selon Le Monde…", "Numerama rapporte…"), faits concrets que tu as réellement (titres, dates, lieux, chiffres, noms). Pour un événement, écrire 300 mots sobres est OK même avec un résumé bref ; pour un top 10 sans la liste, écarte.

   **EXEMPLE D'HISTOIRE ÉVÉNEMENT ACCEPTABLE** (résumé source minimal : Sortie de Avatar 3 le 19 décembre 2026 dans les salles françaises, distribution Disney/Fox. Réalisateur James Cameron. Confirmé par Variety et AlloCiné.). Le brief produit doit faire **300-450 mots**, comme dans cet exemple (le contenu ci-dessous est ce que tu mettrais dans le champ "body" d'une histoire) :

   Avatar 3 sort dans les salles françaises le 19 décembre 2026, ont annoncé Disney et la 20th Century Fox la semaine du 25 avril. Le troisième volet de la saga de James Cameron prend place sur Pandora plusieurs années après les événements d'Avatar 2 : la Voie de l'eau, sorti fin 2022. Selon AlloCiné, le film conserve les acteurs principaux des volets précédents, dont Sam Worthington dans le rôle de Jake Sully et Zoe Saldana dans celui de Neytiri.

   La date du 19 décembre s'inscrit dans la fenêtre des sorties familiales pour les vacances de Noël, créneau exploité par chaque opus précédent de la saga. Variety rapporte que le scénario explore le peuple Ash, une nouvelle tribu Na'vi orientée sur le feu, après l'introduction du peuple Metkayina (peuple de l'eau) dans le précédent volet. Premiere indique que le tournage en motion-capture a duré près de quatre ans entre la Nouvelle-Zélande et les studios Manhattan Beach, en Californie.

   La durée annoncée par les distributeurs reste à confirmer mais devrait dépasser trois heures, selon Variety, comme le précédent volet (3h12). Disney a précisé à AlloCiné que le film sera distribué simultanément en IMAX, 3D HFR (high frame rate) et version standard, mais la stratégie tarifaire pour les séances premium n'a pas encore été détaillée pour la France.

   Aucun classement officiel français n'a été publié à ce jour. Les deux premiers volets de la saga étaient classés tous publics avec avertissement, mention liée à des scènes de bataille. Le CNC précisera son avis dans les semaines précédant la sortie. Une bande-annonce mondiale est attendue lors de la convention CinemaCon de Las Vegas, selon Premiere.

   Cet exemple (≈ 320 mots) est ACCEPTABLE même si le résumé fourni était court : il livre titre, date, casting, lieu de tournage, durée approximative, format de distribution, état du classement officiel — chaque fait étant attribué nommément à sa source. C'est l'écart attendu entre le résumé brut (limité) et le brief structuré que tu produis. **Vise toujours 300-450 mots** ; un brief de 200 mots sera rejeté par le contrôle qualité aval. **N'utilise PAS de double-quote ASCII " dans le body** — utilise les guillemets français « » pour les citations directes (cf. règle d'échappement JSON plus bas).

**2. Voix neutre, jamais éditoriale.**
   Tu rapportes ce que les sources disent ; tu n'as pas d'avis.
   - INTERDIT : qualificatifs dans le titre ("une initiative qui inspire", "un signal alarmant"), questions rhétoriques ("Pour combien de temps ?"), conclusions personnelles ("on ne peut que saluer", "il est temps que…"), vocabulaire éditorial (*enfin, malheureusement, fort heureusement, étonnamment, sans surprise, à juste titre, courageux, lucide, alarmant, prometteur, salutaire*), hooks éditoriaux ("Pour les parents qui…", "Les familles concernées par…").
   - EXIGÉ : chaque affirmation forte est attribuée nommément ("Selon Le Monde, …", "Pew Research observe que…", "L'étude de l'INSERM rapporte que…"). Une opinion forte va entre guillemets avec attribution : « Cette initiative montre que… », a déclaré la maire (Le Monde, 23 avril).
   - Exception : un cadrage factuel sans jugement est autorisé ("La recommandation s'applique aux enfants de moins de 13 ans").

**3. Sélection famille topique, pas martelée dans le texte.**
   Le SUJET doit relever de l'univers famille / foyer au sens large : enfants, école, écrans à la maison, éducation, santé des jeunes, sorties culturelles famille, parentalité numérique, mais aussi tendances de société qui touchent ce périmètre. Si tu retiens l'histoire, c'est qu'elle a sa place ici — pas besoin de le rappeler dans chaque phrase.
   - **NE COMMENCE PAS** par "Pour les parents qui…", "Les familles concernées…", "À retenir pour les enfants de X ans" — ces formules sont éditoriales et redondantes.
   - **NE TERMINE PAS** par une exhortation Totem ("Voici de quoi alimenter vos discussions à table"). Si tu veux clore avec une note ouverte, ce doit être soit une **question relayée d'une source** ("Plusieurs experts cités par Le Monde s'interrogent sur la pérennité du dispositif."), soit une **observation factuelle** ("Le ministère doit publier ses recommandations finales avant l'été."), jamais un commentaire Totem.
   - L'histoire doit pouvoir être lue par quelqu'un sans enfants — sa pertinence vient du sujet, pas d'un cadrage parental forcé.

## CLUSTERING

Deux chemins pour créer une histoire :

**A — Multi-sources (préféré).** Un événement précis couvert par ≥ 2 publications distinctes. Relevance ≥ 0.5.

**B — Single-source.** Un article isolé avec angle famille fort (étude sérieuse, annonce institutionnelle, guide parental concret, recommandation experte). Relevance ≥ 0.7 obligatoire.

**Événement précis** = une sortie datée, une annonce officielle, une étude publiée, une décision institutionnelle, une polémique nommable, un guide pratique avec contenu concret.

**Pas un thème** = "les livres", "les jeux vidéo en avril", "la philosophie" — ce sont des catégories, pas des événements.

Ne fusionne JAMAIS deux sujets différents en une seule histoire (ex : un article sur Tolkien + un article sur Saint Augustin → DEUX sujets distincts, pas un cluster).

## INTERNATIONAL (Vu d'ailleurs)

Articles étiquetés "· INTL/<pays>" = publications étrangères. Une histoire est 100% FR ou 100% INTL — jamais mixte.

Pour les histoires INTL :
- Traduis intégralement en français.
- Para 1 situe le pays ("Aux États-Unis…", "Au Royaume-Uni…", "En Allemagne…").
- Para 3 fait le pont avec les familles françaises sans surinterpréter ("Selon les chercheurs cités, ce constat fait écho à…").
- Single-source INTL : relevance ≥ 0.6 suffit.

## À ÉCARTER

- Politique pure (élections, gouvernement, débats partisans) sauf impact direct école / famille / numérique des jeunes.
- Sport, faits divers sans lien avec le périmètre famille / éducation / culture grand public.
- Articles dont le titre + résumé ne donnent ni qui, ni quoi, ni quand (très rare — la plupart des flux RSS livrent ces minima).
- Articles sans aucune image cluster respectant la règle famille (cf. ci-dessous).
- **Sorties / annonces de produits clairement adultes (16+/18+) sans angle parental** : films violents (Kill Bill, John Wick, Saw, Halloween, Hostel), franchises de combat sanglant (Mortal Kombat), RPG dark fantasy mature (Dawnwalker, Diablo, Elden Ring), thrillers d'horreur, livres sombres pour public averti, jeux PEGI 18 — l'annonce promotionnelle seule **ne convient pas**, même si elle est ÉVÉNEMENT (sortie datée, casting confirmé). EXCEPTION : si l'article aborde explicitement l'angle parental (« attention parents : ce jeu n'est pas adapté aux enfants malgré son aspect », « le PEGI 18 surprend les familles », « comment expliquer aux ados qu'ils ne peuvent pas y jouer ») alors c'est légitime. **Test rapide : si le titre du contenu (Kill Bill, Mortal Kombat, etc.) suggère violence / horreur / contenu mature à un parent français, écarte sauf angle parental explicite.**

## RÈGLE IMAGE (famille avec enfants)

L'image s'affiche en page d'accueil. Une seconde de modération de pair est appliquée derrière toi (vision-LLM), mais tu DOIS déjà filtrer ici :

- ÉCARTER : visages déformés, maquillage d'horreur, créatures monstrueuses gros plan, scènes sanglantes, poses violentes, clair-obscur menaçant, posters de films d'horreur/slasher (Clayface, Halloween, etc.), photos sensationnalistes de procès/criminels, images 16+/18+, antagonistes type vampires/démons/orcs gros plan.
- PRIVILÉGIER : posters officiels grand public lumineux, photos d'ensemble du casting, captures d'ambiance lumineuse, portraits neutres, photos institutionnelles, illustrations éditoriales.

Si AUCUNE image cluster n'est acceptable, écarte l'histoire entière plutôt que d'utiliser une image limite.

## CITATIONS DIRECTES — encouragées

Quand un article source rapporte une déclaration nominative (élu, chercheur, dirigeant, expert, victime nommée, communiqué officiel), **tu peux et tu dois la relayer en citation directe** entre guillemets français « … ». C'est ce que fait le journalisme de qualité : la citation distingue clairement une opinion (celle de la personne citée) du récit neutre (le tien).

Format attendu :

> « Cette mesure s'appliquera dès la rentrée 2026 », a déclaré la ministre de l'Éducation Élisabeth Borne (Le Monde, 23 avril).
> « En termes simples, cette affaire ne met pas en danger la sécurité du Président », a écrit l'avocat Gregory Craig dans sa réponse au DOJ (CBS News).
> Le rapport conclut que « la moitié des collégiens passent plus de quatre heures par jour devant un écran » (INSERM, 2024).

Règles :
- Toujours **attribuer la citation à la personne nommée** (et à la fonction si l'article la donne) PUIS à la source qui rapporte ("a déclaré X (Le Monde)").
- N'invente JAMAIS une citation. Si l'article ne la fournit pas littéralement, paraphrase plutôt en attribution indirecte ("Selon X, …").
- Une histoire de 300-450 mots peut contenir 1 à 3 citations directes, idéalement de personnes différentes pour montrer la pluralité des voix.
- Si l'article ne contient AUCUNE citation, ne force pas — l'attribution indirecte ("Selon Le Monde, …") suffit.

## FORMAT DE CHAQUE HISTOIRE (output)

JSON par histoire :

- "title" : factuel et descriptif. "Sortie de X au cinéma le 21 octobre", pas "Le grand retour de X". Pas de qualificatif émotionnel.
- "summary" : 1-2 phrases descriptives, < 200 caractères.
- "body" : markdown, **300-450 mots**, 3 ou 4 paragraphes séparés par une ligne vide. Citations directes en « » bienvenues (cf. section précédente). Pour les histoires longues (≥ 400 mots), un sous-titre h3 ("### Titre court") au-dessus du para 3 ou 4 est autorisé pour aérer la lecture, mais pas obligatoire.

   - **Para 1** (~80-100 mots) — Le QUOI / QUI / OÙ / QUAND, en mode neutre, avec attribution dès la première mention forte ("Selon Le Monde…", "Numerama rapporte que…"). Pas de hook éditorial.
   - **Para 2** (~100-130 mots) — Les éléments concrets : les jeux nommés, les chiffres clés, les dates précises, les noms de personnes ou d'études. Chaque fait attribué nommément. Ne paraphrase pas la STRUCTURE de l'article ("le guide ne se contente pas de…") — livre les éléments directement. Si une déclaration figure dans la source, intègre-la en citation directe attribuée.
   - **Para 3** (~80-120 mots) — Mise en perspective relayée depuis les sources : conséquences chiffrées, réactions citées (souvent l'endroit naturel d'une 2ᵉ citation directe), comparaisons que les sources elles-mêmes établissent. Pas de jugement Totem.
   - **Para 4** (optionnel, ~50-80 mots) — Soit un détail pratique attribué (date, lieu, montant, recommandation officielle), soit une question ouverte relayée d'une source ("Plusieurs experts cités par Le Monde s'interrogent sur…"), soit une citation finale forte attribuée. Jamais une conclusion Totem.
- "category" : PARENTHOOD | FILM_TV | GAMES | READING.
- "relevanceScore" : 0 à 1, pertinence FAMILIALE (pas intérêt général).
- "imageUrl" : URL exacte de l'IMG d'un article du cluster, conforme à la règle famille.
- "sourceIndexes" : tableau des indexes des articles cités (entiers).

Cite les sources par leur nom de publication ("Le Monde", "Numerama", "Pew Research"). N'utilise JAMAIS "[0]", "[2]", "(article 3)" — les crochets dans la liste ci-dessous sont à usage interne uniquement.

N'invente AUCUN fait absent des articles fournis. **N'invente AUCUNE citation directe** : si une phrase est entre « », elle doit littéralement figurer dans le résumé d'un article fourni. Ne mentionne pas que tu es une IA.

## CONTRAINTES DURES

- Maximum 10 histoires, triées par pertinence décroissante.
- Body 300-450 mots. Si l'article est de type LISTE/GUIDE et que tu n'as pas les éléments listés, écarte. Pour un événement, une étude ou une annonce, tu peux atteindre 300 mots en relayant ce que les sources disent (qui, quoi, quand, attribution, mise en perspective citée) — pas besoin de matière exhaustive.
- Multi-sources : relevance ≥ 0.5. Single-source : relevance ≥ 0.7. INTL single-source : ≥ 0.6.
- Chaque imageUrl est l'IMG exacte d'un article cité (jamais inventer une URL).
- Français uniquement.
- Si tu ne trouves que 0, 1 ou 2 histoires solides, renvoie celles-là.

## OUTPUT

Réponds UNIQUEMENT avec ce JSON, sans markdown, sans texte avant ou après :
{"stories": [{"title": "...", "summary": "...", "body": "...", "category": "PARENTHOOD|FILM_TV|GAMES|READING", "relevanceScore": 0.X, "imageUrl": "https://...", "sourceIndexes": [0, 3]}]}

**RÈGLE D'ÉCHAPPEMENT JSON — CRITIQUE** : à l'intérieur des champs string ("title", "summary", "body"), n'utilise **JAMAIS** de double-quote ASCII " — utilise UNIQUEMENT les guillemets français « » pour les citations directes, et l'apostrophe typographique ' (ou ' droite). Une " non-échappée à l'intérieur d'un body casse le parseur JSON et toutes les histoires de la réponse sont perdues. Si tu hésites, remplace toute " par « ou » selon le contexte.
${alreadyPublished}${recentImagesNote}
Articles :

${list}`
}

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === "string")
}

function coerceStory(raw: unknown, itemCount: number, items: HydratedItem[]): SynthesizedStory | null {
  if (typeof raw !== "object" || raw === null) return null
  const r = raw as Record<string, unknown>
  const title = typeof r.title === "string" ? r.title.trim() : ""
  const summary = typeof r.summary === "string" ? r.summary.trim() : ""
  const body = typeof r.body === "string" ? r.body.trim() : ""
  const category = typeof r.category === "string" ? r.category : ""
  const imageUrl = typeof r.imageUrl === "string" ? r.imageUrl.trim() : ""
  const relevanceScore = typeof r.relevanceScore === "number" ? r.relevanceScore : 0

  const rawIdx = Array.isArray(r.sourceIndexes)
    ? r.sourceIndexes
    : isStringArray(r.sourceIndexes)
    ? (r.sourceIndexes as string[]).map((s) => Number(s))
    : []
  const sourceIndexes = rawIdx
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 0 && n < itemCount)

  if (!title || !summary || !body || !imageUrl) {
    console.warn(`[news-discover] coerce: missing field title="${title.slice(0, 60)}" hasSum=${!!summary} hasBody=${!!body} hasImg=${!!imageUrl}`)
    return null
  }
  if (!["PARENTHOOD", "FILM_TV", "GAMES", "READING"].includes(category)) {
    console.warn(`[news-discover] coerce: bad category="${category}" title="${title.slice(0, 60)}"`)
    return null
  }
  if (sourceIndexes.length === 0) {
    console.warn(`[news-discover] coerce: empty sourceIndexes title="${title.slice(0, 60)}"`)
    return null
  }

  // Body floor lowered from 200 → 150 words. The LLM is sometimes
  // conservative on event-style briefs and the quality judge already
  // rejects genuinely thin content via its lengthFit dimension. A
  // 150-word floor still kills tweet-length output but doesn't punish
  // a clean 180-word brief on a sparse topic.
  const wordCount = body.split(/\s+/).filter(Boolean).length
  if (wordCount < 150) {
    console.warn(`[news-discover] coerce: body too short (${wordCount}w) title="${title.slice(0, 60)}"`)
    return null
  }

  // Derive region from cited sources. Story is INTL only if ALL its
  // sources are INTL (mixed clusters are caught by the prompt rule —
  // this is a defensive belt).
  const allIntl = sourceIndexes.length > 0 && sourceIndexes.every((i) => items[i]?.sourceRegion === "INTL")

  return {
    slug: slugify(title),
    title,
    summary,
    body,
    category: category as NewsCategory,
    relevanceScore: Math.max(0, Math.min(1, relevanceScore)),
    imageUrl,
    sourceIndexes,
    region: allIntl ? "INTL" : "FR",
  }
}

export interface DiscoverStats {
  sourcesFetched: number
  itemsCollected: number
  itemsDroppedNoImage: number
  storiesSynthesized: number
  storiesDroppedInvalid: number
  storiesDroppedUnsuitable: number  // Pass-2 moderation rejects
  storiesDroppedImageReused: number // Cross-story image dedup
  storiesDroppedImageUnreachable: number
  storiesPersisted: number
  storiesUpdated: number
  archivedCount: number
  durationMs: number
  timings: {
    fetchRssMs: number
    resolveImagesMs: number
    synthesizeMs: number
    moderationMs: number
    persistMs: number
  }
}

export async function runNewsDiscover(): Promise<DiscoverStats> {
  const started = Date.now()
  const parser = makeParser()
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000)

  // 1. Fetch all feeds in parallel
  const fetchStart = Date.now()
  const fetchBatches = await Promise.all(NEWS_SOURCES.map((s) => fetchOne(parser, s, since)))
  const pairs = fetchBatches.flat()
  const fetchRssMs = Date.now() - fetchStart

  // 2. Resolve image per item (drops anything without one)
  const imageStart = Date.now()
  const hydrated: HydratedItem[] = []
  let droppedNoImage = 0
  await parallelMap(pairs, 6, async ({ source, item }) => {
    const imageUrl = await resolveImage(item as RssLikeItem)
    if (!imageUrl) {
      droppedNoImage++
      return
    }
    const iso = item.isoDate ?? item.pubDate
    if (!iso || !item.link || !item.title) {
      droppedNoImage++
      return
    }
    hydrated.push({
      sourceName: source.name,
      sourceCategory: source.category,
      sourceRegion: source.region ?? "FR",
      sourceCountry: source.country,
      title: item.title.trim(),
      link: item.link.trim(),
      summary: (item.contentSnippet ?? "").trim(),
      imageUrl,
      publishedAt: new Date(iso),
    })
  })

  // 3. Dedup by URL, then cap to MAX_TOTAL_ITEMS by recency (keeps Claude under timeout)
  const seen = new Set<string>()
  const unique = hydrated
    .filter((h) => {
      if (seen.has(h.link)) return false
      seen.add(h.link)
      return true
    })
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, MAX_TOTAL_ITEMS)
  const resolveImagesMs = Date.now() - imageStart

  if (unique.length === 0) {
    return {
      sourcesFetched: NEWS_SOURCES.length,
      itemsCollected: 0,
      itemsDroppedNoImage: droppedNoImage,
      storiesSynthesized: 0,
      storiesDroppedInvalid: 0,
      storiesDroppedUnsuitable: 0,
      storiesDroppedImageReused: 0,
      storiesDroppedImageUnreachable: 0,
      storiesPersisted: 0,
      storiesUpdated: 0,
      archivedCount: 0,
      durationMs: Date.now() - started,
      timings: {
        fetchRssMs,
        resolveImagesMs,
        synthesizeMs: 0,
        moderationMs: 0,
        persistMs: 0,
      },
    }
  }

  // 4. Load existing PUBLISHED stories from the same 72h window so we
  //    can both (a) tell Claude to skip them and (b) dedup at persist
  //    time by source-URL overlap, even if Claude paraphrases the title.
  const existingStories = await prisma.newsStory.findMany({
    where: { status: "PUBLISHED", publishedAt: { gte: since } },
    select: { id: true, slug: true, title: true, sources: true, imageUrl: true },
  })

  // Cross-story image dedup: collect every imageUrl already in the
  // 72h window so the synthesizer can avoid picking the same one for
  // a new story (Greystones bug — same kids-on-phones photo reused
  // across two unrelated stories on the same theme).
  const recentImageUrls = existingStories
    .map((s) => s.imageUrl)
    .filter((u): u is string => typeof u === "string" && u.length > 0)

  // Map every previously-published source URL to its existing story id.
  // First-seen wins on collisions (a single URL ideally appears once).
  const urlToExistingId = new Map<string, string>()
  // Parallel: title fingerprints for the second dedup layer (catches
  // paraphrased duplicates that share zero source URLs).
  const titleFingerprints: Array<{ id: string; tokens: Set<string> }> = []
  for (const story of existingStories) {
    titleFingerprints.push({ id: story.id, tokens: titleTokens(story.title) })
    if (!Array.isArray(story.sources)) continue
    for (const src of story.sources) {
      if (typeof src !== "object" || src === null) continue
      const url = (src as { url?: unknown }).url
      if (typeof url === "string" && !urlToExistingId.has(url)) {
        urlToExistingId.set(url, story.id)
      }
    }
  }

  // 5. Cluster + synthesize in one model call.
  //
  // Provider selection:
  //   - DeepSeek when DEEPSEEK_API_KEY is set (default — much cheaper
  //     for high-volume cron jobs). V4-Flash returns plenty for
  //     news clustering/summarization.
  //   - Anthropic Claude Haiku as fallback when DeepSeek isn't
  //     configured, or when NEWS_PROVIDER=anthropic is set explicitly.
  // Set NEWS_PROVIDER=anthropic to force Claude even with both keys.
  const synthStart = Date.now()
  const provider =
    process.env.NEWS_PROVIDER === "anthropic"
      ? "anthropic"
      : isDeepSeekAvailable()
        ? "deepseek"
        : "anthropic"
  const prompt = buildPrompt(
    unique,
    existingStories.map((s) => s.title),
    recentImageUrls,
  )

  // Bumped from 8000 → 14000 because body length spec went from 120-180
  // words to 300-450 words across up to 10 stories. Each story can now
  // run ~600 tokens of body text alone.
  const MAX_TOKENS = 14000
  let rawText = ""
  if (provider === "deepseek") {
    const ds = getDeepSeek()
    const response = await ds.chat.completions.create({
      model: DEFAULT_DEEPSEEK_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    })
    rawText = response.choices[0]?.message?.content ?? ""
  } else {
    const anthropic = getAnthropic()
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    })
    const textBlock = response.content.find((c) => c.type === "text")
    rawText = textBlock && "text" in textBlock ? (textBlock as { text: string }).text : ""
  }

  // Strip markdown code fences (```json … ```) before extracting the
  // outer JSON object — DeepSeek occasionally wraps responses despite
  // the "no markdown" instruction. Then parse leniently: if extraction
  // or parse fails, log the head and continue with an empty story
  // list so the cron returns "0 synthesized" rather than a 500.
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "")
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  let rawStories: unknown[] = []
  if (!jsonMatch) {
    console.warn(`[news-discover] ${provider} did not return JSON. head=${rawText.slice(0, 200)}`)
  } else {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { stories?: unknown[] }
      const candidate = parsed?.stories
      if (Array.isArray(candidate)) {
        rawStories = candidate
      } else {
        console.warn(`[news-discover] ${provider} returned no stories array (type=${typeof candidate})`)
      }
    } catch (e) {
      // Most common cause: unescaped " inside a body string.
      const msg = e instanceof Error ? e.message : "unknown"
      console.warn(
        `[news-discover] ${provider} returned malformed JSON: ${msg}. head=${jsonMatch[0].slice(0, 300)}`,
      )
    }
  }

  const allowedImages = new Set(unique.map((u) => u.imageUrl))
  // Defensive belt for the cross-story image dedup rule in the prompt.
  // Tracks both already-published images AND images claimed by earlier
  // stories within the same run, so two new stories can't share an image.
  const usedImages = new Set<string>(recentImageUrls)
  const validStories: SynthesizedStory[] = []
  let droppedInvalid = 0
  let droppedImageReused = 0
  for (const raw of rawStories) {
    // Lightweight title for logging when coerce fails outright.
    const rawTitle = (raw && typeof raw === "object" && typeof (raw as { title?: unknown }).title === "string")
      ? (raw as { title: string }).title.slice(0, 80)
      : "(no title)"

    const story = coerceStory(raw, unique.length, unique)
    if (!story) {
      droppedInvalid++
      // Surface the specific shape failure so Vercel logs explain why
      // the LLM's output was rejected (most often: body too short, or
      // category outside the allowed enum).
      console.warn(`[news-discover] dropped invalid shape: "${rawTitle}"`)
      continue
    }
    // Anti-hallucination: imageUrl must match one of the source images
    if (!allowedImages.has(story.imageUrl)) {
      droppedInvalid++
      console.warn(
        `[news-discover] dropped image-not-in-cluster: "${story.title.slice(0, 80)}" url=${story.imageUrl.slice(0, 100)}`,
      )
      continue
    }
    // Cross-story image dedup: skip if this image is already in use by
    // a previously-published story or by an earlier story in this run.
    // The prompt asks the model to avoid this; this is the belt.
    if (usedImages.has(story.imageUrl)) {
      droppedImageReused++
      continue
    }
    usedImages.add(story.imageUrl)
    // Two paths accepted:
    //   A) multi-source (>=2 distinct publishers) + relevance >= 0.5
    //   B) single-source + relevance >= 0.7 (strong family angle required)
    // Anything else is dropped — keeps weak single-outlet essays out while
    // still letting standout institutional studies or expert guides through.
    const distinctNames = new Set(story.sourceIndexes.map((i) => unique[i].sourceName))
    const isMultiSource = distinctNames.size >= 2
    const minRelevance = isMultiSource ? 0.5 : 0.6
    if (story.relevanceScore < minRelevance) {
      droppedInvalid++
      console.warn(
        `[news-discover] dropped low-relevance: "${story.title.slice(0, 80)}" score=${story.relevanceScore} ${isMultiSource ? "multi" : "single"}`,
      )
      continue
    }
    validStories.push(story)
  }

  // 5b. Pass-2 family-safety moderation (independent LLM call per story).
  //     Catches unsuitable subjects the synthesis prompt let through —
  //     horror movie releases, true-crime sensationalism, weird/disturbing
  //     content. Each story gets an `audience` tag (kid_safe | parent_only
  //     | unsuitable). Unsuitable rows are dropped before persistence.
  //     Fail-open: moderator errors → audience = "parent_only" (still ships).
  let droppedUnsuitable = 0
  const moderationStart = Date.now()
  await parallelMap(validStories, 4, async (s) => {
    // Run moderation + research extraction in parallel — they're both
    // independent LLM calls and we want to gate on both before persist.
    const [verdict, research] = await Promise.all([
      moderateStory({
        title: s.title,
        summary: s.summary,
        body: s.body,
        category: s.category,
        // Pass the original (un-mirrored) image URL so the vision model
        // can fetch it directly. Mirroring happens after this step, so
        // we only have the source URL at this point.
        imageUrl: s.imageUrl,
      }),
      extractResearch({ title: s.title, body: s.body }),
    ])
    s.audience = verdict.audience
    s.research = research
  })
  const moderatedStories = validStories.filter((s) => {
    if (s.audience === "unsuitable") {
      droppedUnsuitable++
      return false
    }
    return true
  })
  const moderationMs = Date.now() - moderationStart

  // 6. Mirror every chosen image into Supabase Storage. Many news
  //    sites (Sortiraparis, Le Monde, etc.) block hotlinking via
  //    Referer headers — the image returns 200 to a server-side HEAD
  //    but 403 to the actual browser GET. By downloading and re-
  //    serving from our own storage, we sidestep that entirely. As a
  //    bonus: stories survive even if the source CDN goes down.
  //    If the upload fails (origin returns <1KB blob, network error,
  //    Supabase disabled in dev), we drop the story.
  const mirrored = await Promise.all(
    moderatedStories.map((s) =>
      isStorageEnabled() ? uploadNewsImage(s.imageUrl) : Promise.resolve(s.imageUrl),
    ),
  )
  let droppedImageUnreachable = 0
  const liveStories: SynthesizedStory[] = []
  moderatedStories.forEach((s, i) => {
    const mirroredUrl = mirrored[i]
    if (mirroredUrl) {
      liveStories.push({ ...s, imageUrl: mirroredUrl })
    } else {
      droppedImageUnreachable++
    }
  })

  const synthesizeMs = Date.now() - synthStart

  // 7. Persist with three dedup layers + source-name dedup.
  const persistStart = Date.now()
  const now = new Date()
  let persisted = 0
  let updated = 0
  // Pre-load the catalog index once for the whole batch — every story
  // body gets scanned for catalog-title matches, replacing them with
  // /media/<id> markdown links. Bring news traffic back to the catalog.
  let catalogIndex: LinkableMedia[] = []
  try {
    catalogIndex = await loadCatalogIndex()
  } catch (err) {
    console.warn("[news-discover] catalog index load failed:", err)
  }
  for (const s of liveStories) {
    // Build the sources array, then collapse multiple entries from the
    // same publisher down to one (first-seen) — keeps the UI's source
    // pill row from showing "Sortiraparis · Sortiraparis · Sortiraparis…".
    const seenNames = new Set<string>()
    const sources = s.sourceIndexes
      .map((i) => ({
        name: unique[i].sourceName,
        url: unique[i].link,
        favicon: faviconFor(unique[i].link),
        headline: unique[i].title,
        publishedAt: unique[i].publishedAt.toISOString(),
      }))
      .filter((src) => {
        if (seenNames.has(src.name)) return false
        seenNames.add(src.name)
        return true
      })
    const publishedAt = new Date(
      Math.min(...s.sourceIndexes.map((i) => unique[i].publishedAt.getTime())),
    )

    // Dedup layer A: any source URL already owned by an existing story?
    let matchedExistingId: string | null = null
    for (const src of sources) {
      const id = urlToExistingId.get(src.url)
      if (id) {
        matchedExistingId = id
        break
      }
    }

    // Dedup layer B: title fingerprint Jaccard ≥ TITLE_DEDUP_THRESHOLD.
    // Catches paraphrased duplicates that share no source URLs (e.g.
    // "Miffy et Pokémon pour occuper les vacances" vs
    // "Miffy et Pokémon parfaits pour les vacances").
    if (!matchedExistingId) {
      const newTokens = titleTokens(s.title)
      for (const fp of titleFingerprints) {
        if (jaccard(newTokens, fp.tokens) >= TITLE_DEDUP_THRESHOLD) {
          matchedExistingId = fp.id
          break
        }
      }
    }

    // Inject /media/<id> links for catalog titles mentioned in the
    // body. Capture the first match as relatedMediaId for the bottom
    // 'Voir la fiche complète sur Totem Avisé' CTA on the story page.
    const { body: linkedBody, primaryMediaId } = linkifyStoryBody(s.body, catalogIndex)

    // Adult-content guard: if the primary catalog match is age 14+,
    // the story is about a film/show/game whose audience isn't this
    // page's. Demote to PENDING_REVIEW so a human can decide whether
    // to publish (parental-warning angle) or archive (pure
    // promotion). Catches Kill Bill, Mortal Kombat, Saw, etc.
    const primary = primaryMediaId ? findInCatalog(catalogIndex, primaryMediaId) : undefined
    const isAdultMatch =
      primary?.expertAgeRec !== null &&
      primary?.expertAgeRec !== undefined &&
      primary.expertAgeRec >= ADULT_CONTENT_AGE_FLOOR
    if (isAdultMatch) {
      console.warn(
        `[news-discover] demoted to PENDING_REVIEW (adult catalog match age=${primary?.expertAgeRec}): "${s.title.slice(0, 80)}"`,
      )
    }

    const data = {
      title: s.title,
      summary: s.summary,
      body: linkedBody,
      category: s.category,
      sources,
      imageUrl: s.imageUrl,
      publishedAt,
      relevanceScore: s.relevanceScore,
      status: isAdultMatch ? ("PENDING_REVIEW" as const) : ("PUBLISHED" as const),
      region: s.region,
      audience: s.audience ?? "parent_only",
      research: s.research ? (s.research as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      relatedMediaId: primaryMediaId,
    }

    if (matchedExistingId) {
      await prisma.newsStory.update({
        where: { id: matchedExistingId },
        data,
      })
      for (const src of sources) urlToExistingId.set(src.url, matchedExistingId)
      // Refresh fingerprint so within-run subsequent stories see it too.
      const existingFp = titleFingerprints.find((fp) => fp.id === matchedExistingId)
      if (existingFp) existingFp.tokens = titleTokens(s.title)
      updated++
      continue
    }

    let slug = s.slug || slugify(s.title) || `story-${now.getTime()}`
    let suffix = 1
    while (true) {
      const existing = await prisma.newsStory.findUnique({ where: { slug } })
      if (!existing) break
      suffix++
      slug = `${s.slug}-${suffix}`
    }

    // Pass-3 quality gate (only on fresh creates; updates are dedup
    // merges where the body usually doesn't change drastically).
    // Below threshold → PENDING_REVIEW so a human can decide.
    const qualityVerdict = await judgeStory({
      title: s.title,
      summary: s.summary,
      body: s.body,
      category: s.category,
      format: "BRIEF",
      sourceNames: sources.map((src) => src.name),
    })
    const qualityStatus = qualityVerdict.passes ? data.status : ("PENDING_REVIEW" as const)

    const created = await prisma.newsStory.create({
      data: { slug, ...data, status: qualityStatus },
    })
    if (!qualityVerdict.passes) {
      console.warn(
        `[news-discover] story ${created.id} flagged PENDING_REVIEW — ` +
          `overall=${qualityVerdict.overall} reason="${qualityVerdict.reason}"`,
      )
    }
    for (const src of sources) urlToExistingId.set(src.url, created.id)
    titleFingerprints.push({ id: created.id, tokens: titleTokens(s.title) })
    persisted++
  }

  // 6. Archive anything older than 180 days. Synthesised stories are
  //    valuable on their own so we keep them browseable for ~6 months
  //    via /apercudecouverte/actualites pagination, then quietly age
  //    them out of the active feed.
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
  const archived = await prisma.newsStory.updateMany({
    where: { status: "PUBLISHED", publishedAt: { lt: cutoff } },
    data: { status: "ARCHIVED" },
  })
  const persistMs = Date.now() - persistStart

  return {
    sourcesFetched: NEWS_SOURCES.length,
    itemsCollected: unique.length,
    itemsDroppedNoImage: droppedNoImage,
    storiesSynthesized: rawStories.length,
    storiesDroppedInvalid: droppedInvalid,
    storiesDroppedUnsuitable: droppedUnsuitable,
    storiesDroppedImageReused: droppedImageReused,
    storiesDroppedImageUnreachable: droppedImageUnreachable,
    storiesPersisted: persisted,
    storiesUpdated: updated,
    archivedCount: archived.count,
    durationMs: Date.now() - started,
    timings: {
      fetchRssMs,
      resolveImagesMs,
      synthesizeMs,
      moderationMs,
      persistMs,
    },
  }
}
