# F02 — « Ce qui peut marquer » : warning recall, measured apart from the age

_Written 2026-11-07 (Age Keeper, branch `claude/age-keeper-f04-f02`). Read-only: live data
read through the public MCP (`get_age_verdict`), no database write, no LLM call._

**What this is:** why a parent choosing for an 8–10-year-old landed on « Amélie et la
métaphysique des tubes » with nothing flagged, what changed on the fiche, and a small
reference set to measure **warning recall** (did we flag the moments that can upset a child?)
separately from the age verdict.

## The incident

« Amélie et la métaphysique des tubes » (2025, `movie:e286693a-d577-4da7-8f3f-df2ff360bc28`):
8+, a reassuring quick answer, and « Aucun point signalé pour l'instant » under « Ce qui peut
marquer ». The [BBFC](https://www.bbfc.co.uk/release/little-amelie-q29sbgvjdglvbjpwwc0xmdq4mjq2)
rates it PG for « mild threat, upsetting scenes »: two scenes in which a toddler falls into
water and begins to drown before being rescued; a woman who survived WWII as a child
describes the bombing that killed her family; bereavement (a grandmother's death). It adds
that these themes are handled sensitively and the tone is not dark.
(Read through search on 2026-11-07 — the page itself isn't reachable from the agent sandbox.)

What the site stored (public MCP, 2026-11-07): basic pass `AI_BASIC` of 2026-08-04,
confidence 0.72, violence 1, language 1, other axes 0, **warnings computed and empty**.

## Where the cues were lost

| Stage | Finding |
|---|---|
| **Source ingestion** | The only text the analysis gets is the catalogue synopsis (a spoiler-free premise) plus genres and keywords. No scene-level parental source (BBFC advice, CNC/Arcom notes) is ingested. **Lost here.** |
| **Enrichment prompt** | The basic pass (`/api/admin/enrich`, `gpt-5-mini`, no web access) is told to rely on its own knowledge of the title and to return `[]` « pour un contenu doux ». A 2025 film is very likely outside the model's training data, so it worked from the premise alone — and an empty list was the prompt's prescribed answer for that. It had no way to say « je ne connais pas ce film ». **Lost here.** |
| **Confidence gate** | The model self-reported ~0.8 (0.72 after the data-quality heuristics). That kept the title out of the deep pass (`gpt-4o` + web search, `needsDeepEnrich` = score < 0.6), which could have found the BBFC advice, and passed the 0.6 display gate. **Compounded here.** |
| **Taxonomy** | Fine — « Noyade », « Thèmes de mort ou de deuil », « Guerre », « Détresse émotionnelle » all exist. |
| **Storage** | Fine for this purpose — `sensitive_warnings_at` already separates « never computed » from « computed, none found ». Nothing records *what evidence* the warnings came from. |
| **Display** | The V3 card didn't receive `sensitive_warnings_at` and printed « Aucun point signalé pour l'instant » for every empty list — an affirmative-sounding « no concern ». **Made it worse.** |

## What changed on the fiche (this branch)

One rule, `aiWarningsState` (`src/lib/sensitive-warnings.ts`), shared by the V3 fiche and the
`/md` + MCP layer:

| State | When | The card says |
|---|---|---|
| `no_data` | never computed, or below the 0.6 confidence gate | « Pas encore de données sur les moments sensibles » |
| `nothing_flagged` | a confident automated pass ran and flagged nothing | « Rien de relevé par l'analyse automatique · ce n'est pas une garantie » |
| `flagged` | at least one AI or community flag | « N points de vigilance · afficher (peut divulgâcher) » (unchanged) |

The open panel adds one sentence on what the absence is worth and points to « Signaler un
autre élément ». The classic fiche already rendered nothing for an empty list.

## Reference set — 20 titles with documented sensitive moments

Chosen to be **manually verifiable** (each has a public BBFC page, UK title given) and to
include **recent titles** (2023–2025, rows 1–4), the segment where the basic pass can't know
the film and works from the synopsis alone. Expected categories use the closed vocabulary
exactly. A human checks each line against the source before the set is used as an answer key.

| # | Titre (année) | Moments documentés (bref) | Catégories attendues | Source (BBFC, titre UK) | Vérifié (qui, quand) |
|---|---|---|---|---|---|
| 1 | Amélie et la métaphysique des tubes (2025) | deux quasi-noyades d'une toute petite ; récit d'une famille tuée dans un bombardement ; deuil | Noyade · Guerre · Thèmes de mort ou de deuil | Little Amélie | |
| 2 | Flow, le chat qui n'avait plus peur de l'eau (2024) | inondation, animaux en péril dans l'eau | Catastrophe naturelle · Noyade | Flow | |
| 3 | Le Robot sauvage (2024) | mort accidentelle d'une famille d'oies ; périls, tempête | Mort d'un animal · Thèmes de mort ou de deuil · Scènes effrayantes ou angoissantes | The Wild Robot | |
| 4 | Le Garçon et le Héron (2023) | mère morte dans un incendie en temps de guerre ; blessure que le garçon s'inflige à la tête | Guerre · Thèmes de mort ou de deuil · Automutilation ou suicide · Sang ou blessures | The Boy and the Heron | |
| 5 | Wonder (2017) | harcèlement à l'école ; mort de la chienne de la famille | Harcèlement scolaire · Mort d'un animal | Wonder | |
| 6 | Le Tombeau des lucioles (1988) | guerre, bombardements, brûlures, mort d'enfants | Guerre · Thèmes de mort ou de deuil · Images dérangeantes · Sang ou blessures | Grave of the Fireflies | |
| 7 | Le Roi Lion (1994) | mort du père dans la débandade ; hyènes, combat | Thèmes de mort ou de deuil · Scènes effrayantes ou angoissantes · Violence | The Lion King | |
| 8 | Bambi (1942) | mère tuée par un chasseur (hors champ) | Mort d'un animal · Thèmes de mort ou de deuil | Bambi | |
| 9 | Là-haut (2009) | maladie et mort de l'épouse dans le prologue | Thèmes de mort ou de deuil · Hôpital ou scènes médicales | Up | |
| 10 | Le Monde de Nemo (2003) | mère tuée au début ; enfant enlevé ; requins | Thèmes de mort ou de deuil · Séparation ou abandon · Scènes effrayantes ou angoissantes | Finding Nemo | |
| 11 | La Reine des neiges (2013) | parents disparus en mer ; sœurs séparées | Thèmes de mort ou de deuil · Séparation ou abandon | Frozen | |
| 12 | Coco (2017) | la mort et le souvenir des défunts ; famille séparée | Thèmes de mort ou de deuil · Séparation ou abandon | Coco | |
| 13 | Frère des ours (2003) | mort d'un frère ; une ourse tuée | Thèmes de mort ou de deuil · Mort d'un animal | Brother Bear | |
| 14 | Toy Story 3 (2010) | scène de l'incinérateur ; garderie menaçante | Suspense ou tension intense · Scènes effrayantes ou angoissantes | Toy Story 3 | |
| 15 | Vice-versa (2015) | tristesse, fugue d'une enfant | Détresse émotionnelle | Inside Out | |
| 16 | E.T. l'extra-terrestre (1982) | maladie grave, quarantaine médicale, mort apparente | Maladie grave ou cancer · Hôpital ou scènes médicales · Thèmes de mort ou de deuil | E.T. the Extra-Terrestrial | |
| 17 | Mon voisin Totoro (1988) | mère hospitalisée ; petite sœur perdue | Hôpital ou scènes médicales · Séparation ou abandon | My Neighbour Totoro | |
| 18 | Ponyo sur la falaise (2008) | tempête et inondation | Catastrophe naturelle | Ponyo | |
| 19 | Coraline (2009) | monde inquiétant, « autre mère » menaçante | Scènes effrayantes ou angoissantes · Images dérangeantes | Coraline | |
| 20 | Marley & moi (2008) | fin de vie et mort du chien | Mort d'un animal · Thèmes de mort ou de deuil | Marley & Me | |

### How to score it

- **Per title:** recall = expected categories present in the stored flags ÷ expected
  categories. Count the community-confirmed flags separately from the AI ones.
- **False reassurance** (the Amélie failure): expected categories non-empty, AI flags empty,
  state `nothing_flagged`. This is the number to drive to zero first.
- **Coverage gap:** state `no_data` (honest, but nothing to show).
- Report recent titles (rows 1–4) and classics separately; never fold it into the age
  accuracy of `age-rating-baseline.md`.
- Re-run after any change to the enrichment prompt, model or confidence rule.

## Baseline (live site, 2026-11-07)

Read through the public MCP (`get_age_verdict`). All 20 titles are in the catalogue, analysed
(`available`, none provisional), by the basic pass (19 `AI_BASIC`, Totoro `AI_RECAL`), with a
self-reported confidence of 0.72 to 1.0. Recall counts **exact** category matches; the AI
flags only (community votes not included); precision is not scored (the set has no negative key).

| Segment | Expected | Found | Recall |
|---|---|---|---|
| Recent titles, rows 1–4 (2023–2025) | 12 | 2 | **17 %** |
| Classics, rows 5–20 | 35 | 28 | **80 %** |
| All | 47 | 30 | 64 % |

- **False reassurance: 1/20** — Amélie (expected flags, none stored, confident pass).
- **Zero recall:** Amélie, Flow, and Wonder in strict terms (it carries « Maltraitance ou
  harcèlement », the generic neighbour of the expected « Harcèlement scolaire »).
- **Reading:** the model covers the classics it knows and misses the recent titles it can't —
  the Amélie mechanism — while reporting 0.88–1.0 confidence on them. Confidence does not
  flag the gap.

| # | Titre (catalogue) | Âge | Confiance | Trouvées | Manquées |
|---|---|---|---|---|---|
| 1 | Amélie et la métaphysique des tubes | 8 | 0.72 | 0/3 | Noyade, Guerre, Thèmes de mort ou de deuil |
| 2 | Flow, le chat qui n'avait plus peur de l'eau | 6 | 0.88 | 0/2 | Catastrophe naturelle, Noyade |
| 3 | Le Robot sauvage | 6 | 0.99 | 1/3 | Mort d'un animal, Thèmes de mort ou de deuil |
| 4 | Le Garçon et le héron | 10 | 1 | 1/4 | Guerre, Automutilation ou suicide, Sang ou blessures |
| 5 | Wonder | 8 | 1 | 0/2 | Harcèlement scolaire (has « Maltraitance ou harcèlement »), Mort d'un animal |
| 6 | Le Tombeau des lucioles | 12 | 1 | 3/4 | Sang ou blessures |
| 7 | Le Roi lion | 6 | 1 | 3/3 | — |
| 8 | Bambi | 6 | 1 | 2/2 | — |
| 9 | Là-haut | 8 | 1 | 1/2 | Hôpital ou scènes médicales |
| 10 | Le Monde de Nemo | 6 | 1 | 2/3 | Thèmes de mort ou de deuil |
| 11 | La Reine des neiges | 6 | 1 | 1/2 | Thèmes de mort ou de deuil |
| 12 | Coco | 7 | 1 | 2/2 | — |
| 13 | Frère des ours | 6 | 1 | 2/2 | — |
| 14 | Toy Story 3 | 6 | 1 | 2/2 | — |
| 15 | Vice-versa | 8 | 1 | 1/1 | — |
| 16 | E.T. l'extra-terrestre | 8 | 1 | 2/3 | Maladie grave ou cancer |
| 17 | Mon voisin Totoro | 6 | 1 | 2/2 | — |
| 18 | Ponyo sur la falaise | 6 | 1 | 1/1 | — |
| 19 | Coraline | 8 | 1 | 2/2 | — |
| 20 | Marley & moi | 8 | 1 | 2/2 | — |

(Search tip: the catalogue spells #20 « Marley & moi »; « Marley et moi » finds nothing.)

## Recommendations (pipeline — Librarian's area, not changed here)

1. **Let the model say « je ne sais pas »** for warnings: an explicit `unknown` (stored as
   `sensitive_warnings_at = NULL`, i.e. `no_data`) instead of the prescribed `[]`, and use
   `[]` only when the model knows the title.
2. **Don't trust self-reported confidence for titles newer than the model**: the baseline
   shows 0.88–1.0 on 2023–2025 titles with 17 % recall. Cap the basic pass's confidence (or
   force `needsDeepEnrich`) for titles released after the model's training data, so they go
   to the web-search pass — then re-run this set.
3. **Ingest a scene-level source** where the terms allow it — BBFC content advice is public
   and is exactly what the Amélie fiche was missing.
4. **Use the parents**: the « Signaler un autre élément » picker exists; the new empty states
   now invite it.

## Amélie — correction prepared, NOT applied

`sql/correct_amelie_metaphysique_des_tubes_warnings.sql`, waiting for Xavier's OK (production
write). It adds five closed-vocabulary flags (Noyade, Thèmes de mort ou de deuil, Guerre,
Détresse émotionnelle, Mort d'un animal) and appends three spoiler-aware bullets to « Ce
qu'il faut savoir »; it keeps the existing bullets and the 8+. The near-drownings are worded
as the BBFC describes them (falls into water, rescued) — never as a suicide attempt. Guarded
and idempotent; tested on an in-process Postgres with the real freshness trigger
(`src/lib/__tests__/amelie-warnings-correction.test.ts`). Re-read the BBFC page verbatim
before applying; once applied, the row moves from 0/3 to 3/3 in the table above.
