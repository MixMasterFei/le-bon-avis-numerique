import Parser from "rss-parser"
import { prisma } from "@/lib/prisma"
import { getAnthropic } from "@/lib/anthropic"

// Sonnet model id for synthesis. Stronger writing than Haiku at ~3x
// the cost — only worth it for the user-visible briefs surface, not
// the cost-sensitive support paths (moderation, research extraction,
// quality judge use Haiku via their DEFAULT_MODEL imports).
//
// Single-provider Claude across the pipeline (May 2026 redesign): the
// previous DeepSeek+OpenAI+Claude triple cascade was the source of
// recurring silent failures. Removing it eliminates two providers
// from the active path and unifies billing, rate-limits, and timeout
// behavior. DeepSeek/OpenAI clients still exist in the codebase but
// are no longer called.
const SYNTHESIS_ANTHROPIC_MODEL = "claude-sonnet-4-6"
import { moderateStory, type Audience } from "@/lib/news-moderate"
import { judgeStory } from "@/lib/news-quality-judge"
import { loadCatalogIndex, extractCatalogMatchesFromStory, findInCatalog, type LinkableMedia } from "@/lib/news-linkify"
import { identifyMediaSubjectTerms, verifyCatalogSubjects } from "@/lib/news-subject-verify"

// Stories whose primary catalog match has a recommended age at or
// above this threshold get demoted to PENDING_REVIEW instead of
// auto-publishing on the family-news page. Catches Kill Bill,
// Mortal Kombat, Saw, and similar violent/mature franchises that
// slip past the synthesis prompt's "adult content" rule.
const ADULT_CONTENT_AGE_FLOOR = 14
import { extractResearch, type ResearchSidebar } from "@/lib/news-research"
import { NEWS_SOURCES, type NewsSource } from "@/lib/news-sources"
import { resolveImage, isImageLargeEnough, fallbackCard, type RssLikeItem, type ImageSourceType } from "@/lib/news-image"
import { isLowQualityImagePublisher } from "@/lib/news-image-policy"
import { judgeEditorial, DEFAULT_EDITORIAL_VERDICT } from "@/lib/news-editorial-judge"
import { slugify, faviconFor } from "@/lib/news-slug"
import { uploadNewsImage, isStorageEnabled } from "@/lib/supabase-storage"
import { Prisma } from "@prisma/client"
import type { NewsCategory } from "@prisma/client"

const EMIT_NEWS_STORIES_TOOL = {
  name: "emit_news_stories",
  description: "Return the synthesized Totem Avisé news stories.",
  input_schema: {
    type: "object" as const,
    properties: {
      stories: {
        type: "array" as const,
        maxItems: 3,
        items: {
          type: "object" as const,
          additionalProperties: false,
          properties: {
            title: { type: "string" as const, minLength: 20, maxLength: 90 },
            summary: { type: "string" as const, minLength: 80, maxLength: 260 },
            body: { type: "string" as const, minLength: 1200, maxLength: 4500 },
            familyTakeaway: { type: "string" as const, minLength: 250, maxLength: 900 },
            category: {
              type: "string" as const,
              enum: ["PARENTHOOD", "FILM_TV", "GAMES", "READING", "TECH"],
            },
            relevanceScore: { type: "number" as const, minimum: 0, maximum: 1 },
            imageUrl: { type: "string" as const, minLength: 10 },
            sourceIndexes: {
              type: "array" as const,
              minItems: 1,
              items: { type: "integer" as const, minimum: 0 },
            },
          },
          required: [
            "title",
            "summary",
            "body",
            "familyTakeaway",
            "category",
            "relevanceScore",
            "imageUrl",
            "sourceIndexes",
          ],
        },
      },
    },
    required: ["stories"],
    additionalProperties: false,
  },
}

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
  // Provenance attached by resolveImage(). Carried through synthesis
  // so the chosen image's tier follows it into the persisted NewsStory.
  imageSourceType: ImageSourceType
  imageCredit: string
  imageLicenseUrl?: string
  publishedAt: Date
}

interface SynthesizedStory {
  slug: string
  title: string
  summary: string
  body: string
  // The "Ce que ça signifie pour les familles" boxed aside. Carries
  // Totem's editorial voice — the body stays neutral. 60-120 words
  // plain text. Null when the LLM didn't supply one (defensive only;
  // the quality judge demotes any brief without it to PENDING_REVIEW).
  familyTakeaway: string | null
  category: NewsCategory
  relevanceScore: number
  imageUrl: string
  // Provenance for the image the LLM picked. Looked up in coerceStory
  // by matching the chosen URL back to its HydratedItem.
  imageSourceType: ImageSourceType
  imageCredit: string
  imageLicenseUrl?: string
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
// Total items we forward to the synthesis LLM. Split into a per-
// region budget to guarantee INTL representation — without this,
// the FR firehose (lemonde, la-croix, etc. publish hourly) crowds
// out the slower-cadence INTL feeds (NYT, BBC, Spiegel, El País
// often publish 2-3 family items/day) when we just take top-60-by-
// recency. 50 FR + 25 INTL keeps the prompt under timeout while
// reliably surfacing 'Vu d'ailleurs' material.
// Reduced again in May 2026 after Sonnet routinely hit the 180s
// synthesis timeout with 45 inputs and 400-600 word briefs. The cron
// runs four times daily, so a smaller but dependable batch is better
// than a richer prompt that regularly produces 0 stories.
const FR_BUDGET = 18
const INTL_BUDGET = 8

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

**ATTENDU EN SORTIE : sur les ${items.length} articles fournis, retiens 2 à 3 histoires.** La page ne peut pas vivre sans contenu — un retour à 0 ou 1 histoire signifie que tu es trop strict sur les ÉVÉNEMENTS (annonces, sorties, études, décisions). Mais à l'inverse, retenir 3 histoires faibles est pire que 2 fortes : la qualité prime sur la quantité. **Si tu hésites pour une histoire, écarte-la** — surtout pour les LISTE/GUIDE sans éléments nommés et les contenus mature/adulte sans angle parental.

## LIGNE ÉDITORIALE TOTALE : DES PARENTS AVISÉS, PAS ANXIEUX

Totem Avisé n'est pas un fil d'alertes. La page doit aider les familles à comprendre, choisir, découvrir et agir — pas leur donner l'impression que tout va mal. **Privilégie les sujets qui donnent du pouvoir d'agir** : une ressource fiable, une sortie culturelle, un contenu jeunesse à repérer, une décision qui change concrètement le quotidien, un conseil vérifiable, une conversation utile à ouvrir avec un enfant.

**Équilibre attendu dans les 2-3 histoires :**
- Si une histoire est grave ou anxiogène (accident, justice, danger, harcèlement, santé, sécurité), elle doit apporter un levier concret : prévention, ressource, recommandation officielle, outil parent, repère d'âge, démarche à suivre. Sinon, écarte.
- Quand les sources le permettent, retiens au moins une histoire **culturelle, pratique ou constructive** : film jeunesse, livre enfant, jeu familial, exposition, ressource éducative, guide de parentalité numérique, initiative utile.
- Évite de publier plusieurs histoires anxiogènes dans le même run. Si plusieurs sujets graves sont disponibles, choisis le plus utile pour les familles et équilibre avec un sujet plus respirable.
- Ne dramatise jamais un sujet pour le rendre important. Un parent avisé a besoin de repères sobres, pas d'un sentiment d'urgence permanent.

Voici ${items.length} articles publiés ces 48 dernières heures, chacun avec un index, une source, une catégorie, un titre, une URL, une image et un résumé.

## TROIS PRINCIPES (par ordre de priorité)

**1. Relayer le CONTENU, pas la méta-information.**
   Tu écris sur le sujet, pas sur l'article. La règle s'applique à toutes les histoires, mais le seuil dépend du TYPE d'article :

   **(a) Articles de type ÉVÉNEMENT** — sortie, annonce, étude, décision, polémique, fait nouveau. Tu peux écrire dès que le résumé fourni te donne **au moins** : qui (la personne / institution / œuvre), quoi (l'événement nommé), quand (la date ou la fenêtre temporelle). Tu n'as pas besoin de détails exhaustifs — tu rapportes ce que les sources disent, en attribuant. Une sortie de film avec titre + date suffit pour 300 mots.

   **(b) Articles de type LISTE / GUIDE / SÉLECTION / TOP-N / CLASSEMENT** — ici la valeur EST la liste. Si le résumé fourni ne nomme PAS les éléments concrets de la liste (les jeux du top 10, les séries de la sélection, les outils du guide), ÉCARTE. Tu ne peux pas relayer une liste dont tu n'as pas les éléments.

   **EXEMPLE NÉGATIF — à NE PAS retenir** : un article intitulé "4 séries Netflix à ne pas manquer en avril selon AlloCiné" → **ÉCARTE dans tous les cas** :
   - Si le résumé ne nomme PAS les séries : impossible à relayer (méta-paraphrase comme l'exemple Numerama).
   - Si le résumé nomme les séries mais qu'elles sont pour adultes (drames, thrillers, romance) : sujet hors-périmètre Totem (cf. Principe 3).
   - Si le résumé nomme des séries famille (animation, séries jeunesse) : envisageable, mais en pratique ces sélections AlloCiné/Allociné Séries / Le Figaro Cinéma sont presque toujours pour adultes — par défaut, **écarte**.

   Même règle pour les sélections Le Monde, Télérama, Le Figaro, Première : un guide de sortie hebdomadaire ne sert pas le lecteur Totem sauf si les œuvres listées sont explicitement pour familles/jeunes.

   **(c) Articles d'analyse / d'étude chiffrée** — si l'angle est "X% de…", "tendance à…", il te faut au moins UN chiffre ou UNE conclusion concrète dans le résumé. Sinon écarte.

   **INTERDIT (toutes catégories)** :
   - "Numerama publie un guide qui liste 10 jeux" → on attend les jeux, pas l'existence du guide.
   - "Le site X présente une sélection de 5 séries" → pareil, vide.
   - "La rédaction précise avoir testé" / "Le guide ne se contente pas de…" → paraphrase de la structure éditoriale du source, pas du contenu.
   - "L'article du Monde explique que la situation est complexe" → traite le sujet directement avec attribution.

   **EXIGÉ** : attribution nommée des affirmations fortes ("Selon Le Monde…", "Numerama rapporte…"), faits concrets que tu as réellement (titres, dates, lieux, chiffres, noms). Pour un événement, écrire 300 mots sobres est OK même avec un résumé bref ; pour un top 10 sans la liste, écarte.

   **EXEMPLE D'HISTOIRE ÉVÉNEMENT ACCEPTABLE** (résumé source minimal : Sortie de Avatar 3 le 19 décembre 2026 dans les salles françaises, distribution Disney/Fox. Réalisateur James Cameron. Confirmé par Variety et AlloCiné.). Le brief produit doit faire **300-450 mots structurés en lede + deux sections H2**, comme dans cet exemple (le contenu ci-dessous est ce que tu mettrais dans le champ "body" d'une histoire ; le champ "familyTakeaway" est en plus, séparé) :

   Body :

   Avatar 3 sort dans les salles françaises le 19 décembre 2026, ont annoncé Disney et la 20th Century Fox la semaine du 25 avril. Le troisième volet de la saga de James Cameron prend place sur Pandora plusieurs années après les événements d'Avatar 2 : la Voie de l'eau, sorti fin 2022. Selon AlloCiné, le film conserve Sam Worthington dans le rôle de Jake Sully et Zoe Saldana dans celui de Neytiri.

   ## Une date de Noël assumée par Disney

   La date du 19 décembre s'inscrit dans la fenêtre des sorties familiales pour les vacances de Noël, créneau exploité par chaque opus précédent de la saga. Variety rapporte que le scénario explore le peuple Ash, une nouvelle tribu Na'vi orientée sur le feu, après l'introduction du peuple Metkayina (peuple de l'eau) dans le précédent volet. Premiere indique que le tournage en motion-capture a duré près de quatre ans entre la Nouvelle-Zélande et les studios Manhattan Beach, en Californie.

   « Nous emmenons les spectateurs dans des territoires de Pandora qu'on n'a jamais vus », a déclaré James Cameron lors de la convention CinemaCon, selon Variety. La durée annoncée par les distributeurs reste à confirmer mais devrait dépasser trois heures, comme le précédent volet (3h12).

   ## Une classification française encore en attente

   Disney a précisé à AlloCiné que le film sera distribué simultanément en IMAX, 3D HFR (high frame rate) et version standard, mais la stratégie tarifaire pour les séances premium n'a pas encore été détaillée pour la France. Aucun classement officiel français n'a été publié à ce jour.

   Les deux premiers volets de la saga étaient classés tous publics avec avertissement, mention liée à des scènes de bataille. Le CNC précisera son avis dans les semaines précédant la sortie. « Nous attendons la décision finale de la commission », a indiqué un porte-parole de Disney France à Premiere. Une bande-annonce mondiale est attendue lors de la convention CinemaCon de Las Vegas.

   FamilyTakeaway :

   Pour les familles qui ont aimé les deux premiers Avatar, la sortie est calée sur les vacances de Noël comme prévu. Attention particulière sur le classement final du CNC : les volets précédents étaient « tous publics avec avertissement » pour les scènes de bataille, et un Avatar 3 plus dense pourrait passer à 12+. Les séances IMAX et 3D HFR ont des billets premium plus chers — point à anticiper pour un budget famille.

   Cet exemple body fait ≈ 480 mots et le familyTakeaway ≈ 80 mots. Ce qui le rend acceptable : (1) lede de 80 mots qui livre qui/quoi/quand avec attribution dès la première mention forte, (2) deux sections H2 aux titres descriptifs choisis par toi, (3) deux citations directes attribuées nommément (Cameron via Variety, porte-parole Disney via Premiere), (4) un familyTakeaway concret (le classement à surveiller, le coût des séances IMAX) — pas une platitude type « ouvrez le dialogue ». **Vise toujours 300-450 mots dans body** (un brief sous 220 mots sera rejeté), **toujours exactement 2 sections H2** (titres générés par toi, descriptifs et factuels), **toujours au moins 2 citations directes en « »** quand les sources en fournissent, **toujours un familyTakeaway de 60-120 mots**. **N'utilise PAS de double-quote ASCII " dans le body ni le familyTakeaway** — utilise les guillemets français « » pour les citations directes (cf. règle d'échappement JSON plus bas).

**2. Voix neutre, jamais éditoriale.**
   Tu rapportes ce que les sources disent ; tu n'as pas d'avis.
   - INTERDIT : qualificatifs dans le titre ("une initiative qui inspire", "un signal alarmant"), questions rhétoriques ("Pour combien de temps ?"), conclusions personnelles ("on ne peut que saluer", "il est temps que…"), vocabulaire éditorial (*enfin, malheureusement, fort heureusement, étonnamment, sans surprise, à juste titre, courageux, lucide, alarmant, prometteur, salutaire*), hooks éditoriaux ("Pour les parents qui…", "Les familles concernées par…").
   - EXIGÉ : chaque affirmation forte est attribuée nommément ("Selon Le Monde, …", "Pew Research observe que…", "L'étude de l'INSERM rapporte que…"). Une opinion forte va entre guillemets avec attribution : « Cette initiative montre que… », a déclaré la maire (Le Monde, 23 avril).
   - Exception : un cadrage factuel sans jugement est autorisé ("La recommandation s'applique aux enfants de moins de 13 ans").

**3. Le SUJET doit concerner les familles. Test simple : pourquoi cette histoire sur Totem Avisé ?**
   Totem Avisé est un guide pour aider les familles françaises à choisir des contenus adaptés à leurs enfants — équivalent français de Common Sense Media. Chaque histoire doit avoir un **lien clair avec ce périmètre** :

   **À RETENIR — sujets pertinents** :
   - Films, séries, jeux, livres **destinés aux familles ou aux jeunes** (animation, films d'aventure tous publics, jeux PEGI 3-12, séries pour enfants/ados, romans jeunesse), y compris les sorties, sélections, festivals, prix et ressources qui aident à choisir.
   - Films/séries **regardés en famille** (Avatar, Disney/Pixar, Stranger Things, blockbusters grand public — même si ados/adultes les regardent aussi).
   - **Études et institutions** sur la jeunesse : santé des enfants, écrans, sommeil, alimentation, harcèlement scolaire, INSERM, Santé publique France, Pew Research.
   - **Décisions éducatives ou réglementaires** : école, collège, lycée, ministère de l'Éducation, recommandations parentales officielles.
   - **Parentalité numérique** : contrôle parental, réseaux sociaux & jeunes, temps d'écran.
   - **Sorties culturelles famille** : expos enfants, festivals, événements pour familles.
   - **Ressources constructives pour parents avisés** : éducation aux médias, choix de livres/films/jeux, outils de parentalité numérique, guides pratiques, activités à faire avec les enfants, initiatives qui donnent des repères sans dramatiser.
   - **Industrie famille** : Disney, Pixar, Nintendo, Netflix Kids, livres jeunesse, plates-formes éducatives.
   - **Tech & IA pour les familles** (catégorie TECH) : ChatGPT/IA générative dans la vie famille (comment l'expliquer aux enfants, l'utiliser ensemble, l'encadrer), régulation des réseaux sociaux pour les jeunes, outils de contrôle parental, EdTech, annonces d'appareils touchant la vie famille (smartphones jeunesse, liseuses enfants), études sur l'usage du numérique chez les jeunes. **Cherche activement l'angle famille dans les actus tech** — un lancement d'un nouveau modèle d'IA n'est en soi pas pertinent ; en revanche "5 façons d'utiliser ChatGPT avec ses enfants" ou "l'IA dans les devoirs scolaires : ce que disent les profs" l'est.

   **À ÉCARTER — sujets sans lien** :
   - Films / séries **strictement adultes sans angle famille** : suite d'une comédie adulte (Le Diable s'habille en Prada 2), drame intimiste, biopic d'adultes, thriller pour adultes — même si grand public, l'histoire ne sert pas le lecteur de Totem.
   - **Adaptations littéraires d'œuvres pour adultes** : romans pour adultes adaptés en film/série (La Maison aux esprits d'Isabel Allende, Sukkwan Island de David Vann, drames littéraires Goncourt). Même si « famille » apparaît dans le synopsis (saga familiale, drame père-fils), si l'œuvre originale est destinée à un lectorat adulte, l'adaptation reste hors-périmètre.
   - Sorties d'adultes même non-violentes : films de mode, romance pour adultes, comédie de bureau, drame d'auteur.
   - Annonces de gadgets, célébrités, mondanités sans rapport avec les enfants.
   - **Test simple à appliquer à chaque candidat** : « Un parent qui consulte ce site pour savoir quoi montrer / lire / faire avec ses enfants — cette histoire l'aide-t-elle ? » Si la réponse est non, écarte, même si l'article est intéressant en soi.

   **Ton (séparé du sujet)** — règles pour le BODY uniquement, pas pour le familyTakeaway :
   - **NE COMMENCE PAS** par "Pour les parents qui…", "Les familles concernées…", "À retenir pour les enfants de X ans" — formules éditoriales redondantes dans le body journalistique. La pertinence se prouve par le sujet, pas par une formule d'ouverture.
   - **NE TERMINE PAS le body** par une exhortation Totem ("Voici de quoi alimenter vos discussions à table"). Le body se clôt soit sur une **question relayée d'une source** ("Plusieurs experts cités par Le Monde s'interrogent sur la pérennité du dispositif."), soit sur une **observation factuelle** ("Le ministère doit publier ses recommandations finales avant l'été."), jamais un commentaire Totem.
   - **Le commentaire Totem va dans le champ familyTakeaway**, pas dans le body. C'est le seul endroit où ta voix éditoriale est autorisée. Voir la section FAMILY TAKEAWAY plus bas.

## CLUSTERING

Deux chemins pour créer une histoire :

**A — Multi-sources (préféré).** Un événement précis couvert par ≥ 2 publications distinctes. Relevance ≥ 0.55.

**B — Single-source.** Un article isolé avec angle famille fort (étude sérieuse, annonce institutionnelle, guide parental concret, recommandation experte). Relevance ≥ 0.7 obligatoire — un seul article sans relais d'autres rédactions doit prouver une utilité parentale immédiate, pas juste un sujet « intéressant ».

**Événement précis** = une sortie datée, une annonce officielle, une étude publiée, une décision institutionnelle, une polémique nommable, un guide pratique avec contenu concret.

**Pas un thème** = "les livres", "les jeux vidéo en avril", "la philosophie" — ce sont des catégories, pas des événements.

Ne fusionne JAMAIS deux sujets différents en une seule histoire (ex : un article sur Tolkien + un article sur Saint Augustin → DEUX sujets distincts, pas un cluster).

## INTERNATIONAL (Vu d'ailleurs)

Articles étiquetés "· INTL/<pays>" = publications étrangères. Une histoire est 100% FR ou 100% INTL — jamais mixte.

Pour les histoires INTL :
- Traduis intégralement en français.
- Para 1 situe le pays ("Aux États-Unis…", "Au Royaume-Uni…", "En Allemagne…").
- Para 3 fait le pont avec les familles françaises sans surinterpréter ("Selon les chercheurs cités, ce constat fait écho à…").
- Single-source INTL : relevance ≥ 0.65 suffit.

## À ÉCARTER

- Politique pure (élections, gouvernement, débats partisans) sauf impact direct école / famille / numérique des jeunes.
- Sport (sauf compétitions ou événements famille) et faits divers.
- **Films / séries / jeux / livres pour public exclusivement adulte** (cf. Principe 3) : comédies adultes (Le Diable s'habille en Prada 2), drames intimistes, biopics d'adultes, thrillers, romance pour adultes, films d'auteur, jeux PEGI 16+/18+. Même non-violents, ces contenus ne servent pas un lecteur qui vient sur Totem pour son enfant.
- Articles dont le titre + résumé ne donnent ni qui, ni quoi, ni quand.
- Articles sans aucune image cluster respectant la règle famille.
- **Curiosités sans angle parental actionnable** — éclipse / phénomène astronomique sans hook scolaire ou d'observation famille concret, revival d'un produit tech obscur (vieux jeu indé re-mis en ligne, navigateur de niche), lancement d'un produit single-vendor sans enjeu pour les foyers (nouveau modèle d'IA générique sans mode parental, mise à jour d'app sans impact sur les jeunes), faits divers « insolites » qui amusent mais n'aident aucun parent à décider quoi que ce soit. **Test : un parent qui a 5 minutes le matin avant l'école — il en fait quoi de cette info ?** Si la réponse honnête est « rien », écarte.
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

- "title" : factuel et descriptif. "Sortie de X au cinéma le 21 octobre", pas "Le grand retour de X". Pas de qualificatif émotionnel. **Longueur ≤ 75 caractères** (l'UI tronque au-delà). **Les 45 premiers caractères doivent contenir le NOM PROPRE et l'enjeu famille** — un titre qui dit « New Mexico remporte une victoire historique contre Meta pour la… » est inutilisable car le mot crucial (« protection des mineurs ») est coupé. Mieux : « Meta condamné aux USA pour ses risques sur les ados » (52 chars, sujet + enjeu en clair).
- "summary" : **1ère phrase = pourquoi ça concerne les familles, sans décodage requis.** 2ème phrase optionnelle = chiffre/fait clé. < 200 caractères au total. Un parent qui lit uniquement le summary doit comprendre l'enjeu pour son foyer en 5 secondes.
- "body" : markdown, **300-450 mots**, structuré en **un lede + exactement deux sections H2** dont tu choisis les titres. Les titres H2 doivent être courts, descriptifs et factuels (pas éditoriaux) — ex. « Une date de Noël assumée par Disney », « Une classification française encore en attente », « Un dispositif déjà testé à Marseille ». **Pas de H3 dans le body.** Citations directes en « » obligatoires quand les sources les fournissent (minimum 2, idéalement une par section).
  Markdown autorisé, mais sobre :
   - Mets les titres d'œuvres en *italique* : *Star Fox 64*, *Le Seigneur des Anneaux*.
   - Mets en **gras** seulement les repères vraiment utiles : dates, âges, montants, décisions officielles, seuils, noms de dispositifs. Maximum 3 à 6 passages en gras par histoire.
   - N'ajoute pas d'URL dans le body : l'interface lie automatiquement les noms de sources cités ("Le Monde", "Numerama", etc.) vers les articles d'origine.
   - Pas de listes si le texte se lit naturellement en paragraphes.

   - **Lede** (~50-80 mots, sans titre) — Le QUOI / QUI / OÙ / QUAND en deux ou trois phrases, avec attribution dès la première mention forte ("Selon Le Monde…", "Numerama rapporte que…"). Un chiffre concret ou un nom propre dans la première phrase si la matière le permet. Pas de hook éditorial.
   - **## Section 1** (titre H2 généré par toi, ~120-170 mots) — Les faits. Les éléments concrets : titres nommés, chiffres, dates précises, personnes ou études citées. Chaque affirmation forte attribuée nommément. Au moins une citation directe en « » de cette section quand la source en fournit une, au format : « citation », a déclaré [nom], [fonction] (Source, [date]). Ne paraphrase pas la STRUCTURE de l'article — livre le contenu.
   - **## Section 2** (titre H2 généré par toi, ~120-170 mots) — Le contexte, les réactions, ou ce qui est en jeu. Deuxième citation directe (ou attribution indirecte si les sources n'en fournissent pas). Quand deux publications divergent ou se complètent sur l'angle, croise-les nommément ("Selon Le Monde X, tandis que Numerama souligne Y"). Conclus sur une observation factuelle ou une question relayée d'une source — jamais sur un commentaire Totem.

- "familyTakeaway" : **CHAMP NOUVEAU OBLIGATOIRE.** Voir la section FAMILY TAKEAWAY plus bas pour le format détaillé.
- "category" : PARENTHOOD | FILM_TV | GAMES | READING | TECH. TECH = IA générative, contrôle parental, régulation des réseaux sociaux pour les jeunes, outils de temps d'écran, EdTech, annonces d'appareils touchant la vie famille (distinct de GAMES qui couvre l'industrie du jeu vidéo).
- "relevanceScore" : 0 à 1, pertinence FAMILIALE (pas intérêt général).
- "imageUrl" : URL exacte de l'IMG d'un article du cluster, conforme à la règle famille.
- "sourceIndexes" : tableau des indexes des articles cités (entiers).

## FAMILY TAKEAWAY — le champ "familyTakeaway"

Le seul endroit où ta voix éditoriale est autorisée. Le body reste 100% journalistique et neutre ; ce champ est rendu côté UI dans une **boîte distincte** intitulée « Ce que ça signifie pour les familles », visuellement séparée du body, en bas de l'article.

**Format :** texte plat, **60-120 mots**, 2 à 3 phrases. Pas de markdown, pas de titre, pas de liste à puces.

**Contenu attendu :** un angle parental concret et utile, ancré dans les faits du body.
- Que faire / regarder / surveiller pour leur foyer compte tenu de l'info ?
- Quel point précis vérifier (classement, prix, âge minimum, contrôle parental) ?
- Quelle conversation cette info permet d'ouvrir avec leurs enfants ?

**À éviter absolument :**
- Platitudes vagues : "ouvrez le dialogue", "soyez vigilants", "discutez en famille", "à utiliser comme prétexte" — vide.
- Reformulation du body — la boîte n'est pas un résumé, c'est une mise en perspective parentale.
- Phrases vides type "Cette information peut intéresser les parents" — tautologie.
- Conseil non-ancré dans l'article ("limitez le temps d'écran" sur un article qui ne parle pas de temps d'écran).

**Bons exemples :**
- "Bonne occasion d'expliquer aux ados pourquoi les données de localisation sont sensibles, en partant du fait que Snapchat a été condamné. Pour les plus jeunes, l'angle est simple : pourquoi tous les amis ne doivent pas savoir où on est."
- "Si vous prévoyez d'emmener un enfant de moins de 10 ans, attendez le classement final du CNC — les volets précédents étaient « tous publics avec avertissement » et le troisième pourrait passer à 12+. Les séances IMAX et 3D HFR ont des billets premium plus chers, à anticiper sur le budget famille."
- "Pas une lecture à mettre entre les mains des moins de 14 ans malgré la couverture jeunesse : le rapport INSERM cité indique que les violences sexuelles dans les manga shounen ne sont pas signalées dans le PEGI papier. Vérifiez le label « manga seinen » avant achat."

Si l'article ne se prête sincèrement à aucun angle parental concret (très rare — par définition le sujet a été retenu parce qu'il en a un), écris une takeaway courte qui explique POURQUOI les parents devraient noter cette info même sans action immédiate. Mais avant d'écrire un takeaway pauvre, **demande-toi si l'histoire devait vraiment être retenue**.

Cite les sources par leur nom de publication ("Le Monde", "Numerama", "Pew Research"). N'utilise JAMAIS "[0]", "[2]", "(article 3)" — les crochets dans la liste ci-dessous sont à usage interne uniquement.

N'invente AUCUN fait absent des articles fournis. **N'invente AUCUNE citation directe** : si une phrase est entre « », elle doit littéralement figurer dans le résumé d'un article fourni. Ne mentionne pas que tu es une IA.

## CONTRAINTES DURES

- Maximum 3 histoires, triées par pertinence décroissante.
- Body **300-450 mots, exactement 2 sections H2** (lede + ## Section 1 + ## Section 2). Sous 220 mots ou sans les 2 H2 → rejet automatique au contrôle qualité aval.
- Au moins 2 citations directes en « » dans le body quand les sources en fournissent (idéalement une par section). Si AUCUNE source ne fournit de citation littérale, attribue indirectement et accepte que le brief n'ait pas de « » — n'invente jamais.
- familyTakeaway 60-120 mots, plain text, ancré dans les faits — pas de platitudes.
- Multi-sources : relevance ≥ 0.55. Single-source : relevance ≥ 0.7. INTL single-source : ≥ 0.65.
- Title ≤ 75 caractères, mot-clé famille dans les 45 premiers caractères (cf. règle "title" plus haut).
- Chaque imageUrl est l'IMG exacte d'un article cité (jamais inventer une URL).
- Français uniquement.
- Si tu ne trouves que 0, 1 ou 2 histoires solides, renvoie celles-là.

## OUTPUT

Réponds UNIQUEMENT avec ce JSON, sans markdown, sans texte avant ou après :
{"stories": [{"title": "...", "summary": "...", "body": "lede\\n\\n## Titre 1\\n\\nbody...\\n\\n## Titre 2\\n\\nbody...", "familyTakeaway": "60-120 mots plain text", "category": "PARENTHOOD|FILM_TV|GAMES|READING|TECH", "relevanceScore": 0.X, "imageUrl": "https://...", "sourceIndexes": [0, 3]}]}

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
  // Defensive length-clamp at 800 chars — protects against runaway
  // takeaways that would blow up the box rendering. The quality judge
  // separately enforces the 60-120 word target.
  const familyTakeawayRaw =
    typeof r.familyTakeaway === "string" ? r.familyTakeaway.trim() : ""
  const familyTakeaway = familyTakeawayRaw ? familyTakeawayRaw.slice(0, 800) : null

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
  if (!["PARENTHOOD", "FILM_TV", "GAMES", "READING", "TECH"].includes(category)) {
    console.warn(`[news-discover] coerce: bad category="${category}" title="${title.slice(0, 60)}"`)
    return null
  }
  if (sourceIndexes.length === 0) {
    console.warn(`[news-discover] coerce: empty sourceIndexes title="${title.slice(0, 60)}"`)
    return null
  }

  // Body floor matches the compact brief target used to keep the cron
  // under the synthesis timeout. Anything shorter means the LLM didn't
  // follow the structure (skipped a section or bailed early).
  const wordCount = body.split(/\s+/).filter(Boolean).length
  if (wordCount < 220) {
    console.warn(`[news-discover] coerce: body too short (${wordCount}w) title="${title.slice(0, 60)}"`)
    return null
  }

  // Derive region from cited sources. Story is INTL only if ALL its
  // sources are INTL (mixed clusters are caught by the prompt rule —
  // this is a defensive belt).
  const allIntl = sourceIndexes.length > 0 && sourceIndexes.every((i) => items[i]?.sourceRegion === "INTL")

  // Look up the provenance of the chosen image. The LLM picks one of
  // the supplied items' imageUrls verbatim; first match by URL gets
  // its tier/credit/license carried into the synthesized story. If the
  // LLM somehow returned a URL not in the input set (defensive belt
  // against hallucinated URLs), fall back to PUBLISHER_RSS with the
  // primary source's name as credit — better than dropping the story
  // for a metadata-only mismatch.
  const owner = items.find((it) => it.imageUrl === imageUrl)
  const fallbackOwner = items[sourceIndexes[0]!]
  const imageSourceType = owner?.imageSourceType ?? "PUBLISHER_RSS"
  const imageCredit = owner?.imageCredit ?? fallbackOwner?.sourceName ?? "Source"
  const imageLicenseUrl = owner?.imageLicenseUrl

  return {
    slug: slugify(title),
    title,
    summary,
    body,
    familyTakeaway,
    category: category as NewsCategory,
    relevanceScore: Math.max(0, Math.min(1, relevanceScore)),
    imageUrl,
    imageSourceType,
    imageCredit,
    imageLicenseUrl,
    sourceIndexes,
    region: allIntl ? "INTL" : "FR",
  }
}

export interface DiscoverStats {
  sourcesFetched: number
  itemsCollected: number
  itemsDroppedNoImage: number       // Hard-requirement drops (no date/link/title) + low-quality-image publishers
  itemsFellBackToCard: number       // Items kept but assigned the branded category fallback card (no usable photo)
  storiesSynthesized: number
  storiesDroppedInvalid: number
  storiesDroppedUnsuitable: number  // Pass-2 moderation rejects
  storiesDroppedImageReused: number // Cross-story image dedup
  storiesDroppedImageUnreachable: number
  storiesPersisted: number
  storiesUsingFallbackCard: number  // Of the persisted stories, how many ended up on a fallback card
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

  // 2. Resolve image per item. Items with no usable photo are no longer
  //    dropped — they're kept and assigned the branded category fallback
  //    card. Only a missing hard requirement (date/link/title) or a
  //    flagged low-quality-image publisher still drops the item.
  const imageStart = Date.now()
  const hydrated: HydratedItem[] = []
  let droppedNoImage = 0
  let fellBackToCard = 0
  await parallelMap(pairs, 6, async ({ source, item }) => {
    const iso = item.isoDate ?? item.pubDate
    if (!iso || !item.link || !item.title) {
      droppedNoImage++
      return
    }
    // Sources flagged as low-quality-image publishers ship generic
    // mascot art that looks off in the grid (e.g. Geek Junior). The
    // editorial call there was "skip the article", not "swap the
    // image" — so keep dropping them rather than giving them a card.
    if (isLowQualityImagePublisher(source.name)) {
      droppedNoImage++
      return
    }
    // Pass title + sourceName so resolveImage can build the credit text.
    let resolved = await resolveImage({
      ...(item as RssLikeItem),
      title: item.title,
      summary: item.contentSnippet,
      sourceName: source.name,
      category: source.category,
    })
    // No publisher image, a blocked-hotlink image, or only a thumbnail
    // too small to render as a 16:9 hero → use the branded category
    // card. (The dimension gate stops the visibly-upscaled portrait
    // look Xavier flagged on the old Café Pédagogique brief; fails open
    // on probe errors so a transient blip doesn't force a fallback.)
    if (!resolved || !(await isImageLargeEnough(resolved.url))) {
      resolved = fallbackCard(source.category, item.title)
      fellBackToCard++
    }
    hydrated.push({
      sourceName: source.name,
      sourceCategory: source.category,
      sourceRegion: source.region ?? "FR",
      sourceCountry: source.country,
      title: item.title.trim(),
      link: item.link.trim(),
      summary: (item.contentSnippet ?? "").trim(),
      imageUrl: resolved.url,
      imageSourceType: resolved.sourceType,
      imageCredit: resolved.credit,
      imageLicenseUrl: resolved.licenseUrl,
      publishedAt: new Date(iso),
    })
  })

  // 3. Dedup by URL, then take a per-region budget by recency.
  //    Without the FR/INTL split, the high-cadence FR feeds crowd
  //    INTL out of the synthesis pool entirely.
  const seen = new Set<string>()
  const sortedRecent = hydrated
    .filter((h) => {
      if (seen.has(h.link)) return false
      seen.add(h.link)
      return true
    })
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
  const fr = sortedRecent.filter((h) => h.sourceRegion !== "INTL").slice(0, FR_BUDGET)
  const intl = sortedRecent.filter((h) => h.sourceRegion === "INTL").slice(0, INTL_BUDGET)
  const unique = [...fr, ...intl]
  const resolveImagesMs = Date.now() - imageStart

  if (unique.length === 0) {
    return {
      sourcesFetched: NEWS_SOURCES.length,
      itemsCollected: 0,
      itemsDroppedNoImage: droppedNoImage,
      itemsFellBackToCard: fellBackToCard,
      storiesSynthesized: 0,
      storiesDroppedInvalid: 0,
      storiesDroppedUnsuitable: 0,
      storiesDroppedImageReused: 0,
      storiesDroppedImageUnreachable: 0,
      storiesPersisted: 0,
      storiesUsingFallbackCard: 0,
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
    select: { id: true, slug: true, title: true, sources: true, imageUrl: true, imageSourceType: true },
  })

  // Cross-story image dedup: collect every imageUrl already in the
  // 72h window so the synthesizer can avoid picking the same one for
  // a new story (Greystones bug — same kids-on-phones photo reused
  // across two unrelated stories on the same theme). FALLBACK cards are
  // excluded — the same category card SHOULD be reusable across
  // image-less stories, so we don't want the prompt avoiding it.
  const recentImageUrls = existingStories
    .filter((s) => s.imageSourceType !== "FALLBACK")
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

  // 5. Cluster + synthesize in one Claude Sonnet 4.6 call.
  //
  // Single-provider Claude (May 2026 redesign). The previous
  // DeepSeek+OpenAI+Claude triple cascade silently failed in too many
  // ways. Sonnet 4.6 is more expensive than DeepSeek but the cost
  // delta at 4 runs/day × ~30 stories is negligible (single-digit
  // dollars per month) and reliability matters more.
  const synthStart = Date.now()
  const provider = "anthropic" as const
  const prompt = buildPrompt(
    unique,
    existingStories.map((s) => s.title),
    recentImageUrls,
  )

  // Keep the response budget aligned with the compact 2-3 story target.
  // The previous 14k output cap encouraged long generations that often
  // reached our 180s abort window before returning any JSON.
  const MAX_TOKENS = 7000

  // Per-call timeout on the synthesis LLM call. Anthropic typically
  // returns in 30-90s for our prompt size; 180s leaves slack for
  // tail-latency events without exhausting the 300s function ceiling.
  // If we abort, the run returns "0 synthesized" cleanly (200 OK) —
  // but the route now treats that as `error` status if we collected
  // items, so the GH Actions job goes red instead of silently green.
  const SYNTHESIS_TIMEOUT_MS = 180_000
  const synthesisController = new AbortController()
  const synthesisTimer = setTimeout(() => synthesisController.abort(), SYNTHESIS_TIMEOUT_MS)

  let rawText = ""
  let rawStories: unknown[] = []
  try {
    const anthropic = getAnthropic()
    const response = await anthropic.messages.create(
      {
        model: SYNTHESIS_ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.2,
        system:
          "You are a strict extraction API. Do not explain your reasoning. Use the provided tool exactly once with the selected stories.",
        tools: [EMIT_NEWS_STORIES_TOOL],
        tool_choice: { type: "tool", name: "emit_news_stories" },
        messages: [{ role: "user", content: prompt }],
      },
      { signal: synthesisController.signal },
    )
    const toolBlock = response.content.find(
      (c) => c.type === "tool_use" && "name" in c && c.name === "emit_news_stories",
    )
    if (toolBlock && "input" in toolBlock) {
      const candidate = (toolBlock.input as { stories?: unknown }).stories
      if (Array.isArray(candidate)) rawStories = candidate
    }
    const continuation = response.content
      .filter((c) => c.type === "text" && "text" in c)
      .map((c) => (c as { text: string }).text)
      .join("")
    rawText = continuation
  } catch (err) {
    const aborted = synthesisController.signal.aborted
    console.warn(
      `[news-discover] synthesis ${aborted ? "aborted on timeout" : "errored"} after ${Math.round((Date.now() - synthStart) / 1000)}s — returning 0 stories. ${err instanceof Error ? err.message : ""}`,
    )
    rawText = ""
  } finally {
    clearTimeout(synthesisTimer)
  }

  // Strip markdown code fences (```json … ```) before extracting the
  // outer JSON object — DeepSeek occasionally wraps responses despite
  // the "no markdown" instruction. Then parse leniently: if extraction
  // or parse fails, log the head and continue with an empty story
  // list so the cron returns "0 synthesized" rather than a 500.
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "")
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (rawStories.length > 0) {
    // Tool-use path succeeded; no text JSON parsing needed.
  } else if (!jsonMatch) {
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
    // FALLBACK cards are exempt — the same category card is meant to be
    // shared across image-less stories, not deduped away (which would
    // re-introduce the "0 stories" drop this whole change fixes).
    if (story.imageSourceType !== "FALLBACK") {
      if (usedImages.has(story.imageUrl)) {
        droppedImageReused++
        continue
      }
      usedImages.add(story.imageUrl)
    }
    // Three paths accepted, matching the synthesis prompt:
    //   A) multi-source (>=2 distinct publishers) + relevance >= 0.55
    //   B) single-source INTL + relevance >= 0.65
    //   C) single-source FR + relevance >= 0.7 (strong family angle required)
    // Anything else is dropped — keeps weak single-outlet essays out while
    // still letting standout institutional studies or expert guides through.
    // Thresholds adjusted May 2026 — the 0.6/0.8 attempt rejected too many
    // candidates and the page went stale. 0.55/0.7 is the new compromise:
    // tighter than the original 0.5/0.6, but not so tight the LLM has
    // nothing to synthesize on slow news days.
    const distinctNames = new Set(story.sourceIndexes.map((i) => unique[i].sourceName))
    const isMultiSource = distinctNames.size >= 2
    const isIntlOnly = story.sourceIndexes.every((i) => unique[i].sourceRegion === "INTL")
    const minRelevance = isMultiSource ? 0.55 : isIntlOnly ? 0.65 : 0.7
    if (story.relevanceScore < minRelevance) {
      droppedInvalid++
      console.warn(
        `[news-discover] dropped low-relevance: "${story.title.slice(0, 80)}" score=${story.relevanceScore} min=${minRelevance} ${isMultiSource ? "multi" : isIntlOnly ? "intl-single" : "single"}`,
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
  //    If the upload fails (origin returns a tiny placeholder, network
  //    error, CDN block), keep the editorial story alive on the branded
  //    fallback card instead of turning a valid brief into a 0-story run.
  const mirrored = await Promise.all(
    moderatedStories.map((s) =>
      isStorageEnabled() ? uploadNewsImage(s.imageUrl) : Promise.resolve(s.imageUrl),
    ),
  )
  const droppedImageUnreachable = 0
  const liveStories: SynthesizedStory[] = []
  moderatedStories.forEach((s, i) => {
    const mirroredUrl = mirrored[i]
    if (mirroredUrl) {
      liveStories.push({ ...s, imageUrl: mirroredUrl })
      return
    }
    const fallback = fallbackCard(s.category, s.title)
    console.warn(
      `[news-discover] image mirror failed; using fallback card for "${s.title.slice(0, 80)}"`,
    )
    liveStories.push({
      ...s,
      imageUrl: fallback.url,
      imageSourceType: fallback.sourceType,
      imageCredit: fallback.credit,
      imageLicenseUrl: fallback.licenseUrl,
    })
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
        // ISO country code for INTL items (US, UK, DE, IT…). Renders
        // as a flag emoji in the source pill on Vu d'ailleurs cards.
        // Undefined for FR sources (no flag shown — clean look).
        country: unique[i].sourceCountry,
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

    // Systemic catalog linking, no human per-story check:
    // 1) LLM decides whether the story is actually about media and
    //    extracts title/license search terms.
    // 2) deterministic catalog search turns those terms into candidates.
    // 3) LLM verifies the candidates. Fail-closed: better no card than
    //    a false "à découvrir" recommendation.
    const storyForCatalog = { title: s.title, summary: s.summary, body: s.body }
    const mediaSubject = await identifyMediaSubjectTerms(storyForCatalog)
    const candidateIds = mediaSubject.isMediaNews
      ? extractCatalogMatchesFromStory(
          storyForCatalog,
          catalogIndex,
          8,
          mediaSubject.subjectTerms,
        )
      : []
    const candidates = candidateIds
      .map((id) => findInCatalog(catalogIndex, id))
      .filter((m): m is LinkableMedia => !!m)
      .map((m) => ({ id: m.id, title: m.title, type: m.type, year: m.releaseYear }))
    const matchedIds = candidates.length > 0
      ? await verifyCatalogSubjects({ title: s.title, summary: s.summary, body: s.body }, candidates)
      : []
    const primaryMediaId = matchedIds[0] ?? null

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

    // Editorial supervision — Haiku call, ~3-8s, fail-open to neutral.
    // Runs before persist so the row is tagged from creation onwards
    // and the V3 balancer has signal from day 0. judgeEditorial returns
    // null on LLM failure; the live pipeline coalesces to neutral so
    // the story still ships with a sensible default.
    const editorial =
      (await judgeEditorial({
        title: s.title,
        summary: s.summary,
        body: s.body,
        category: s.category,
      })) ?? DEFAULT_EDITORIAL_VERDICT

    const data = {
      title: s.title,
      summary: s.summary,
      body: s.body,
      familyTakeaway: s.familyTakeaway,
      category: s.category,
      sources,
      imageUrl: s.imageUrl,
      imageSourceType: s.imageSourceType,
      imageCredit: s.imageCredit,
      imageLicenseUrl: s.imageLicenseUrl ?? null,
      publishedAt,
      relevanceScore: s.relevanceScore,
      status: isAdultMatch ? ("PENDING_REVIEW" as const) : ("PUBLISHED" as const),
      region: s.region,
      audience: s.audience ?? "parent_only",
      research: s.research ? (s.research as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      relatedMediaId: primaryMediaId,
      relatedMediaIds: matchedIds,
      editorialTone: editorial.tone,
      topicCluster: editorial.cluster,
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
      familyTakeaway: s.familyTakeaway,
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
    itemsFellBackToCard: fellBackToCard,
    storiesSynthesized: rawStories.length,
    storiesDroppedInvalid: droppedInvalid,
    storiesDroppedUnsuitable: droppedUnsuitable,
    storiesDroppedImageReused: droppedImageReused,
    storiesDroppedImageUnreachable: droppedImageUnreachable,
    storiesPersisted: persisted,
    storiesUsingFallbackCard: liveStories.filter((s) => s.imageSourceType === "FALLBACK").length,
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
