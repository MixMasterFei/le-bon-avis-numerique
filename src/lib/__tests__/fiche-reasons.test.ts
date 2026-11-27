import { describe, expect, it } from "vitest"
import { buildFicheReasons, REASON_METRIC_MIN } from "../fiche-reasons"
import { buildFicheDescription, MAX_DESCRIPTION } from "../fiche-title"
import { buildQuickAnswer } from "../quick-answer"
import { buildAgeRationale } from "../age-rationale"

// Fixtures copied from the production rows (read-only SELECT, 27 Nov 2026).
// The ages come from the fixture, never from these tests.
const BEETLEJUICE = {
  title: "Beetlejuice",
  type: "MOVIE",
  expertAgeRec: 10,
  releaseDate: "1988-03-30",
  synopsisFr:
    "Dès 10 ans, suivez Adam et Barbara Maitland, devenus fantômes après un accident et coincés dans leur maison, qui tentent de chasser les nouveaux occupants.",
  contentMetrics: {
    violence: 2,
    sexNudity: 1,
    language: 2,
    consumerism: 0,
    substanceUse: 0,
    positiveMessages: 3,
    roleModels: 2,
    whatParentsNeedToKnow: [
      "Comédie fantastique avec fantômes, humour macabre et images surréalistes.",
      "Contient scènes et créatures potentiellement effrayantes pour les plus jeunes.",
      "Langage familier et allusions adultes légères, mais pas explicites.",
    ],
    sensitiveWarnings: [
      "Scènes effrayantes ou angoissantes",
      "Thèmes de mort ou de deuil",
      "Images dérangeantes",
      "Accident de voiture",
      "Violence",
      "Détresse émotionnelle",
      "Noyade",
    ],
    enrichmentConfidence: 1,
  },
}

const GREMLINS = {
  title: "Gremlins",
  type: "MOVIE",
  expertAgeRec: 12,
  releaseDate: "1984-06-08",
  synopsisFr: "Dès 12 ans, un inventeur offre à son fils un mogwai, adorable mais soumis à des règles strictes.",
  contentMetrics: {
    violence: 3,
    sexNudity: 0,
    language: 2,
    consumerism: 1,
    substanceUse: 1,
    positiveMessages: 3,
    roleModels: 2,
    whatParentsNeedToKnow: [
      "Film fantastique mêlant humour et scènes effrayantes avec créatures et chaos urbain.",
      "Contient violence fantaisiste, quelques blessures hors-champ et tension nocturne.",
      "Langage familier et consommation d'alcool en contexte adulte; pas de sexe explicite.",
      "Ton parfois sombre alternant avec comédie; peut effrayer les enfants sensibles.",
    ],
    sensitiveWarnings: [
      "Scènes effrayantes ou angoissantes",
      "Violence",
      "Suspense ou tension intense",
      "Consommation d'alcool ou de tabac",
      "Images dérangeantes",
    ],
    enrichmentConfidence: 1,
  },
}

const WARZONE = {
  title: "Call of Duty: Warzone",
  type: "GAME",
  expertAgeRec: 18,
  releaseDate: "2020-03-10",
  synopsisFr: "Dès 18 ans, expérience multijoueur réaliste où des équipes s'affrontent sur une vaste carte.",
  contentMetrics: {
    violence: 4,
    sexNudity: 0,
    language: 4,
    consumerism: 3,
    substanceUse: 0,
    positiveMessages: 2,
    roleModels: 2,
    whatParentsNeedToKnow: [
      "Jeu de tir compétitif en équipe ou solo avec affrontements réalistes.",
      "Présence de langage grossier fréquent et d'échanges vocaux en ligne.",
      "Violence armée réaliste avec morts et blessures implicites.",
      "Contient microtransactions et achats cosmétiques intégrés.",
      "Expérience en ligne expose à des inconnus et comportements imprévisibles.",
    ],
    sensitiveWarnings: ["Violence", "Langage grossier", "Violence intense ou graphique", "Comportements à risque imités"],
    enrichmentConfidence: 0.95,
  },
}

const zero = {
  violence: 0,
  sexNudity: 0,
  language: 0,
  consumerism: 0,
  substanceUse: 0,
  positiveMessages: 0,
  roleModels: 0,
}

const describeFiche = (f: typeof BEETLEJUICE) =>
  buildFicheDescription({
    title: f.title,
    age: f.expertAgeRec,
    provisional: false,
    synopsis: f.synopsisFr,
    typeLabel: f.type === "GAME" ? "Jeu vidéo" : "Film",
    releaseDate: f.releaseDate,
    analysis: buildFicheReasons(f),
  })

describe("buildFicheReasons", () => {
  it("Beetlejuice: the frightening creatures named by the parents' bullets, then the scores", () => {
    expect(buildFicheReasons(BEETLEJUICE)).toEqual({
      reasons: ["fantômes et créatures qui peuvent effrayer", "violence 2/5", "langage 2/5"],
      hasSignal: true,
      onlyUnnamedSignal: false,
    })
  })

  it("Gremlins: the marked score first, then the creatures, then the mild score", () => {
    expect(buildFicheReasons(GREMLINS).reasons).toEqual([
      "violence 3/5",
      "créatures qui peuvent effrayer",
      "langage 2/5",
    ])
  })

  it("Call of Duty: Warzone: the game's own row labels (« achats intégrés »)", () => {
    expect(buildFicheReasons(WARZONE).reasons).toEqual(["violence 4/5", "langage 4/5", "achats intégrés 3/5"])
  })

  it("never names a spoiler flag (« Noyade », « Accident de voiture »…) but counts it as a signal", () => {
    const r = buildFicheReasons({ contentMetrics: { ...zero, sensitiveWarnings: ["Noyade"], enrichmentConfidence: 1 } })
    expect(r.reasons).toEqual([])
    expect(r.hasSignal).toBe(true)
    expect(r.onlyUnnamedSignal).toBe(true)
    for (const f of [BEETLEJUICE, GREMLINS, WARZONE]) {
      const text = buildFicheReasons(f).reasons.join(" ")
      expect(text).not.toMatch(/noyade|accident|deuil|mort/i)
    }
  })

  it("ignores flags under the card's confidence gate", () => {
    const r = buildFicheReasons({
      contentMetrics: { ...zero, sensitiveWarnings: ["Images dérangeantes"], enrichmentConfidence: 0.4 },
    })
    expect(r).toEqual({ reasons: [], hasSignal: false, onlyUnnamedSignal: false })
  })

  it("a score below REASON_METRIC_MIN is no reason; at it, it is", () => {
    expect(buildFicheReasons({ contentMetrics: { ...zero, violence: REASON_METRIC_MIN - 1 } }).hasSignal).toBe(false)
    expect(buildFicheReasons({ contentMetrics: { ...zero, violence: REASON_METRIC_MIN } }).reasons).toEqual([
      `violence ${REASON_METRIC_MIN}/5`,
    ])
  })

  it("never reads a negated bullet (« pas de monstres »)", () => {
    const r = buildFicheReasons({
      contentMetrics: { ...zero, whatParentsNeedToKnow: ["Aucune scène effrayante, pas de monstres."] },
    })
    expect(r.hasSignal).toBe(false)
  })

  it("a flag restating a score axis is named only when the score is not already a reason", () => {
    expect(
      buildFicheReasons({ contentMetrics: { ...zero, sensitiveWarnings: ["Langage grossier"], enrichmentConfidence: 1 } })
        .reasons,
    ).toEqual(["langage grossier"])
    expect(
      buildFicheReasons({
        contentMetrics: { ...zero, language: 3, sensitiveWarnings: ["Langage grossier"], enrichmentConfidence: 1 },
      }).reasons,
    ).toEqual(["langage 3/5"])
  })
})

describe("meta description from the analysis", () => {
  it("Beetlejuice (1988)", () => {
    expect(describeFiche(BEETLEJUICE)).toBe(
      "Beetlejuice (1988) : conseillé dès 10 ans. Fantômes et créatures qui peuvent effrayer, violence 2/5, langage 2/5. L'analyse pour les parents.",
    )
  })

  it("Gremlins (1984)", () => {
    expect(describeFiche(GREMLINS)).toBe(
      "Gremlins (1984) : conseillé dès 12 ans. Violence 3/5, créatures qui peuvent effrayer, langage 2/5. L'analyse pour les parents.",
    )
  })

  it("Call of Duty: Warzone (2020)", () => {
    expect(describeFiche(WARZONE)).toBe(
      "Call of Duty: Warzone (2020) : conseillé dès 18 ans. Violence 4/5, langage 4/5, achats intégrés 3/5. L'analyse pour les parents.",
    )
  })

  it("stays within MAX_DESCRIPTION, dropping reasons from the end", () => {
    const long = { ...BEETLEJUICE, title: "Un titre assez long pour ne garder qu'une raison" }
    const d = describeFiche(long)
    expect(d.length).toBeLessThanOrEqual(MAX_DESCRIPTION)
    expect(d).toBe(
      "Un titre assez long pour ne garder qu'une raison (1988) : conseillé dès 10 ans. Fantômes et créatures qui peuvent effrayer. L'analyse pour les parents.",
    )
  })

  it("a name too long for even the bare verdict falls back to the synopsis description", () => {
    const d = describeFiche({ ...BEETLEJUICE, title: "Un titre extrêmement long ".repeat(6).trim() })
    expect(d.length).toBeLessThanOrEqual(MAX_DESCRIPTION)
    expect(d.startsWith("Film de 1988 · Notre avis famille · ")).toBe(true)
  })

  it("« tous publics » and no signal at all", () => {
    expect(
      buildFicheDescription({
        title: "Bluey",
        age: 0,
        typeLabel: "Série",
        releaseDate: "2018-10-01",
        analysis: buildFicheReasons({ contentMetrics: zero }),
      }),
    ).toBe("Bluey (2018) : conseillé pour tous publics. Aucun signal sensible majeur relevé. L'analyse pour les parents.")
  })

  it("provisional or without analysis: the synopsis description, unchanged", () => {
    const provisional = buildFicheDescription({
      title: "Beetlejuice",
      age: 10,
      provisional: true,
      synopsis: "Deux fantômes cherchent à chasser les nouveaux occupants.",
      typeLabel: "Film",
      releaseDate: "1988-03-30",
      analysis: buildFicheReasons(BEETLEJUICE),
    })
    expect(provisional).toBe(
      "Âge conseillé dès 10 ans (à confirmer) · Film de 1988 — Deux fantômes cherchent à chasser les nouveaux occupants.",
    )
    const noAnalysis = buildFicheDescription({
      title: "Beetlejuice",
      age: 10,
      synopsis: "Deux fantômes cherchent à chasser les nouveaux occupants.",
      typeLabel: "Film",
      releaseDate: "1988-03-30",
      analysis: null,
    })
    expect(noAnalysis).toBe(
      "Dès 10 ans · Notre avis famille · Film de 1988 — Deux fantômes cherchent à chasser les nouveaux occupants.",
    )
  })
})

describe("FAQ answer gives the same reasons as the meta description", () => {
  it("Beetlejuice (1988): the reasons, never « Aucun signal sensible majeur »", () => {
    const qa = buildQuickAnswer(BEETLEJUICE)
    expect(qa.answer).toBe(
      "Beetlejuice (1988) est un film conseillé à partir de 10 ans par Totem Avisé, principalement en raison de : fantômes et créatures qui peuvent effrayer, violence 2/5, langage 2/5. Les apports positifs sont à lire dans l'analyse détaillée.",
    )
    expect(qa.answer).not.toContain("Aucun signal sensible")
  })

  it("Gremlins (1984)", () => {
    expect(buildQuickAnswer(GREMLINS).answer).toBe(
      "Gremlins (1984) est un film conseillé à partir de 12 ans par Totem Avisé, principalement en raison de : violence 3/5, créatures qui peuvent effrayer, langage 2/5. Les apports positifs sont à lire dans l'analyse détaillée.",
    )
  })

  it("Call of Duty: Warzone (2020)", () => {
    expect(buildQuickAnswer(WARZONE).answer).toBe(
      "Call of Duty: Warzone (2020) est un jeu vidéo conseillé à partir de 18 ans par Totem Avisé, principalement en raison de : violence 4/5, langage 4/5, achats intégrés 3/5. Les apports positifs sont à lire dans l'analyse détaillée.",
    )
  })

  it("every reason in the description is in the FAQ answer", () => {
    for (const f of [BEETLEJUICE, GREMLINS, WARZONE]) {
      const answer = buildQuickAnswer(f).answer.toLowerCase()
      for (const reason of buildFicheReasons(f).reasons) expect(answer).toContain(reason)
    }
  })

  it("« Pourquoi dès 10 ans ? » no longer says « aucun élément sensible » over Beetlejuice's creatures", () => {
    const r = buildAgeRationale(BEETLEJUICE)
    expect(r.drivers).toEqual([])
    expect(r.noDriverNote).toBe(
      "Aucun axe n'est très marqué ; l'analyse relève toutefois : fantômes et créatures qui peuvent effrayer, violence 2/5, langage 2/5.",
    )
    expect(r.plainText).not.toContain("Aucun élément sensible")
  })

  it("only spoiler flags: says points are detailed on the fiche, never « aucun signal »", () => {
    const qa = buildQuickAnswer({
      title: "Un film",
      type: "MOVIE",
      expertAgeRec: 8,
      contentMetrics: { ...zero, sensitiveWarnings: ["Mort d'un animal"], enrichmentConfidence: 1 },
    })
    expect(qa.answer).toContain("Quelques points de vigilance sont détaillés dans la fiche.")
    expect(qa.answer).not.toContain("Aucun signal")
    expect(qa.answer).not.toMatch(/animal/i)
  })

  it("keeps « Aucun signal sensible majeur » when nothing at all is flagged", () => {
    const qa = buildQuickAnswer({ title: "Un film", type: "MOVIE", expertAgeRec: 6, contentMetrics: zero })
    expect(qa.answer).toContain("Aucun signal sensible majeur ne ressort dans les dimensions principales.")
  })
})
