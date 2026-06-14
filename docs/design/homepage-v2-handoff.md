# Homepage V2 redesign — design handoff (committed reference)

The full prototype lives in `dump/RedesignPages/Homepage/` (gitignored). This file
captures the durable spec so the V2 work doesn't depend on an untracked folder.
V2 is an **admin-only** variant of `/` (public keeps the classic homepage). All V2
styling is scoped under `[data-home="v2"]`.

## Tokens (scoped under `[data-home="v2"]`, light + dark via `data-theme`)
Light: `--paper #F4ECDE` · `--paper-2 #FBF5EA` · `--card #FFFDF8` · `--ink #23201C` ·
`--ink-2 #4F463C` · `--ink-3 #867A6B` · `--line #E2D6C2` · `--line-2 #EDE3D2` ·
`--terra #C5512C` · `--terra-2 #A8421F` · `--terra-soft #F0D9CB` · `--pine #23493D` ·
`--pine-2 #2E5C4D` · `--pine-soft #D7E6DD` · `--gold #D99524`.
Rating scale: `--r0 #CFC4B2` (Aucun) · `--r1 #4F9E6A` (Léger) · `--r2 #E0902A` (Modéré) ·
`--r3 #C2412A` (Marqué).
Dark: `--paper #17130E` · `--paper-2 #201A13` · `--card #241E15` · `--ink #F3EBDD` ·
`--ink-2 #CDBFA9` · `--ink-3 #8E8070` · `--line #362D22` · `--line-2 #2C261D` ·
`--terra #E0734A` · `--terra-2 #C95C36` · `--pine-2 #5CB991` · `--gold #E6B04A`.
(`--pine` méthode band, footer, posters, genre tiles keep fixed colors in both themes.)
Radii: `--r-lg 22px` · `--r-md 14px` · `--r-sm 9px` · poster 14px · pills 999px.

## Fonts (scoped to the V2 chunk)
- **Bricolage Grotesque** (500/600/700/800) — headings, brand, numbers/ages; `letter-spacing:-.02em`.
- **Newsreader** italic (400/500) — emphasized words in headings + poster titles.
- **Hanken Grotesk** (400–700) — body/UI/labels.
Heading clamps: hero `clamp(40px,6vw,76px)`; section h2 `clamp(26px,3.4vw,40px)`; final CTA `clamp(30px,4.4vw,52px)`.
Eyebrows: 12.5px/700, `letter-spacing:.16em`, uppercase, `--terra`, 6px terra dot.
Heading emphasis alternates terra→pine→gold via `<em class="c-terra|c-pine|c-gold">`.

## Totem rating (signature) — axes v/s/l/a = Violence · Sexe/Sensualité · Langage · Substances
Data: `contentMetrics.{violence,sexNudity,language,substanceUse}` (0–5) → UI level 0–3 via
`0→0, 1–2→1, 3→2, 4–5→3` → word `["Aucun","Léger","Modéré","Marqué"]` → color `--r0..--r3`.
Three renderings: **compact** age badge (top-right of dense cards: `{age}+` + 4 tiny bars),
**full** totem (large cards: `{age}+` + 4 labeled 3-dot meters), **hover popover** `.rate-pop`
(per-axis label + level word + meter, header "Dès {age} ans · ce que contient ce titre",
footer "+ d'autres repères sur la fiche →"). Upcoming/unreleased titles show the age badged
"à confirmer" and **no content totem** (honesty — `shouldHideContentAnalysis`).

## Sections (single long-scroll; nav + footer reuse the global SiteHeader/SiteFooter)
1. Hero — pill, H1 "Trouvez les *bons contenus* (pine), pour votre *famille* (terra)", subhead,
   **personalization**: "Les âges de vos enfants ?" age chips (2–4/5–7/8–10/11–12/13–15/16+,
   multi-select) + search + "Populaire:" tags. Drifting poster wall bg (paused if reduced-motion).
2. Pour ce week-end — rail, age-chip filtered (data: `/api/db/movies?maxAge&caps&shuffle=weekly`).
3. Bientôt — prochaines sorties — upcoming rail + notify toggle (data: `/api/db/upcoming`). [PR2]
4. À l'affiche au cinéma — rail (`/api/cinema`).
5. Nos coups de cœur — rail (`/api/db/expert-picks?limit=6`).
6. Adapté à chaque étape (par âge) — tiles (counts via `/api/db/movies` per `APERCU_AGE_BUCKETS`).
7. Sur vos plateformes — platform tabs (`/api/db/streaming?provider=`). [PR2]
8. Sortis récemment en jeux vidéo — rail (`/api/db/games?sortBy=releaseDate`).
9. Notre méthode — pine band + totem decoder. [PR2]
10. Explorer par thème — 8 pastel genre tiles (reuse `THEMES` from ApercuCollections).
11. Final CTA.
Genre pastels: Aventure `#E0936B` · Animation `#F0D2B6` · Fantastique `#C9B6DD` ·
Comédie `#F0CE72` · Nature `#A9CE8A` · Sci-Fi `#86B2CC` · Drame `#CE8FA8` · Musique `#E2C49C`.

## Floating: family nudge → totem launcher [PR2]
Bottom-LEFT (avoid the global Totem dock, bottom-right). Appears after age-pick or scroll to
Bientôt; collapses to a glowing totem launcher; `localStorage["ta-fam-collapsed"]`; real logo mark;
CTA → `/inscription`; respects `prefers-reduced-motion`.

## Responsive breakpoints
Age tiles 3→2→1 (≤860/≤540) · genres 4→2→1 (≤900/≤520) · hero/section type via clamp().
Rails: horizontal scroll, `scroll-snap-type:x mandatory`, hidden scrollbars.

## Admin gating
`/` renders V2 for admins by default; `/?v=classic` shows the classic homepage; an admin-only
toggle chip switches. Non-admins always get classic. V2 is `next/dynamic`-imported so its chunk
+ fonts never ship to anonymous visitors.
