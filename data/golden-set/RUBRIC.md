# Golden set — labeling rubric (v1)

You are encoding **Totem's editorial standard**: the *correct family-recommended
age* and content levels for each title. This is your judgment as the family-media
editor — not a legal rating, and not an objective truth. No credentialed expert is
required for this pilot; the rubric below keeps your judgments consistent. (For a
future public/B2B version, a second labeler or a child-development consultant could
review a subset — credibility, not correctness.)

## How to fill the sheet (`golden-set-v1.csv`)

- Open in Excel / Google Sheets. **Only edit the `gold_*` columns and `notes`.**
  Leave the context columns (id, title, synopsis, fiche_url…) untouched.
- **Label titles you know.** If you don't know a title, open its `fiche_url`, or
  **leave the row blank** (blank rows are skipped — a smaller clean set beats
  guesses). Use `notes` for "unsure" / "needs second opinion".
- The sheet intentionally hides Totem's current age/metrics so you judge fresh.
- Optional: an `labeler` column can be added if a second person labels too — ask
  and we'll regenerate with it.

## `gold_age` — the recommended family age

The **youngest age at which a typical child can handle the whole experience** —
themes, fear, intensity, not just "is there a bad word". Independent of the legal
rating: it **may be stricter** (a lenient "tous publics" war drama can be 12+) and
should rarely be more lenient than the legal floor. Use a whole number
(0, 3, 6, 8, 10, 12, 14, 16…). The age is the **primary** signal; the axes are
secondary cues.

## The 7 content axes — scale 0–5 (same scale for ALL types)

General word scale: **0 = none, 1 = minimal, 2 = light, 3 = moderate, 4 = strong,
5 = intense.** Always discount **stylized** content (animation, cartoon,
fantasy/superhero with no real consequence): the same scene "counts" less in light
animation than in live action.

| Axis (column) | 0 | 1–2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| `gold_violence` | none | light peril, slapstick, bloodless cartoon scuffles | repeated fights, weapons, tension, off-screen death | realistic violence, blood, shown injuries | gore, torture, graphic death |
| `gold_sexNudity` | none | romance, kisses, light innuendo | marked sensuality, suggested nudity | implied sex / nudity | explicit sex |
| `gold_language` | none | a few mild/familiar words | regular insults | frequent crude language | very crude or hateful |
| `gold_substanceUse` | none | alcohol in the background | use shown | abuse / drugs central to the story | glorified or explicit use |
| `gold_consumerism` | none | minor | some commercial pressure / product placement | strong | relentless. **Games:** this = microtransactions / loot boxes / battle pass / pay-to-win — NOT TV-style ad pressure. |
| `gold_positiveMessages` | none | minor | some positive values | strong (friendship, courage, empathy) | central, powerful messages |
| `gold_roleModels` | none | weak | some admirable behavior | strong role models | exemplary, inspiring characters |

### Per-type notes
- **Same 0–5 scale for movies, TV and games.** Only `consumerism` is read
  differently for games (see above).
- **All-ages titles (e.g. a Mario, a preschool show):** don't agonize over 0 vs 1.
  Use **0** when an axis is genuinely absent; **1** only if there's a real (if
  tiny) trace. A typical Mario game: violence 1 (cartoon bops), sexNudity 0,
  language 0, substances 0, consumerism per the game's monetization.

## Coherence check (important)
Keep `gold_age` and the axes consistent. A title you'd recommend from 6–8 should
**not** carry an axis above 2 ("light") in violence/sex/language/substances —
unless one specific scene truly justifies it, in which case **raise the age**
rather than hide the scene.
