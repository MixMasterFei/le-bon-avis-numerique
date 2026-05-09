import { readFileSync } from "node:fs"
import { join } from "node:path"

let cachedSoul: string | null = null
let cachedSiteBrief: string | null = null

function loadSoul(): string {
  if (cachedSoul) return cachedSoul
  cachedSoul = readFileSync(join(process.cwd(), "src/lib/totem/soul.md"), "utf-8")
  return cachedSoul
}

function loadSiteBrief(): string {
  if (cachedSiteBrief) return cachedSiteBrief
  cachedSiteBrief = readFileSync(join(process.cwd(), "src/lib/totem/site-brief.md"), "utf-8")
  return cachedSiteBrief
}

export interface FamilyMemberSnapshot {
  name: string
  age: number | null
  sensitivities?: {
    violence?: number
    scary?: number
    sexual?: number
    language?: number
    substances?: number
  }
  favoriteGenres?: string[]
  avoidTopics?: string[]
}

export interface BuildSystemPromptParams {
  userIsAnonymous: boolean
  familyContext?: FamilyMemberSnapshot[]
  currentDate: string
  sourcePage?: string | null
  conversationTurnCount: number
  personalizationNudgeAllowed: boolean
}

/**
 * Returns the static head (cached across requests) and the dynamic tail
 * separately so the caller can apply Anthropic ephemeral cache control on
 * the head only.
 */
export function buildSystemPrompt(params: BuildSystemPromptParams): {
  staticHead: string
  dynamicTail: string
} {
  const soul = loadSoul()
  const siteBrief = loadSiteBrief()

  const staticHead = `${soul}

---

${siteBrief}

---

# Outils disponibles

Tu as accès à des outils pour rechercher dans le catalogue Totem (\`searchMedia\`, \`getMediaDetails\`, \`getCommunityConsensus\`), évaluer l'adéquation d'un titre à la famille connectée (\`getFamilyFit\`), et proposer une navigation vers une page du site (\`proposeNavigation\`). Utilise-les avant de formuler une recommandation : ne jamais inventer un titre qui n'a pas été retrouvé via \`searchMedia\` ou \`getMediaDetails\`.

# Garde-fous prioritaires (rappel à chaque tour)

1. **Tu poses une question de clarification → tu t'arrêtes.** Aucun appel d'outil dans le même tour. Tu termines sur le point d'interrogation et tu attends la réponse de l'utilisateur. Si tu décides d'avancer malgré l'ambiguïté, ne pose pas de question : formule ton hypothèse en une phrase et continue.
2. **Tu ne dis jamais de chiffre de score, ni les mots "score", "fit", "level", "GREAT", "GOOD", "FAIR", "SKIP", "adéquation 65/100", etc.** Tu traduis les niveaux d'adéquation en langage naturel (cf. soul.md §2). Pas de chiffre, jamais.
3. **Tu réponds à la question posée, pas plus.** Si l'utilisateur demande pour un enfant, tu parles de cet enfant. Tu peux mentionner les autres en demi-phrase si c'est utile, mais tu ne déballes pas une fiche par membre.
4. **Tu décris le contenu en voix de parent**, pas en bulletin scolaire. Pas de *"violence : 1, langage : 0"*. Tu écris *"deux gros mots vers la fin"*, *"quelques scènes émouvantes mais rien de violent"*.
5. **2 à 3 phrases par défaut.** Plus long uniquement si l'utilisateur demande, ou si la question est grave.
6. **Différencie "données manquantes" et "vraie inadéquation".** Pour chaque membre, l'outil \`getFamilyFit\` te renvoie un drapeau \`hasPreferences\`. **Si \`hasPreferences=false\`** (aucun quiz rempli), tu ne dis JAMAIS *"pas son genre"* / *"pas sa tasse de thé"* / *"il n'aimera pas"*. Le score bas reflète l'absence d'info, pas un rejet. Tu écris quelque chose comme : *"Sans leur quiz rempli, je ne peux pas trancher pour [prénom] — le film tient bien en soi, dites-moi leurs goûts ou faites-leur faire le quiz, je serai plus précis."* **Si \`hasPreferences=true\`** et score faible, là tu peux dire *"pas son genre"* — tu as la donnée pour le justifier.`

  const familyBlock = params.familyContext && params.familyContext.length > 0
    ? `Composition du foyer connecté :\n${params.familyContext.map((m) => {
        const age = m.age != null ? `${m.age} ans` : "âge inconnu"
        const sens = m.sensitivities
          ? ` — sensibilités : violence ${m.sensitivities.violence ?? 0}, peur ${m.sensitivities.scary ?? 0}, sexualité ${m.sensitivities.sexual ?? 0}, langage ${m.sensitivities.language ?? 0}, substances ${m.sensitivities.substances ?? 0}`
          : ""
        const genres = m.favoriteGenres && m.favoriteGenres.length > 0 ? ` — aime : ${m.favoriteGenres.slice(0, 5).join(", ")}` : ""
        const avoid = m.avoidTopics && m.avoidTopics.length > 0 ? ` — éviter : ${m.avoidTopics.slice(0, 5).join(", ")}` : ""
        return `- ${m.name} (${age})${sens}${genres}${avoid}`
      }).join("\n")}`
    : ""

  const dynamicTail = `# Contexte dynamique

- Date du jour : ${params.currentDate}
- Page d'arrivée de l'utilisateur : ${params.sourcePage ?? "inconnue"}
- Nombre de tours échangés : ${params.conversationTurnCount}
- Utilisateur connecté : ${params.userIsAnonymous ? "NON (anonyme)" : "OUI"}
- Invitation à se connecter autorisée ce tour : ${params.personalizationNudgeAllowed ? "oui (à glisser en demi-phrase si pertinent)" : "non"}
${familyBlock ? `\n${familyBlock}` : ""}`

  return { staticHead, dynamicTail }
}
