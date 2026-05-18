import type { NewsCategory } from "@prisma/client"

export interface NewsImageConcept {
  query: string
  label: string
  matchedTerms: string[]
}

interface ConceptRule {
  pattern: RegExp
  query: string
  label: string
}

const TOPIC_RULES: ConceptRule[] = [
  {
    pattern: /\b(inactivite|sedentarite|activite physique|courir|sport|bouger|education physique)\b/i,
    query: "children feet running track",
    label: "activite physique",
  },
  {
    pattern: /\b(ete du canal|plage|plages|base nautique|baignade|activites? a paris|sortie accessible)\b/i,
    query: "families summer outdoor activities park",
    label: "sortie famille",
  },
  {
    pattern: /\b(nuit blanche|performance immersive|installation artistique|mediatheque|exposition|festival)\b/i,
    query: "museum interior exhibition visitors",
    label: "culture famille",
  },
  {
    pattern: /\b(examen|examens|revision|revisions|etudiants?|eleves?|devoirs?|guide de survie)\b/i,
    query: "students studying exam desk books",
    label: "examens",
  },
  {
    pattern: /\b(classe investigation|education aux medias|medias|clemi|trafic en amazonie)\b/i,
    query: "students laptop classroom media literacy",
    label: "education aux medias",
  },
  {
    pattern: /\b(zelda|breath of the wild|botw|grand-pere|grand pere|71 ans|premiere quete)\b/i,
    query: "elderly man playing video game controller",
    label: "jeu video intergenerationnel",
  },
  {
    pattern: /\b(couvre-feu|couvre feu|mineurs?|narcotrafic|police municipale|securite publique)\b/i,
    query: "empty urban street night police lights",
    label: "securite publique",
  },
]

const BRAND_SAFE_RULES: ConceptRule[] = [
  {
    pattern: /\b(netflix|disney\+?|prime video|amazon prime|max|hbo|canal\+|canal plus|mycanal|apple tv\+?)\b/i,
    query: "family watching streaming service television",
    label: "streaming familial",
  },
  {
    pattern: /\b(tiktok|instagram|snapchat|facebook|meta|x|twitter|youtube|twitch)\b/i,
    query: "teenager smartphone social media privacy",
    label: "reseaux sociaux",
  },
  {
    pattern: /\b(chatgpt|openai|gemini|copilot|claude|perplexity|google ai|mistral)\b/i,
    query: "artificial intelligence learning laptop family",
    label: "IA et apprentissage",
  },
  {
    pattern: /\b(google|alphabet|android|apple|iphone|ipad|microsoft|windows)\b/i,
    query: "family technology laptop smartphone",
    label: "technologie familiale",
  },
  {
    pattern: /\b(nintendo|switch|playstation|xbox|roblox|minecraft|fortnite|epic games|steam)\b/i,
    query: "children playing video games family",
    label: "jeu video familial",
  },
  {
    pattern: /\b(arxiv|paper|study|research|scientific|scientifique|chercheur|universit|cornell)\b/i,
    query: "academic research library computer",
    label: "recherche",
  },
  {
    pattern: /\b(ecole|college|lycee|education|enseignant|classe|eleve|school|teacher|classroom)\b/i,
    query: "school classroom students learning",
    label: "education",
  },
  {
    pattern: /\b(justice|tribunal|police|plainte|proces|condamn|court|lawsuit|regulator)\b/i,
    query: "justice courthouse documents",
    label: "justice",
  },
  {
    pattern: /\b(sante|hopital|medecin|psycholog|mental health|suicide|anxiete|addiction)\b/i,
    query: "healthcare family support",
    label: "sante familiale",
  },
]

const CATEGORY_FALLBACKS: Record<NewsCategory | string, NewsImageConcept> = {
  PARENTHOOD: {
    query: "parents children home family",
    label: "parentalite",
    matchedTerms: [],
  },
  FILM_TV: {
    query: "family movie night television",
    label: "cinema et series",
    matchedTerms: [],
  },
  GAMES: {
    query: "family video games controller",
    label: "jeux video",
    matchedTerms: [],
  },
  READING: {
    query: "children reading books library",
    label: "lecture jeunesse",
    matchedTerms: [],
  },
  TECH: {
    query: "family technology laptop smartphone",
    label: "tech familiale",
    matchedTerms: [],
  },
}

const SENSITIVE_TERMS = [
  "netflix",
  "disney",
  "prime",
  "amazon",
  "max",
  "hbo",
  "canal",
  "tiktok",
  "instagram",
  "snapchat",
  "facebook",
  "meta",
  "twitter",
  "youtube",
  "twitch",
  "chatgpt",
  "openai",
  "gemini",
  "copilot",
  "claude",
  "perplexity",
  "google",
  "alphabet",
  "android",
  "apple",
  "iphone",
  "ipad",
  "microsoft",
  "windows",
  "nintendo",
  "switch",
  "playstation",
  "xbox",
  "roblox",
  "minecraft",
  "fortnite",
  "epic",
  "steam",
  "arxiv",
]

const STOPWORDS = new Set([
  "avec",
  "dans",
  "des",
  "les",
  "pour",
  "sans",
  "sur",
  "une",
  "aux",
  "chez",
  "plus",
  "moins",
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "will",
])

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function scrubSensitiveTerms(query: string): string {
  let out = normalize(query)
  for (const term of SENSITIVE_TERMS) {
    out = out.replace(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " ")
  }
  return out
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
    .slice(0, 4)
    .join(" ")
}

export function deriveNewsImageConcept(input: {
  title: string
  summary?: string | null
  body?: string | null
  category?: NewsCategory | string | null
}): NewsImageConcept {
  const haystack = normalize(`${input.title} ${input.summary ?? ""} ${input.body ?? ""}`)
  for (const rule of TOPIC_RULES) {
    const matches = haystack.match(rule.pattern)
    if (matches?.length) {
      return {
        query: rule.query,
        label: rule.label,
        matchedTerms: Array.from(new Set(matches.map((m) => m.toLowerCase()))),
      }
    }
  }

  for (const rule of BRAND_SAFE_RULES) {
    const matches = haystack.match(rule.pattern)
    if (matches?.length) {
      return {
        query: rule.query,
        label: rule.label,
        matchedTerms: Array.from(new Set(matches.map((m) => m.toLowerCase()))),
      }
    }
  }

  const scrubbed = scrubSensitiveTerms(haystack)
  if (scrubbed) {
    const categoryFallback = CATEGORY_FALLBACKS[input.category ?? ""]
    if (categoryFallback) return categoryFallback
  }

  return CATEGORY_FALLBACKS[input.category ?? ""] ?? {
    query: "family lifestyle newspaper",
    label: "actualites famille",
    matchedTerms: [],
  }
}

export function conceptKeywords(concept: NewsImageConcept): string[] {
  return concept.query.split(/\s+/).filter(Boolean).slice(0, 5)
}
