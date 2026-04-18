# Totem Avisé — Art Direction

A working guide for the `/apercu*` redesign and the eventual migration to the live site. This doc is the single source of truth for palette, typography, layout, component patterns and voice. When it drifts from the code, update it.

Canonical implementation lives at [`src/components/home-v2/`](../src/components/home-v2/) and [`src/app/apercu/`](../src/app/apercu/). When adding a new apercu page, start by copying those patterns — don't reinvent them.

---

## 1. Brand positioning

**One sentence:** a warm, independent, confident guide for every foyer — never childish, never cold, never algorithmic.

| | Is | Isn't |
|---|---|---|
| Voice | Confident, calm, a little literary | Cutesy, corporate, alarmist |
| Color | Warm neutrals + earthy accents | Neon, pastel-baby, glassy blue |
| Tone | "Between people who choose carefully" | "For the kids", "for the algorithm" |
| Energy | Considered, slightly editorial | Dense feed, infinite scroll |
| Audience | **Foyers of any shape** — parents with kids, couples without, solo cinephiles | A narrow family-with-young-kids niche |

The word we use everywhere is **foyer** — it welcomes families, couples, colocations, and solo viewers alike. "Famille" and "parents" appear only where they genuinely describe a feature (age filtering, per-member profiles). "Enfant" only when the content actually concerns child development.

Designs should read like a **well-edited family magazine** — serious enough that a parent of a 15-year-old feels addressed, warm enough that a parent of a 4-year-old does too, and specific enough that a couple looking for a Saturday-night film doesn't feel excluded.

---

## 2. Color system

One palette implemented today: **Chaleureux** (warm cream). Two more are planned — **Clair** (brighter daytime) and **Soirée** (dark mode). Until they exist in code, treat Chaleureux as the only palette.

Source of truth: [`src/components/home-v2/apercuTheme.ts`](../src/components/home-v2/apercuTheme.ts) — `APERCU_PALETTE`.

### Chaleureux (default)

| Token | Hex | Role |
|---|---|---|
| `bg` | `#F5F1E9` | Page canvas (warm cream) |
| `bg2` | `#EDE7DA` | Banded sections, card wash, subtle contrast |
| `card` | `#FFFFFF` | Cards, search bar, elevated surfaces, floating badges |
| `ink` | `#1E1A15` | Primary text, dark CTAs, footer background, preview banner |
| `ink2` | `rgba(30,26,21,0.60)` | Secondary text, captions, meta |
| `accent` | `#D16A4A` | **Terracotta** — italic emphasis, primary accent, warm CTA start |
| `accent2` | `#5C8A5C` | **Sage** — secondary italic emphasis, trust/check signals, CTA end |
| `line` | `rgba(30,26,21,0.08)` | Hairline dividers |
| `line2` | `rgba(30,26,21,0.15)` | Button borders, inactive tab borders |
| `placeholder` | `#E6DFCE` | Image placeholders |

### Age-range accent colors

Identity colors per age bucket. **Always use the same hex for the same age** — on age tiles, age pills, avatars, sensitivity rings, filter chips.

Source of truth: [`apercuTheme.ts`](../src/components/home-v2/apercuTheme.ts) — `APERCU_AGE_BUCKETS`.

| Range | Name | Hex |
|---|---|---|
| 2–4 | Tout-petits | `#F4C7A6` (peach) |
| 5–7 | Enfants | `#F8D775` (butter) |
| 8–10 | Grands enfants | `#B8D89A` (sage-lime) |
| 11–12 | Pré-ados | `#8DBDC9` (sky) |
| 13–15 | Ados | `#A79BC7` (violet) |
| 16+ | Jeunes adultes | `#D89AB0` (rose) |

### Theme tile colors

Drawn from the **same chromatic family as the age palette** so the page stays in one chromatic universe. Don't invent new hues per theme.

Source of truth: [`ApercuCollections.tsx`](../src/components/home-v2/ApercuCollections.tsx) — `THEMES`.

| Theme | Hex |
|---|---|
| Aventure | `#E8A87C` (warmer peach) |
| Animation | `#F4C7A6` (peach, matches 2–4) |
| Fantastique | `#C9B7D9` (lavender) |
| Comédie | `#F8D775` (butter, matches 5–7) |
| Nature | `#B8D89A` (sage-lime, matches 8–10) |
| Sci-Fi | `#8DBDC9` (sky, matches 11–12) |
| Drame | `#D89AB0` (rose, matches 16+) |
| Musique | `#E9C7A1` (warm beige) |

### Family-Fit verdict colors

On per-member fit badges (shown on every media card when logged in):

| Verdict | Dot color | Use |
|---|---|---|
| Adapté | `#5C8A5C` sage | Score ≥ 70 / content matches sensitivities |
| Attention | `#D89A4A` amber | Score 40–69 / borderline |
| Pas adapté | `#D16A4A` terracotta | Score < 40 / fails a hard threshold |

### Usage rules

- **One vivid color per section.** Never two pastel tiles touching without a neutral in between.
- **Terracotta** = primary italic emphasis on key words, primary CTA start, active-state dot on preview banner.
- **Sage** = secondary italic emphasis (one per heading max), trust signals, "Adapté" verdicts, check icons.
- Age & theme colors live on **tile backgrounds and small dots** — never on text color.
- **No gradients** except: (a) the final CTA block (`accent → accent2` diagonal), (b) nothing else.
- **Never pure black** (`#000`). Always `ink` (`#1E1A15`).

---

## 3. Typography

Two families, no exceptions. The site also carries `--font-anton` and `--font-edunline` for the logotype — those stay scoped to the logo.

### Families

- **Fraunces** (variable serif) — headings, poster titles, stat numbers, italic emphasis. Loaded via `next/font/google` in [`apercuFont.ts`](../src/components/home-v2/apercuFont.ts). Offered as the default on `/apercu`, with `?font=poppins` as an A/B escape to the current brand font for comparison.
- **Inter** (variable sans, via the existing `--font-sans`) — body, UI, buttons, meta, captions.

### Scale

Use Tailwind utilities. These are the clamped sizes actually shipping:

| Use | Family | Tailwind | Letter-spacing |
|---|---|---|---|
| Display hero | Fraunces | `text-4xl md:text-5xl lg:text-6xl` | `-0.02em` |
| H2 section | Fraunces | `text-2xl md:text-4xl` | `-0.03em` |
| H3 card title / pulse row | Fraunces | `text-lg md:text-xl` / `text-xl md:text-2xl` | `-0.02em` |
| Stat number | Fraunces | `text-2xl md:text-3xl` | `-0.02em` |
| Body | Inter | `text-base md:text-lg` | default |
| UI / button | Inter | `text-sm`, `font-medium` or `font-semibold` | default |
| Eyebrow | Inter | `text-[11px]`, `font-semibold`, `uppercase`, `tracking-wide` | `+0.5` (via uppercase) |
| Meta / caption | Inter | `text-xs` or `text-[11px]` | default |

### Italic as a tool

Fraunces italics carry the personality. In every heading, italicize 1–2 key words.

> Les *bons contenus*, choisis *en confiance*.
> Adapté à *chaque* étape.
> Un *genre*, une *humeur*, une idée.
> Nos *coups de cœur* de la semaine.

**Rules:**
- Italicize emotional / editorial words. Never functional ones.
- First italic = terracotta (`accent`). Second italic (if any) = sage (`accent2`).
- Max two italic spans per heading. One per eyebrow-h2 pair is cleaner.
- Never use Inter italic. Inter italic is fine but loses personality — default to Fraunces for anything italicized.

---

## 4. Layout & spacing

Canonical scaffolding: [`HomepageApercu.tsx`](../src/components/home-v2/HomepageApercu.tsx).

- **Container**: Tailwind `container mx-auto px-4 md:px-8`.
- **Section vertical rhythm**: `py-10 md:py-14` (~40–56 px). Dense but breathable. Hero is the exception at `py-10 md:py-16`.
- **Grid gaps**: `gap-3` for tight card grids (posters), `gap-4` for sections, `gap-8 md:gap-10` for hero stats.
- **Radii**:
  - `rounded-full` / 999 — pills, avatars, preview banner links
  - `rounded-[20px]` / 20 — age tiles
  - `rounded-2xl` / 16 — cards, theme tiles, floating badges
  - `rounded-xl` / 12 — small cards (poster thumbs in pulse, age-grid count tiles)
  - `rounded-[10px]` — dark CTAs in hero
  - `rounded-3xl` — final CTA block
- **Shadows** — only two, never more:
  - Resting card: `0 1px 2px rgba(0,0,0,0.04)` (almost invisible)
  - Floating card / hero pick: `0 8px 24px rgba(0,0,0,0.10)` — or `0 28px 56px rgba(0,0,0,0.20)` for the *one* highlighted hero card
- **Dividers**: `1px` `line`. Never heavy rules.

### Banding pattern

Alternate sections between `bg` → `bg2` → `bg` → `bg2` → …

There is **no dark section mid-page**. Dark `ink` is reserved for:
- The preview banner at the very top of `/apercu*` (routes only visible to admins)
- The footer (`ApercuFooter.tsx`)

The final CTA is a warm gradient block, not a dark break. This gives the page a single unbroken warm rhythm from hero to footer.

---

## 5. Components

All components live in [`src/components/home-v2/`](../src/components/home-v2/). When building a new apercu page, copy them rather than re-imagining.

### Buttons

- **Primary dark** — `ink` background, `bg` text, `rounded-[10px]`, `px-5 py-3`, `font-medium`. Used inside the hero search bar and logged-in CTAs.
- **Primary accent** — `accent` background, white text, `rounded-full`, `px-7 py-3`, `font-semibold`. Used on the final CTA.
- **Ghost / secondary** — transparent, `line2` border, same radius. For "Autre sélection", "Voir tout →", chip links.
- Pair important CTAs with a short honest meta (`Gratuit, sans publicité, sans algorithme opaque`) instead of exclamation marks.

### Cards (media)

Canonical: [`ApercuMediaCard.tsx`](../src/components/home-v2/ApercuMediaCard.tsx).

- White (`card`) background, `rounded-xl`, `1px line` border, no shadow at rest.
- 2:3 poster on top, metadata row below (Fraunces title one-line-clamped, genre on its own line small).
- Age pill top-left of the poster (sage-lime bg `#B8D89A`, ink `#2D3E1E`).
- Optional editorial label top-right (terracotta bg for the highlighted card, white+border for the rest).
- Fit avatars appear below the card when a logged-in visitor has family members.

### Hero poster fan

Canonical: [`ApercuHero.tsx`](../src/components/home-v2/ApercuHero.tsx).

Four tilted cards, rotations `[-4, +2, +4, -2]`, diagonal layout (see `POSITIONS` in code). Card #2 is the highlighted pick (stronger shadow + terracotta editorial label). Cards are 200px wide on desktop, hidden below `md`.

This is the page's visual hook. Keep it on any hero.

### Pills & tags

- **Age pill**: `#B8D89A` bg, `#2D3E1E` text, `rounded`, `text-[10px] font-semibold`.
- **Meta pill**: `bg2` bg, `ink2` text, `rounded`, `text-[10px]`.
- **Chip** (hero suggestions): `bg2` bg, `line` border, `rounded-full`, `px-3 py-1 text-xs`.
- **Nav / tab pill**: white bg, `line2` border, `rounded-full`. Active variant: `ink` bg, `bg` text.

### Floating badges

Two patterns used over the hero poster fan:

1. **Profil foyer** — white card, top-left of visual column, avatar + member names + ages. Uses `MemberAvatar` + `getMemberAge`. Hybrid data: real when logged-in with family, demo (Léa + Tom) otherwise.
2. **Analyse pour votre foyer** — white card, bottom-left, verdict rows with colored dot + "Adapté / Attention / Pas adapté" + name + age. Always illustrative (we don't have a real film context in a hero). Subtitled "Ce badge s'affiche sur chaque fiche" to double as a tutorial.

These micro-cards are the page's second-most-important signal after the poster fan. Any auth-aware section (profil, films for family) should surface equivalents.

### Family-Fit verdict badge (shown on every media card, auth'd)

The on-product version of the hero's illustrative badge. When a visitor is logged in with family members, every media card shows small rounded avatars with a ring in the verdict color. The scoring comes from `/api/media/batch-family-fit` via `FamilyFitProvider`. This is a core brand element — it's what justifies the "guide" claim.

### Stats row

Three columns, Fraunces numbers + Inter labels. Use **catalog-depth numbers** (`9 600+ œuvres analysées · 7 critères par œuvre · 60+ thèmes explorés`), never early-stage social-proof ones (`22 profils famille`, `3 avis`) until those numbers cross a mature threshold.

### Final CTA block

Warm gradient (`accent → accent2` diagonal, 135°), `rounded-3xl`, generous padding, 2 buttons (white primary + outlined secondary). One per page. This is the only gradient in the entire design system.

---

## 6. Preview-page scaffolding (the `/apercu*` pattern)

Each new section we preview follows the same skeleton so the review experience is consistent and so migration to the live site is mechanical.

### Route & file layout

```
src/app/apercu<suffix>/
  layout.tsx      — noindex metadata + scoped CSS overrides
  page.tsx        — owner/admin gate, loads Fraunces, renders the component

src/components/home-v2/                (or a sibling folder per section)
  Apercu<Section>*.tsx
  apercuTheme.ts  — palette + age buckets (shared)
  apercuFont.ts   — Fraunces loading (shared)
```

Current and planned routes:

| Route | Page archetype | Status |
|---|---|---|
| `/apercu` | Home | Shipped |
| `/apercufilm` | Movie detail (reference film) | Planned |
| `/apercufoyer` | Authenticated family hub | Planned |
| `/apercurecherche` | Listing with sidebar | Deferred |

### Gating

Server component:
```ts
const user = session?.user
const isOwner = user?.email === "masterfei@gmail.com" || user?.role === "ADMIN"
if (!isOwner) redirect("/")
```

Wrap in `try/catch` so auth outages redirect cleanly instead of 500.

### Noindex

Layout sets:
```ts
export const metadata: Metadata = {
  title: "Aperçu · Totem Avisé",
  robots: { index: false, follow: false },
}
```

### Scoped layout overrides

Every apercu layout injects this small `<style>` block:

```tsx
<style>{`
  body > footer:not([data-apercu-footer]) { display: none !important; }
  body > header {
    background-color: #F5F1E9 !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border-bottom-color: rgba(30,26,21,0.08) !important;
  }
`}</style>
```

This:
1. Hides the global violet footer so our warm `ApercuFooter` (carrying `data-apercu-footer`) is the only one.
2. Tints the shared sticky Header to the cream canvas so it doesn't read as a different page at the top.

### Preview banner

Every apercu page opens with a dark ink strip at the top:

> Aperçu design · non visible par les utilisateurs · [tester avec Poppins](?font=poppins) · [revenir à Fraunces](?)

Subtle reminder that this is not public + one-click font A/B.

### Nav between apercu pages

Add a small nav strip below the preview banner linking to every active apercu route so the reviewer can hop between them without typing URLs. Keep it muted — it's scaffolding, not UI.

---

## 7. Iconography

- Use **lucide-react** icons inherited from the rest of the site. 1.5–1.75 stroke.
- Color them with `ink` or `ink2` — no duotone, no filled sets, no drop-shadow.
- Emoji: allowed as a single rail accent (`✦` on trust pills, maybe one emoji per rail title) — never more than one per string.
- Logo mark: the existing `/logo-icon.png` only. Don't generate new SVG marks — the `variation-a.jsx` mockup had a placeholder SVG and it was wrong to ship it.

---

## 8. Writing / voice

French, `vous` form, confident but warm. **Honesty over hype** — we're pre-launch and the copy should still feel true a year from now.

**Do**
- Short declarative headlines. Verb-first when possible (*Trouvez, Composez, Explorez*) but declarative is fine too (*Les bons contenus, choisis en confiance*).
- Italicize one emotional word per line — the one that carries the feeling. Two max per heading.
- Replace marketing superlatives ("incroyable !") with specific numbers (`9 600+ œuvres analysées`).
- Questions in headings welcome (*"Quoi regarder ce soir ?", "Qui regarde ce soir ?"*) — they anchor the reader in a real moment.
- Always name the independence once per page: *"indépendant · sans publicité · fait main"*.
- Use `foyer` as the default neutral noun. `famille` / `parents` only when the feature literally concerns them.

**Don't**
- No em dashes (`—`) in user-visible copy. Use periods. AI writing defaults to em dashes; we don't.
- No "choix médias éclairés" or other corporate / governmental phrasing.
- No exclamation marks in CTAs.
- Don't oversell the community today: `22 foyers` + `3 avis` ≠ "portée par une communauté". Use `fait main`, `premières réactions`, `premiers avis publiés` — honest early-stage framing that ages well.
- Don't frame the whole brand around children. A couple without kids must feel addressed by the hero.
- No "pour vos enfants" hero taglines. "Pour chaque âge du foyer" is fine contextually (age tiles), but not in the top-line.

### Canonical phrasings (keep consistent across pages)

- Trust line: `Indépendant · sans publicité · fait main`
- Hero H1: `Les bons contenus, choisis en confiance.`
- Hero body: `On passe chaque film, série et jeu vidéo au crible. À vous de choisir ce qui vous correspond.`
- Final CTA (logged out): `Gratuit, sans publicité, sans algorithme opaque. Des analyses honnêtes, faites main.`
- Footer tagline: `Le guide indépendant pour chaque foyer. Sans algorithme, sans publicité.`

---

## 9. Do / don't (design)

**Do**
- Lean on whitespace but not to the point of emptiness — density should feel editorial, not bureaucratic.
- Keep one italic word per heading in terracotta; one in sage is optional.
- Use the fixed age-range colors everywhere (apps, emails, prints, merch). Same hex every time.
- Tilt poster cards in heroes for editorial energy.
- Show real honest numbers — catalog depth now, social proof once it's meaningful.
- Reuse existing components (`HeroSearch`, `FamilyFitProvider`, `MemberAvatar`) on new apercu pages. Don't rebuild infrastructure.

**Don't**
- Use Inter italic (use Fraunces italic).
- Introduce a third font family. Anton / Edunline stay scoped to the logotype.
- Use pure black (`#000`). Use `ink` (`#1E1A15`).
- Put two vivid tile colors next to each other without a neutral between them.
- Use drop-shadows on text, glassmorphism, bevels, or radial glows.
- Decorate the footer or preview banner with gradients — keep them flat `ink`.
- Pre-filter genre-browse tiles with content-metric caps. Caps belong on labels that promise safety (Sans violence, age tiles, Soirée famille), not on "Comédie" or "Drame".
- Fake testimonials, fake user counts, fake community claims. If we don't have the data, show catalog depth or hide the section.

---

## 10. File references (current source of truth)

| Purpose | File |
|---|---|
| Palette + age buckets | [`src/components/home-v2/apercuTheme.ts`](../src/components/home-v2/apercuTheme.ts) |
| Fraunces loading | [`src/components/home-v2/apercuFont.ts`](../src/components/home-v2/apercuFont.ts) |
| Canonical hero (fan + badges + stats) | [`src/components/home-v2/ApercuHero.tsx`](../src/components/home-v2/ApercuHero.tsx) |
| Canonical section heading + media card | [`src/components/home-v2/ApercuMediaCard.tsx`](../src/components/home-v2/ApercuMediaCard.tsx) |
| Canonical rails (Expert Picks, Cinema, Streaming) | `Apercu{ExpertPicks,NowInCinema,Streaming}.tsx` |
| Age grid (tiles + bucket caps) | [`src/components/home-v2/ApercuAgeGrid.tsx`](../src/components/home-v2/ApercuAgeGrid.tsx) |
| Theme tile grid | [`src/components/home-v2/ApercuCollections.tsx`](../src/components/home-v2/ApercuCollections.tsx) |
| Pulse (live stats) | [`src/components/home-v2/ApercuPulse.tsx`](../src/components/home-v2/ApercuPulse.tsx) |
| Final CTA | [`src/components/home-v2/ApercuFinalCTA.tsx`](../src/components/home-v2/ApercuFinalCTA.tsx) |
| Footer | [`src/components/home-v2/ApercuFooter.tsx`](../src/components/home-v2/ApercuFooter.tsx) |
| Layout scaffolding (gate + scoped CSS + metadata) | [`src/app/apercu/layout.tsx`](../src/app/apercu/layout.tsx) + [`page.tsx`](../src/app/apercu/page.tsx) |
| Original design variations (reference only, in local `dump/` which is gitignored) | `dump/Design/components/variation-{a,b}.jsx` |

---

## 11. Out of scope (deliberately)

- **Dark mode (Soirée palette)** — defined conceptually but not implemented. Revisit once the warm palette is validated across all pages.
- **Mobile layouts of hero poster fans** — the fan is hidden below `md`. Mobile hero gets the same copy + search but no fan. Proper mobile composition is future work.
- **Filter UI for content-metric caps** — the URL params (`maxViolence`, etc.) exist and work, but there's no sidebar UI to drive them. The existing smart-family filter in `FilterSidebar` already covers the logged-in case better than raw sliders would.
- **Animation / micro-interactions** — static first. Add motion only when we can do it in a single consistent vocabulary, not component-by-component.

When the `/apercu*` pages are validated end-to-end, migration to the live site is a mechanical sweep: copy the warm-palette components into the live page components, delete the apercu routes, delete the scoped CSS overrides, ship.
