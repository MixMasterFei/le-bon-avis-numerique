# Mobile Responsiveness Audit — 2026-04-21

**Scope**: 30 user-facing routes + shared chrome (header/footer/HeroSearch).
**Viewports targeted**: 360-414px (iPhone + Android portrait), 768px (iPad portrait).
**Method**: static code inspection (grep/read). Dev-server visual verification still recommended before shipping fixes.

## TL;DR — root cause of the homepage breakage you reported

It's not the hero's poster stage (already `hidden md:block`). The actual overflow source is **[HeroSearch.tsx:238-252](../src/components/home/HeroSearch.tsx#L238-L252)** — the "Populaire:" pill row uses `flex items-center justify-center gap-3` with `whitespace-nowrap` on each pill and **no `flex-wrap`**. With 5 non-wrapping pills + a label, the row forces horizontal scroll on anything under ~700px. That is the single most visible bug on mobile. Fixing it is a one-line change.

Second homepage offender: the search input itself at [line 183-204](../src/components/home/HeroSearch.tsx#L183-L204) reserves `pr-36` (144px) for the submit button. On a 360px viewport that leaves ~120px of typable space — cramped but not broken.

---

## Severity legend

- **BROKEN** — visible overflow, horizontal scroll, or content clipped on a standard phone. Fix before next push.
- **MINOR** — functional but cramped, awkward wrapping, or visual polish issue.
- **OK** — inspected, no mobile issue found.

---

## BROKEN (fix first — ~8 issues, all in shared or homepage surfaces)

### 1. HeroSearch: "Populaire" pills force horizontal scroll
**File**: [src/components/home/HeroSearch.tsx:238-252](../src/components/home/HeroSearch.tsx#L238-L252)
**Why**: flex row with `whitespace-nowrap` pills, no `flex-wrap`.
**Fix**:
```diff
- <div className="mt-5 flex items-center justify-center gap-3">
+ <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
```
**Impact**: eliminates the overflow you reported. Appears on `/`, `/recherche` (anywhere HeroSearch is mounted).

### 2. HeroSearch: submit button reservation cramps input
**File**: [src/components/home/HeroSearch.tsx:183-204](../src/components/home/HeroSearch.tsx#L183-L204)
**Why**: `pr-36` (144px) is always reserved for the 120px-wide "Rechercher" button. On 360px that's ~36% of viewport width lost to padding.
**Fix**: icon-only submit button under `sm`, or swap `pr-36 sm:pr-36` → `pr-14 sm:pr-36` and use an icon submit on mobile.
**Impact**: more usable search field on phones.

### 3. SiteHeader: chrome cramping at 360-414px
**File**: [src/components/layout/SiteHeader.tsx](../src/components/layout/SiteHeader.tsx)
**Why**: logo + mobile search + admin link (if admin) + theme toggle + avatar compete for 360px. Menu button is at one end but the other elements' individual margins add up.
**Fix**: compress `px-4` container padding, drop the inline mobile search below the logo row (move it into the drawer only), or hide the admin link on mobile (admins can still access `/admin` via the drawer menu).

### 4. /contact: subject buttons cramped
**File**: [src/app/contact/page.tsx:241-269](../src/app/contact/page.tsx#L241-L269)
**Why**: `grid grid-cols-2 gap-2` at all breakpoints; buttons contain 15+ char French labels.
**Fix**:
```diff
- <div className="grid grid-cols-2 gap-2">
+ <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
```

### 5. /a-propos: stats row breaks at 360px
**File**: [src/app/a-propos/page.tsx:120](../src/app/a-propos/page.tsx#L120)
**Why**: `grid grid-cols-3 gap-6` without mobile fallback. ~80px per column after padding.
**Fix**:
```diff
- <div className="grid grid-cols-3 gap-6">
+ <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
```

### 6. /tarifs: pricing cards too wide at 360px
**File**: [src/app/tarifs/page.tsx:112-226](../src/app/tarifs/page.tsx#L112-L226)
**Why**: `p-6 md:p-8` on mobile is ~48px of horizontal padding leaving ~280px for content; feature list text wraps awkwardly.
**Fix**: reduce mobile card padding to `p-4 md:p-8`. Size down feature list text with `text-xs sm:text-sm`.

### 7. /inscription: two-column funnel layout inversion
**File**: [src/components/home-v2/ApercuInscription.tsx:106](../src/components/home-v2/ApercuInscription.tsx#L106)
**Why**: `grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-16` — at iPad portrait (768px) still single-column, but large gap stacks huge whitespace between intro and form.
**Fix**: `gap-6 lg:gap-16` so stacked mobile version doesn't have a 40px gap.

### 8. Content-heading scale jumps md→lg without sm step
**Files**: `/contact`, `/tarifs`, `/a-propos` all use `text-3xl md:text-5xl` pattern.
**Why**: on narrow phones (360px), 30px bold French phrases like "Une question, une suggestion ?" break into 4-5 cramped lines.
**Fix**: add an `sm` step — `text-2xl sm:text-3xl md:text-5xl`. Bonus: `leading-tight` on mobile, `leading-snug` on md+.

---

## MINOR (fix after BROKEN — ~10 issues)

### 9. Listing pages: grid-gap is too loose at mobile
**Files**: `/films`, `/series`, `/jeux`, `/livres`, `/apps`, `/age/[range]`, `/recherche`, `/mangas` all use `gap-4 md:gap-5` on the poster grid.
**Why**: on `grid-cols-2` at 360px, 16px gap + 16px container padding leaves ~156px per card. Tight but not broken.
**Fix** (consistency): standardize to `gap-3 sm:gap-4 md:gap-5` across all listings. Single-line change per file.

### 10. /films/recherche: inconsistent gap scale
**File**: [src/app/films/recherche/page.tsx:395](../src/app/films/recherche/page.tsx#L395) uses `gap-2 sm:gap-3` — tighter than every other listing.
**Fix**: standardize to the same `gap-3 sm:gap-4 md:gap-5`.

### 11. SiteFooter: link labels wrap at 360-414px
**File**: [src/components/layout/SiteFooter.tsx:76-167](../src/components/layout/SiteFooter.tsx#L76-L167)
**Why**: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8`; long link names ("Collections thématiques", 26 chars) wrap in narrow columns.
**Fix**: `gap-4 md:gap-6 lg:gap-8` + `text-xs md:text-sm` on link text.

### 12. /collections/[id]: collection hero tight gap
**File**: [src/app/collections/[id]/page.tsx:192](../src/app/collections/[id]/page.tsx#L192)
**Fix**: `flex flex-col sm:flex-row gap-3 sm:gap-5`.

### 13. /profil: edit-profile dialog grid missing mobile default
**File**: [src/app/profil/page.tsx:349](../src/app/profil/page.tsx#L349) has `grid gap-4 sm:grid-cols-2` with no explicit `grid-cols-1`.
**Fix**: add `grid-cols-1` prefix for determinism.

### 14. /inscription: password-rule checkboxes cramped at 768px
**File**: [src/components/home-v2/ApercuInscription.tsx:208](../src/components/home-v2/ApercuInscription.tsx#L208)
**Fix**: `grid grid-cols-1 sm:grid-cols-2 gap-3`.

### 15. Legal pages: wide tables overflow
**Files**: [src/app/nos-valeurs/page.tsx:232-260](../src/app/nos-valeurs/page.tsx#L232-L260), [src/app/confidentialite/page.tsx:124-162](../src/app/confidentialite/page.tsx#L124-L162)
**Why**: `overflow-x-auto` wrapper is there, but cell text at `text-sm` still forces scroll.
**Fix**: `text-xs md:text-sm` on table + reduce cell padding at mobile.

### 16. /guides: long card titles wrap to 3+ lines
**File**: [src/app/guides/page.tsx:149-177](../src/app/guides/page.tsx#L149-L177)
**Fix**: `text-base md:text-lg` on titles, `text-xs md:text-sm` on descriptions.

### 17. /blog: BlogCard at 360px needs verification
**File**: [src/app/blog/page.tsx:93](../src/app/blog/page.tsx#L93)
**Why**: single-column on mobile is correct, but `BlogCard` internal layout not inspected.
**Action**: visual check on preview build; may be OK already.

---

## OK (audited, no mobile issue)

- **/media/[id]** hero: `flex flex-col lg:flex-row` correctly stacks.
- **/media/[id]** screenshots: `grid grid-cols-2 md:grid-cols-3` fine.
- **/media/[id]** similar-media: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4` fine.
- **/profil** family members grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` fine.
- **/ma-liste** + **/mes-favoris**: same responsive pattern.
- **/connexion**, **/mot-de-passe-oublie**, **/verifier-email**, **/reinitialiser-mot-de-passe**: single-column forms already stack.
- **/onboarding**: step layout responsive.
- **/profil/quiz/[memberId]**: PreferenceQuiz already mobile-aware.
- **/profil/membres/[memberId]**: MemberCorner tabs responsive.
- **Homepage rails** (NowInCinema, Streaming, AgeGrid, Collections, Pulse, FinalCTA, NouveautesMangaRail): grids stack to `grid-cols-2` or `grid-cols-3` at mobile without overflow. Gap is `gap-3`, which is tight but not broken.
- **SiteHeader mobile drawer**: uses `max-h-[calc(100dvh-4.5rem)]` + `overflow-y-auto`, works.
- **Legal pages** (cookies, mentions-légales): short text pages, no overflow.

---

## Suggested fix plan (one commit per group)

### Commit 1 — Homepage overflow (fixes the reported bug)
- HeroSearch pills wrap (#1)
- HeroSearch input padding (#2)
- SiteHeader compression (#3)
**Effect**: homepage and any page with HeroSearch stops overflowing on mobile.

### Commit 2 — Conversion funnels
- /contact subject buttons (#4)
- /tarifs pricing cards (#6)
- /inscription layout gap (#7)
- /inscription password checkboxes (#14)
**Effect**: signup, pricing, contact all read clean on phones.

### Commit 3 — Content pages + typography
- /a-propos stats grid (#5)
- Heading scale steps (#8)
- /guides title sizes (#16)
- /collections/[id] hero gap (#12)
**Effect**: marketing pages read comfortably on 360px.

### Commit 4 — Polish + consistency
- Listing grid gap standardization (#9, #10)
- SiteFooter gap + text size (#11)
- Profile edit dialog (#13)
- Legal tables (#15)

### Commit 5 — Visual verification
- Run dev server, check each route in Chrome DevTools responsive mode at 360/390/414/768px.
- Lighthouse CI (already wired) will catch CLS regressions.

**Estimated effort**: 4-6 hours of focused work. No desktop regression risk — every fix is additive (adds a mobile breakpoint that current desktop already handles).

---

## Open questions for Xavier

1. **Mobile search UX** (fix #2): icon-only submit, or hide the input behind a tap icon in the header and expand on focus? Recommendation: icon-only submit — less disruption, easier to implement.
2. **Admin nav link** on mobile (fix #3): hide entirely and rely on `/admin` bookmark / drawer menu? Or keep as a small icon?
3. **Content-heading scale** (fix #8): do we want consistent `text-2xl sm:text-3xl md:text-5xl` across all hero headings, or case-by-case?
