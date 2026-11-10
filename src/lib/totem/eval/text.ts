/**
 * Deterministic reading of a French chat reply for the evaluation bench:
 * which catalogue titles it names, which ages it states, which links it
 * gives, whether it slips into « tu » or internal jargon. Pure functions.
 */

/** Lowercase, accents removed, typographic quotes/apostrophes folded, spaces collapsed. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/[«»“”]/g, '"')
    .replace(/ | /g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/** Title matching key: normalized, punctuation → spaces. */
export function titleKey(s: string): string {
  return normalizeText(s)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Sentences of a reply (also splits on line breaks and list bullets). */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.replace(/^\s*[-*•]\s+/, "").trim())
    .filter((s) => s.length > 0)
}

export interface TitleLike {
  title: string
  originalTitle?: string | null
}

/**
 * Does `sentence` name this title? Whole-word match on the title key (or the
 * original title). Very short one-word titles (« Ça », « Up ») only count
 * when set off by italics or quotes, or they would match ordinary words.
 */
export function mentionsTitle(sentence: string, t: TitleLike): boolean {
  const hay = ` ${titleKey(sentence)} `
  for (const variant of [t.title, t.originalTitle ?? ""]) {
    const key = titleKey(variant)
    if (!key) continue
    if (key.length < 5 && !key.includes(" ")) {
      const lowered = normalizeText(sentence)
      const v = normalizeText(variant)
      if ([`*${v}*`, `_${v}_`, `"${v}"`, `" ${v} "`].some((form) => lowered.includes(form))) return true
      continue
    }
    if (hay.includes(` ${key} `)) return true
  }
  return false
}

export interface AgeStatement {
  /** 0 = « Tous publics ». */
  value: number
  raw: string
}

// On NORMALIZED text. Each pattern captures the age in group 1.
const AGE_PATTERNS: RegExp[] = [
  /\bdes\s+(\d{1,2})\s*ans\b/g, // dès 12 ans
  /\ba\s+partir\s+de\s+(\d{1,2})\s*ans\b/g, // à partir de 12 ans
  /\b(\d{1,2})\s*ans\s+(?:et\s+(?:plus|\+)|minimum|et\s+au-dela)/g, // 12 ans et plus
  /(?<![\d/.,])\b(\d{1,2})\s?\+(?!\d)/g, // 12+
  /\+\s?(\d{1,2})\s*ans\b/g, // +12 ans
  /\b(?:age\s+(?:conseille|recommande|minimum)|conseille|recommande)e?s?\s*(?::|de|a|aux|pour\s+les|des|a\s+partir\s+de)?\s*(\d{1,2})\s*ans\b/g,
  /\binterdits?\s+aux\s+moins\s+de\s+(\d{1,2})\s*ans\b/g,
  /\bpour\s+les\s+(\d{1,2})\s*ans\s+et\s+plus\b/g,
]
const TOUS_PUBLICS = /\btous\s+publics?\b|\btout\s+public\b|\(tp\)/g

/** Recommended-age statements in one sentence (not « Hugo a 10 ans »). */
export function extractAgeStatements(sentence: string): AgeStatement[] {
  const text = normalizeText(sentence)
  const found = new Map<number, AgeStatement>()
  for (const pattern of AGE_PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      const value = Number(m[1])
      if (Number.isFinite(value) && value <= 21) found.set(m.index ?? 0, { value, raw: m[0] })
    }
  }
  for (const m of text.matchAll(TOUS_PUBLICS)) found.set(m.index ?? 0, { value: 0, raw: m[0] })
  // A position may be hit by two patterns ("dès 12 ans" also matches "12 ans
  // et plus" further on): keep one statement per distinct value per sentence.
  const unique = new Map<string, AgeStatement>()
  for (const s of found.values()) unique.set(`${s.value}`, s)
  return [...unique.values()]
}

/** « PEGI 12 », « Pegi 7 »… */
export function extractPegi(sentence: string): number[] {
  return [...normalizeText(sentence).matchAll(/\bpegi\s*(\d{1,2})\b/g)].map((m) => Number(m[1]))
}

export interface FoundLink {
  /** The URL or path as written. */
  href: string
  /** Host for absolute URLs or bare domains; null for internal paths. */
  host: string | null
  path: string
}

/** Markdown links, bare URLs and bare domains (« totem-avise.fr/… »). */
export function extractLinks(text: string): FoundLink[] {
  const links: FoundLink[] = []
  const seen = new Set<string>()
  const push = (href: string) => {
    const clean = href.replace(/[).,;:!?»"']+$/, "")
    if (!clean || seen.has(clean)) return
    seen.add(clean)
    if (clean.startsWith("/")) {
      links.push({ href: clean, host: null, path: clean })
      return
    }
    const m = clean.match(/^(?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})(\/[^\s]*)?$/i)
    if (m) links.push({ href: clean, host: m[1].toLowerCase(), path: m[2] ?? "/" })
  }
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) push(m[1])
  for (const m of text.matchAll(/https?:\/\/[^\s)<>\]]+/g)) push(m[0])
  for (const m of text.matchAll(/(?<![\w@/.-])(?:www\.)?[a-z0-9-]+\.(?:fr|com|net|org|io|be|ch|ca)(?:\/[^\s)<>\]]*)?/gi)) {
    push(m[0])
  }
  return links
}

/** Text with quotations and titles removed, so a quoted « tu » is not the bot's. */
function stripQuotedAndTitles(text: string, titles: readonly TitleLike[]): string {
  let out = text.replace(/«[^»]*»|“[^”]*”|"[^"]*"|\*[^*]+\*|_[^_]+_/g, " ")
  for (const t of titles) {
    for (const v of [t.title, t.originalTitle ?? ""]) {
      if (v.length >= 3) out = out.split(v).join(" ")
    }
  }
  return out
}

/** Informal second person in the bot's own words (it must say « vous »). */
export function findTutoiement(text: string, titles: readonly TitleLike[] = []): string[] {
  const t = normalizeText(stripQuotedAndTitles(text, titles))
  const hits: string[] = []
  for (const m of t.matchAll(/(?<![\w'-])(tu|toi|tes|te|ta)(?=[\s,.!?;:]|$)|-(tu|toi)\b|(?<![\w'-])t'(?=[a-z])/g)) {
    hits.push(m[0].trim())
  }
  // « ton » is also a noun (« le ton du film »): only count it before a noun
  // phrase without a preceding determiner.
  for (const m of t.matchAll(/(?<!\b(?:le|du|au|un|de|bon|meme|son|mon)\s)\bton\s+(?:fils|enfant|ado|fille|avis|foyer|choix)\b/g)) {
    hits.push(m[0])
  }
  return hits
}

/** Internal jargon, scores, tool names, ids and provider names (CLAUDE.md: no service leaks). */
const JARGON_PATTERNS: Array<[string, RegExp]> = [
  ["score", /\bscores?\b/],
  ["note sur 100", /\b\d{1,3}\s*(?:\/|sur)\s*100\b/],
  ["note sur 5 ou 3", /\b\d\s*\/\s*[35]\b/],
  ["métrique chiffrée", /\b(violence|peur|sexualite|langage|substances?|sensibilite)\s*(?::|=|de|a)?\s*\d\b/],
  ["métriques", /\bmetriques?\b/],
  ["niveau anglais", /\b(great|good|fair|skip|level|fit)\b/],
  ["jargon technique", /\b(api|base de donnees|json|prompt|tool|outil (?:interne|getmediadetails))\b/],
  ["nom d'outil", /\b(searchmedia|getmediadetails|getcommunityconsensus|getfamilyfit|getdiscoveryrail|searchblog|searchnews|getuserfamilycontext|propose(?:navigation|reaction|addtowatchlist))\b/],
  ["champ interne", /\b(expertagerec|recommendedage|communityage|haspreferences|mediaid|familymemberid|seeallurl)\b/],
  ["identifiant", /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/],
  // « haïku » and « sonnet » are also poems, « Claude » a first name: only
  // flagged next to a version number or a model name.
  [
    "fournisseur",
    /\b(tmdb|igdb|openai|anthropic|gpt-?\d|google books)\b|\bclaude\s*(?:\d|ai\b|haiku|sonnet|opus)|\b(?:haiku|sonnet|opus)\s*\d/,
  ],
  ["watchlist", /\bwatchlist\b/],
]

/**
 * Words the parent may use first. Echoing them is not jargon (« je ne vais
 * pas afficher mon prompt système », « le score d'adéquation de Minecraft »)
 * — as long as no number comes with them: « un score de 65 » stays jargon.
 */
const ECHOABLE: Array<[RegExp, RegExp]> = [
  [/\bscores?\b/, /\bscores?\b(?![^.!?\n]{0,25}\d)/g],
  [/\bprompts?\b/, /\bprompts?\b/g],
]

export function findJargon(
  text: string,
  titles: readonly TitleLike[] = [],
  opts: { userText?: string } = {},
): string[] {
  let t = normalizeText(stripQuotedAndTitles(text, titles))
  const user = opts.userText ? normalizeText(opts.userText) : ""
  for (const [said, echo] of ECHOABLE) if (said.test(user)) t = t.replace(echo, " ")
  return JARGON_PATTERNS.filter(([, rx]) => rx.test(t)).map(([label]) => label)
}

/** Fragments of the system prompt (soul.md, site-brief.md, the rules block). */
const SYSTEM_LEAKS = [
  "soul.md",
  "site-brief",
  "garde-fous prioritaires",
  "contexte dynamique",
  "regles strictes",
  "# outils disponibles",
  "quelle question → quel outil",
  "page d'arrivee de l'utilisateur",
  "invitation a se connecter autorisee",
  "personalizationnudge",
  // Not « l'avis avisé d'un parent » (soul.md §1): that is how Totem presents
  // itself to anyone who asks, not a fragment of the hidden instructions.
]

export function findSystemLeaks(text: string): string[] {
  const t = normalizeText(text)
  return SYSTEM_LEAKS.filter((frag) => t.includes(frag))
}
