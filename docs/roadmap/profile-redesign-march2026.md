# Profile Page Redesign: "Family Command Center" + DiceBear Avatars

## Context

The `/profil` page is Totem Avisé's most important page — where families manage their preferences, see personalized recommendations, and control their experience. Currently it's a boring vertical stack of generic cards with no visual hierarchy, buried member management, and basic emoji avatars. This redesign transforms it into a **modern family dashboard** that feels like a real control center, and replaces emoji avatars with **DiceBear SVG avatars** (free, open-source, 8 curated family-friendly styles).

---

## Phase 1: DiceBear Avatar Foundation (non-breaking)

### 1.1 Install dependencies
```bash
npm install @dicebear/core @dicebear/collection
```

### 1.2 SQL migration — `sql/add_avatar_dicebear.sql`
```sql
ALTER TABLE family_members ADD COLUMN avatar_style TEXT;
ALTER TABLE family_members ADD COLUMN avatar_seed TEXT;
ALTER TABLE family_members ADD COLUMN avatar_options JSONB;

ALTER TABLE users ADD COLUMN avatar_style TEXT;
ALTER TABLE users ADD COLUMN avatar_seed TEXT;
ALTER TABLE users ADD COLUMN avatar_options JSONB;
```

### 1.3 Prisma schema update — `prisma/schema.prisma`
Add to `FamilyMember` and `User` models:
- `avatarStyle String? @map("avatar_style")`
- `avatarSeed String? @map("avatar_seed")`
- `avatarOptions Json? @map("avatar_options")`

Keep `avatarEmoji` — backward compat.

### 1.4 New utility — `src/lib/avatar.ts`
- `getAvatarDataUri(style, seed, options?, size?)` — generates SVG data URI
- `emojiToSeed(emoji)` — converts an emoji string to a deterministic seed for auto-migration
- `AVATAR_STYLES` — curated map of 8 family-friendly styles:
  - `fun-emoji` ("Emojis rigolos") — playful, kids love it
  - `adventurer` ("Aventurier") — whimsical illustrated characters
  - `big-smile` ("Sourire") — cheerful expressions
  - `lorelei` ("Elegant") — sophisticated, adults
  - `notionists` ("Moderne") — clean, contemporary
  - `bottts` ("Robots") — fun for tech-loving kids
  - `pixel-art` ("Retro") — retro gaming appeal
  - `thumbs` ("Pouces") — fun & minimal

### 1.5 New component — `src/components/ui/MemberAvatar.tsx`
Unified avatar renderer used everywhere — **DiceBear only** (no emoji rendering):
- If `avatarStyle` + `avatarSeed` → render DiceBear `<img>` via `useMemo`
- Else if legacy `avatarEmoji` → auto-migrate: use emoji as seed with default style `"fun-emoji"` → render DiceBear
- Else → render DiceBear with a default seed (e.g. member name or "default")
- Props: `avatarStyle`, `avatarSeed`, `avatarOptions`, `avatarEmoji` (legacy, auto-converted), `size` (px), `className`, `ring` (optional color ring)
- This means **every avatar on the site becomes a DiceBear SVG** — no more raw emoji rendering

### 1.6 Update API routes (add new fields to select/return)
- `src/app/api/user/family/route.ts` — GET select + POST body
- `src/app/api/user/family/[id]/route.ts` — GET + PATCH
- `src/app/api/user/family/[id]/preferences/route.ts`
- `src/app/api/media/[id]/family-fit/route.ts`
- `src/app/api/media/batch-family-fit/route.ts`
- `src/app/api/recommendations/route.ts`
- `src/app/api/recommendations/family/route.ts`
- `src/app/api/user/reaction/route.ts`
- `src/app/api/user/profile/route.ts`

**Result:** Everything still works exactly as before. No UI changes yet.

---

## Phase 2: Avatar Rendering Swap + AvatarPicker

### 2.1 New component — `src/components/ui/AvatarPicker.tsx`
Replaces `IconPicker`. **DiceBear only** — no emoji option. UI:
- Large live preview (96px DiceBear avatar, animated transitions on change)
- Style grid (8 curated styles as selectable cards, each showing a sample in that style)
- Shuffle button (random seed, same style) — "Nouveau visage"
- Background color palette (8 pastel presets matching site colors)
- Props: `value: { style: string, seed: string, options?: Record<string, unknown> }`, `onChange`

### 2.2 Swap all emoji renders → `<MemberAvatar>`
~18 component files, mechanical replacement of `<span>{member.avatarEmoji}</span>` patterns:
- `FamilyMembers.tsx`, `MemberCorner.tsx`, `FamilyFitCard.tsx`, `FamilyFitHero.tsx`
- `FamilyReactions.tsx`, `FamilyFitAvatars.tsx`, `FamilyRecommendationsSection.tsx`
- `FamilyMovieNightSection.tsx`, `FilterSidebar.tsx`, `ReviewModal.tsx`, `ReviewCardWithReport.tsx`
- `FamilyRecommendations.tsx`, `FamilyMovieNight.tsx`, `HomepageV2.tsx`, `ProfileNudge.tsx`
- `onboarding/page.tsx`, `profil/quiz/[memberId]/page.tsx`, `profil/page.tsx`

### 2.3 Integrate AvatarPicker into forms
- `FamilyMembers.tsx` — replace emoji grid in add/edit form
- `MemberCorner.tsx` — replace emoji grid in edit mode
- `onboarding/page.tsx` — replace IconPicker
- `profil/page.tsx` — replace emoji grid in "Modifier le profil" dialog

### 2.4 Update CompletionMeter
- Change custom avatar detection: `(member.avatarStyle != null) || (member.avatarEmoji !== "👧")`
- Add `compact` prop (bar + percentage only, no checklist)

**Result:** New users get beautiful DiceBear avatars. Existing users keep emojis until they edit.

---

## Phase 3: Profile Page Redesign

### New page layout — 4 zones replacing the current flat stack

```
╔══════════════════════════════════════════════════════════╗
║  ZONE A — Family Identity Hero (gradient banner)         ║
║  Parent avatar | Name + stats ribbon | Edit button       ║
║  Family faces row: [Alice] [Léa] [Hugo] [Papa] ...      ║
╠══════════════════════════════════════════════════════════╣
║  ZONE B — "Mon foyer" (member card grid)                 ║
║  ┌──────────┐ ┌──────────┐ ┌──────────┐                ║
║  │ Member 1 │ │ Member 2 │ │ Member 3 │                ║
║  │ avatar   │ │ avatar   │ │ avatar   │                ║
║  │ stats    │ │ stats    │ │ stats    │                ║
║  │ prefs    │ │ prefs    │ │ prefs    │                ║
║  │ actions  │ │ actions  │ │ actions  │                ║
║  └──────────┘ └──────────┘ └──────────┘                ║
║               ┌ ─ ─ ─ ─ ┐                              ║
║               │ + Ajouter│                              ║
║               └ ─ ─ ─ ─ ┘                              ║
╠══════════════════════════════════════════════════════════╣
║  ZONE C — Tabs: Recommandations | Soirée Ciné | Listes  ║
║  [existing components, embedded as tab content]          ║
╠══════════════════════════════════════════════════════════╣
║  ZONE D — Paramètres du compte (collapsible)             ║
╚══════════════════════════════════════════════════════════╝
```

### 3.1 New component — `src/components/profile/FamilyHero.tsx`
- Full-width gradient banner (`from-violet-50 via-indigo-50 to-purple-50`)
- Parent: large DiceBear avatar (80px) + name + "Membre depuis..." badge
- Stats ribbon inline: 4 mini-stats (avis, favoris, à voir, réactions) — not separate cards
- Family faces row: all member avatars (40px) clickable, scrolls to their card
- "Modifier le profil" button (opens existing dialog)

### 3.2 New component — `src/components/profile/FamilyMemberCard.tsx`
Rich card per family member:
- **Header:** DiceBear avatar (64px) with completion-colored ring + name + age
- **Completion:** Compact `CompletionMeter` (bar only)
- **Preferences at a glance:** Top 3 favorite genres as badges + aggregated sensitivity mini-bar
- **Quick stats:** Reactions count + favorites count (inline)
- **Top pick:** #1 recommendation for this member (poster + title + match %, lazy-loaded)
- **Actions:** 3 buttons — Quiz, Préférences, "Coin de {name}"
- **Context menu:** (top-right "..." dropdown) Edit, Delete
- Hover: card-hover lift animation

### 3.3 New component — `src/components/profile/AccountSettings.tsx`
Extract from `profil/page.tsx` lines 372-510:
- Wrapped in a collapsible section (ChevronDown toggle)
- Contains: blur 18+ toggle, cookies, delete account

### 3.4 Expand `GET /api/user/family` select
Add to the select clause: `favoriteGenres`, `dislikedGenres`, `useCustomSettings`, `sensitivityViolence`, `sensitivityScary`, `sensitivitySexual`, `sensitivityLanguage`, `sensitivitySubstances`, `interests`, `avoidTopics`, `preferPositiveMessages`, `preferRoleModels`, `preferEducational`
— needed for the rich member cards to show preferences at a glance.

### 3.5 Rewrite `src/app/profil/page.tsx`
- Container: `max-w-6xl` (from `max-w-4xl`) — more room for 3-column card grid
- **Mobile-first responsive:** single column on mobile with cards at full width, comfortable padding, no horizontal overflow
- Zone A: `<FamilyHero>` — stacks vertically on mobile (avatar + name above stats)
- Zone B: Member card grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6`) + "Ajouter" card
- Zone C: `<Tabs>` with 3 tabs embedding existing recommendation components
- Zone D: `<AccountSettings>` collapsible
- Keep all existing hooks, data fetching, session handling
- **Mobile testing critical:** hero must not overflow, cards must be touch-friendly (min tap target 44px), tabs must scroll horizontally if needed

---

## Phase 4: Polish

- Staggered card entrance animations (CSS `animation-delay`)
- Skeleton loading states for member cards
- Mobile responsive testing (1-col cards, stacked hero)
- Verify avatar sizes render correctly at all scales (20px in FamilyFitAvatars → 96px in picker)
- Test backward compat: existing users with emoji-only avatars
- Keep `IconPicker` available (used by AvatarPicker's legacy mode) but remove standalone imports

---

## Files to create

| File | Purpose |
|------|---------|
| `sql/add_avatar_dicebear.sql` | DB migration |
| `src/lib/avatar.ts` | DiceBear utility + style definitions |
| `src/components/ui/MemberAvatar.tsx` | Unified avatar renderer |
| `src/components/ui/AvatarPicker.tsx` | DiceBear style browser + customizer |
| `src/components/profile/FamilyHero.tsx` | Profile hero banner |
| `src/components/profile/FamilyMemberCard.tsx` | Rich member card |
| `src/components/profile/AccountSettings.tsx` | Extracted settings (collapsible) |

## Files to modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add 3 fields to FamilyMember + User |
| `package.json` | Add @dicebear/core, @dicebear/collection |
| `src/app/profil/page.tsx` | Complete layout rewrite (hero + grid + tabs) |
| `src/app/api/user/family/route.ts` | Expand select, handle new avatar fields |
| `src/app/api/user/family/[id]/route.ts` | Handle new avatar fields in PATCH |
| `src/components/profile/FamilyMembers.tsx` | Use MemberAvatar + AvatarPicker |
| `src/components/profile/MemberCorner.tsx` | Use MemberAvatar + AvatarPicker |
| `src/components/profile/CompletionMeter.tsx` | Add compact prop + DiceBear detection |
| `src/app/onboarding/page.tsx` | Replace IconPicker with AvatarPicker |
| ~14 more components | Swap emoji `<span>` → `<MemberAvatar>` |

## Verification

1. `npm run build` — no TypeScript errors
2. Manual test: create a new family member → pick a DiceBear avatar → verify it renders across profile, media pages, homepage
3. Manual test: existing member with emoji → still renders correctly
4. Manual test: profile page on mobile (375px) → single-column cards, hero stacks
5. Manual test: recommendations, movie night, lists tabs all work as before
6. Manual test: onboarding wizard → new AvatarPicker works
7. `npm run test` — existing tests pass
